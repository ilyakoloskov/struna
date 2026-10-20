import type { Tuning } from '@/domain/music/tunings'
import { tuningMatches } from '@/domain/music/tunings'
import type { FrettedNote, NoteEvent, SongTrack } from './types'
import { portableTechnique } from './technique'

// Расстановка нот по струнам и ладам для MIDI, где позиций нет.
//
// Модель руки: указательный палец стоит на ладу p, без смены позиции рука берёт лады p…p+3.
// Динамическое программирование (Витерби) по группам одновременных нот выбирает
// для всей партии последовательность (комбинация струн, позиция руки) с минимальной стоимостью:
// перемещения руки + высокие лады + растяжка в аккорде + прыжки через струны.
// Открытые струны руку не занимают, поэтому их выбор ничего не стоит.

export interface FingeringOptions {
  /** Самый низкий допустимый лад (кроме открытых струн, если minFret = 0) */
  minFret: number
  maxFret: number
  /** Максимальная растяжка аккорда в ладах (между крайними прижатыми нотами) */
  maxSpan: number
  /** Ноты, начавшиеся ближе этого интервала, считаются одним аккордом, с */
  chordTolerance: number
  /** Сколько лучших состояний хранить на каждом шаге */
  beamWidth: number
}

export const DEFAULT_FINGERING_OPTIONS: FingeringOptions = {
  minFret: 0,
  maxFret: 24,
  maxSpan: 4,
  chordTolerance: 0.03,
  beamWidth: 48,
}

/** Сколько ладов покрывает рука без смены позиции, сверх указательного */
const HAND_REACH = 3

const COST = {
  /** За каждый лад — лёгкое предпочтение нижних позиций */
  fret: 0.03,
  /** Дополнительно за каждый лад выше 12-го */
  highFret: 0.08,
  /** За каждый лад растяжки в аккорде */
  span: 0.15,
  /** Сдвиг внутри «коробки» (до HAND_REACH ладов), за лад */
  shiftNear: 0.25,
  /** Каждый лад сдвига сверх «коробки» */
  shiftFar: 1,
  /** Смещение «центра» по струнам, за струну */
  stringJump: 0.06,
  /** Во столько раз дешевле переезд, если перед нотой пауза */
  restDiscount: 0.5,
}
const REST_SECONDS = 0.6

interface Placement {
  stringIndex: number
  fret: number
}

interface Combo {
  /** Позиции нот группы (в порядке нот группы); null — нота неиграбельна */
  placements: (Placement | null)[]
  localCost: number
  minFret: number
  maxFret: number
  hasFretted: boolean
  stringCenter: number
}

interface State {
  combo: number
  hand: number
  cost: number
  back: number
}

export function assignFingering(
  notes: readonly NoteEvent[],
  tuning: Tuning,
  options: Partial<FingeringOptions> = {},
): FrettedNote[] {
  const opts = { ...DEFAULT_FINGERING_OPTIONS, ...options }
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi)
  const groups = groupChords(sorted, opts.chordTolerance)
  const combos = groups.map((group) => enumerateCombos(group, tuning, opts))

  // Витерби с ограничением ширины луча
  const layers: State[][] = []
  combos.forEach((groupCombos, g) => {
    const previous = layers[g - 1]
    const gap = g > 0 ? groups[g]![0]!.time - groupEnd(groups[g - 1]!) : 0
    const states: State[] = []

    groupCombos.forEach((combo, comboIndex) => {
      const hands = combo.hasFretted
        ? handPositions(combo)
        : // Только открытые струны: рука остаётся там, где была
          previous
          ? [...new Set(previous.map((s) => s.hand))]
          : [1]

      for (const hand of hands) {
        if (!previous) {
          states.push({ combo: comboIndex, hand, cost: combo.localCost, back: -1 })
          continue
        }
        let best = Infinity
        let bestBack = -1
        previous.forEach((prev, prevIndex) => {
          const prevCombo = combos[g - 1]![prev.combo]!
          const cost =
            prev.cost +
            moveCost(prev.hand, hand, gap) +
            COST.stringJump * Math.abs(prevCombo.stringCenter - combo.stringCenter)
          if (cost < best) {
            best = cost
            bestBack = prevIndex
          }
        })
        states.push({ combo: comboIndex, hand, cost: best + combo.localCost, back: bestBack })
      }
    })

    states.sort((a, b) => a.cost - b.cost)
    layers.push(states.slice(0, opts.beamWidth))
  })

  // Обратный проход
  const chosen: Combo[] = new Array(groups.length)
  let index = 0
  for (let g = groups.length - 1; g >= 0; g--) {
    const state = layers[g]![index]!
    chosen[g] = combos[g]![state.combo]!
    index = state.back
  }

  return groups.flatMap((group, g) =>
    group.map((note, i) => {
      const placement = chosen[g]!.placements[i]
      return placement
        ? { ...note, stringIndex: placement.stringIndex, fret: placement.fret }
        : { ...note, stringIndex: -1, fret: -1 }
    }),
  )
}

/** Группы одновременных нот (аккорды); внутри группы — по возрастанию высоты */
export function groupChords(sorted: readonly NoteEvent[], tolerance: number): NoteEvent[][] {
  const groups: NoteEvent[][] = []
  for (const note of sorted) {
    const current = groups.at(-1)
    if (current && note.time - current[0]!.time <= tolerance) current.push(note)
    else groups.push([note])
  }
  for (const group of groups) group.sort((a, b) => a.midi - b.midi)
  return groups
}

function groupEnd(group: readonly NoteEvent[]): number {
  return Math.max(...group.map((n) => n.time + n.duration))
}

/** Позиции указательного пальца, при которых все прижатые ноты комбинации под рукой */
function handPositions(combo: Combo): number[] {
  const from = Math.max(1, combo.maxFret - HAND_REACH)
  const to = Math.max(from, combo.minFret)
  const hands: number[] = []
  for (let p = from; p <= to; p++) hands.push(p)
  return hands
}

function moveCost(from: number, to: number, gap: number): number {
  const distance = Math.abs(from - to)
  const cost =
    distance <= HAND_REACH
      ? distance * COST.shiftNear
      : HAND_REACH * COST.shiftNear + (distance - HAND_REACH) * COST.shiftFar
  return gap >= REST_SECONDS ? cost * COST.restDiscount : cost
}

function candidates(midi: number, tuning: Tuning, minFret: number, maxFret: number): Placement[] {
  const result: Placement[] = []
  tuning.strings.forEach((string, stringIndex) => {
    const fret = midi - string.midi
    if (fret >= minFret && fret <= maxFret) result.push({ stringIndex, fret })
  })
  return result
}

/**
 * Все допустимые раскладки группы: разные струны, без перекрёста (выше нота — выше струна),
 * растяжка не больше maxSpan. Если так не выходит — ослабляем ограничения,
 * а лишние ноты (больше, чем струн, или вне диапазона строя) помечаем неиграбельными.
 */
function enumerateCombos(
  group: readonly NoteEvent[],
  tuning: Tuning,
  opts: FingeringOptions,
): Combo[] {
  const options = group.map((note) => candidates(note.midi, tuning, opts.minFret, opts.maxFret))
  const playable = group.map((_, i) => options[i]!.length > 0)

  // Унисоны и лишние ноты сверх числа струн не помещаются — отбрасываем сверху
  const active = group.map((_, i) => i).filter((i) => playable[i])
  const seen = new Set<number>()
  const unique = active.filter((i) => {
    const midi = group[i]!.midi
    if (seen.has(midi)) return false
    seen.add(midi)
    return true
  })
  let kept = unique.slice(0, tuning.strings.length)

  for (const strict of [true, false]) {
    while (kept.length > 0) {
      const combos = search(kept, options, opts, strict)
      if (combos.length > 0) return combos.map((c) => finalize(c, group, kept, options))
      if (strict) break
      kept = kept.slice(0, -1)
    }
  }
  // Ничего не играбельно
  return [finalize([], group, [], options)]
}

function search(
  kept: readonly number[],
  options: readonly Placement[][],
  opts: FingeringOptions,
  strict: boolean,
): Placement[][] {
  const result: Placement[][] = []
  const current: Placement[] = []
  const LIMIT = 400

  function step(k: number) {
    if (result.length >= LIMIT) return
    if (k === kept.length) {
      result.push([...current])
      return
    }
    for (const placement of options[kept[k]!]!) {
      const used = current.some((p) => p.stringIndex === placement.stringIndex)
      if (used) continue
      if (strict) {
        const previous = current.at(-1)
        if (previous && placement.stringIndex <= previous.stringIndex) continue
        const fretted = [...current, placement].filter((p) => p.fret > 0).map((p) => p.fret)
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > opts.maxSpan) continue
      }
      current.push(placement)
      step(k + 1)
      current.pop()
    }
  }
  step(0)
  return result
}

function finalize(
  placementsOfKept: readonly Placement[],
  group: readonly NoteEvent[],
  kept: readonly number[],
  options: readonly Placement[][],
): Combo {
  const placements: (Placement | null)[] = group.map(() => null)
  kept.forEach((noteIndex, k) => {
    placements[noteIndex] = placementsOfKept[k] ?? null
  })
  // Унисон получает ту же позицию, что и его пара
  group.forEach((note, i) => {
    if (placements[i] || options[i]!.length === 0) return
    const twin = group.findIndex((other, j) => j !== i && other.midi === note.midi && placements[j])
    if (twin >= 0) placements[i] = placements[twin]!
  })

  const placed = placements.filter((p): p is Placement => p !== null)
  const fretted = placed.filter((p) => p.fret > 0).map((p) => p.fret)
  const minFret = fretted.length ? Math.min(...fretted) : 0
  const maxFret = fretted.length ? Math.max(...fretted) : 0
  const localCost =
    placed.reduce(
      (sum, p) => sum + p.fret * COST.fret + Math.max(0, p.fret - 12) * COST.highFret,
      0,
    ) +
    (maxFret - minFret) * COST.span
  const stringCenter = placed.length
    ? placed.reduce((sum, p) => sum + p.stringIndex, 0) / placed.length
    : 0
  return { placements, localCost, minFret, maxFret, hasFretted: fretted.length > 0, stringCenter }
}

/** Сколько нот нельзя сыграть в этом строе */
export function countUnplayable(notes: readonly FrettedNote[]): number {
  return notes.filter((n) => n.stringIndex < 0).length
}

/**
 * Ноты партии для игры: позиции из файла (Guitar Pro), если строй файла совпадает с выбранным,
 * иначе — расстановка под выбранный строй.
 */
export function chartNotesFor(track: SongTrack, tuning: Tuning): FrettedNote[] {
  const { positions, techniques, tuning: fileTuning } = track
  if (positions && fileTuning && tuningMatches(tuning, fileTuning)) {
    return track.notes.map((note, i) => {
      const technique = techniques?.[i]
      return { ...note, ...positions[i]!, ...(technique && { technique }) }
    })
  }
  const notes = assignFingering(track.notes, tuning)
  if (!techniques) return notes
  // Расстановка своя: переносим только приёмы, не привязанные к ладам из файла
  return notes.map((note, i) => {
    const technique = portableTechnique(techniques[i])
    return technique ? { ...note, technique } : note
  })
}

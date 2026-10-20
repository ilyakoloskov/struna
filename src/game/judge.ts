import type { FrettedNote } from '@/domain/tracks/types'
import { pitchRange, type PitchRange } from '@/domain/tracks/technique'
import { isChord, matchChord } from './chordMatch'
import { ACCEPT_OCTAVE_ERRORS, CHORD_TOLERANCE, PITCH_TOLERANCE_SEMITONES, TIMING } from './config'

// Судейство: сопоставление сыгранных нот с нотами трека.
// Цель — одна нота или аккорд (одновременные ноты). Засчитываем по высоте, а не по струне/ладу.
// Аккорд: в строгом режиме — по хромаграмме (прозвучал ли именно этот аккорд),
// иначе — если вовремя прозвучала любая его нота.
// Приёмы: у бенда и слайда в ноту засчитывается диапазон высот (звучит начало ноты),
// глухие ноты — только удар, без высоты; цель из одних глухих нот засчитывается любым ударом.

export type Grade = 'perfect' | 'good' | 'miss'

export interface Target {
  time: number
  /** Высоты нот с высотой (без глухих) */
  midis: readonly number[]
  /** Засчитываемые диапазоны высот — по одному на каждую из midis */
  ranges: readonly PitchRange[]
  /** Только глухие ноты: засчитывается любой удар */
  percussive: boolean
  /** Струны нот цели (для статистики по струнам) */
  strings: readonly number[]
  /** Индексы нот в исходном массиве (для эффектов на дорожке) */
  noteIndices: readonly number[]
}

export interface Judgment {
  targetIndex: number
  grade: Grade
  /** Отклонение сыгранного от ноты, с (плюс — поздно); у Miss — NaN */
  offset: number
}

/** Цели из нот партии: одновременные ноты собираются в аккорд */
export function buildTargets(notes: readonly FrettedNote[]): Target[] {
  const targets: {
    time: number
    midis: number[]
    ranges: PitchRange[]
    percussive: boolean
    strings: number[]
    noteIndices: number[]
  }[] = []
  notes.forEach((note, index) => {
    if (note.stringIndex < 0) return
    let target = targets.at(-1)
    if (!target || note.time - target.time > CHORD_TOLERANCE) {
      target = {
        time: note.time,
        midis: [],
        ranges: [],
        percussive: true,
        strings: [],
        noteIndices: [],
      }
      targets.push(target)
    }
    if (!note.technique?.dead) {
      target.midis.push(note.midi)
      target.ranges.push(pitchRange(note.midi, note.technique))
      target.percussive = false
    }
    target.strings.push(note.stringIndex)
    target.noteIndices.push(index)
  })
  return targets
}

/** Сыгранная высота попадает в диапазон (с допуском и, если разрешено, с ошибкой на октаву) */
export function pitchInRange(played: number, range: PitchRange): boolean {
  if (Number.isNaN(played)) return false
  const distance = (m: number) =>
    m < range.low ? range.low - m : m > range.high ? m - range.high : 0
  if (distance(played) <= PITCH_TOLERANCE_SEMITONES) return true
  return (
    ACCEPT_OCTAVE_ERRORS &&
    Math.min(distance(played - 12), distance(played + 12)) <= PITCH_TOLERANCE_SEMITONES
  )
}

export function pitchMatches(played: number, expected: number): boolean {
  return pitchInRange(played, { low: expected, high: expected })
}

export function gradeForOffset(offset: number): Grade {
  const abs = Math.abs(offset)
  if (abs <= TIMING.perfect) return 'perfect'
  if (abs <= TIMING.good) return 'good'
  return 'miss'
}

export class Judge {
  /** Оценка по каждой цели; null — ещё не судили */
  readonly grades: (Grade | null)[]
  /** Первая цель, которая ещё может быть не решена */
  private cursor = 0
  /** Сыграно нот, не совпавших ни с одной целью */
  extraNotes = 0

  /** Аккорды цели (строгий режим) */
  private readonly chords: boolean[]

  constructor(
    readonly targets: readonly Target[],
    /** Строгая проверка аккордов: аккорды судятся только по хромаграмме */
    readonly strictChords = false,
  ) {
    this.grades = targets.map(() => null)
    this.chords = targets.map((t) => strictChords && isChord(t.midis))
  }

  /** Ближайшая по времени нерешённая цель в окне, подходящая под условие */
  private nearest(time: number, accepts: (target: Target, index: number) => boolean) {
    let best = -1
    let bestOffset = Infinity
    for (let i = this.cursor; i < this.targets.length; i++) {
      const target = this.targets[i]!
      if (target.time - time > TIMING.good) break
      if (this.grades[i] !== null) continue
      const offset = time - target.time
      if (Math.abs(offset) > TIMING.good) continue
      if (!accepts(target, i)) continue
      if (Math.abs(offset) < Math.abs(bestOffset)) {
        best = i
        bestOffset = offset
      }
    }
    return { best, bestOffset }
  }

  private decide(index: number, offset: number): Judgment {
    const grade = gradeForOffset(offset)
    this.grades[index] = grade
    return { targetIndex: index, grade, offset }
  }

  /**
   * Сыгранная нота в момент time (время трека) → оценка, если совпала с целью.
   * midi = NaN — удар без высоты (глухая нота): подходит только для глухих целей.
   */
  play(time: number, midi: number): Judgment | null {
    const { best, bestOffset } = this.nearest(
      time,
      (target, i) =>
        !this.chords[i] &&
        (target.percussive || target.ranges.some((range) => pitchInRange(midi, range))),
    )
    if (best >= 0) return this.decide(best, bestOffset)
    // Высота от удара по аккорду, который судится по хроме, — не «лишняя нота»
    if (!Number.isNaN(midi) && this.nearest(time, (_, i) => this.chords[i]!).best < 0) {
      this.extraNotes++
    }
    return null
  }

  /** Хрома после удара в момент time → оценка, если это ожидаемый аккорд (строгий режим) */
  playChord(time: number, chroma: ArrayLike<number>): Judgment | null {
    const { best, bestOffset } = this.nearest(
      time,
      (target, i) => this.chords[i]! && matchChord(chroma, target.midis).ok,
    )
    return best >= 0 ? this.decide(best, bestOffset) : null
  }

  /** Цель судится по хроме (строгий режим, аккорд) */
  isChordTarget(index: number): boolean {
    return this.chords[index] ?? false
  }

  /** Время трека дошло до time: всё, что уже нельзя сыграть, — Miss */
  advance(time: number, onMiss: (judgment: Judgment) => void): void {
    while (this.cursor < this.targets.length) {
      const target = this.targets[this.cursor]!
      if (time - target.time <= TIMING.good) break
      if (this.grades[this.cursor] === null) {
        this.grades[this.cursor] = 'miss'
        onMiss({ targetIndex: this.cursor, grade: 'miss', offset: Number.NaN })
      }
      this.cursor++
    }
  }

  get finished(): boolean {
    return this.cursor >= this.targets.length
  }
}

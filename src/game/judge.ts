import type { FrettedNote } from '@/domain/tracks/types'
import { isChord, matchChord } from './chordMatch'
import { ACCEPT_OCTAVE_ERRORS, CHORD_TOLERANCE, PITCH_TOLERANCE_SEMITONES, TIMING } from './config'

// Судейство: сопоставление сыгранных нот с нотами трека.
// Цель — одна нота или аккорд (одновременные ноты). Засчитываем по высоте, а не по струне/ладу.
// Аккорд: в строгом режиме — по хромаграмме (прозвучал ли именно этот аккорд),
// иначе — если вовремя прозвучала любая его нота.

export type Grade = 'perfect' | 'good' | 'miss'

export interface Target {
  time: number
  midis: readonly number[]
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
  const targets: { time: number; midis: number[]; strings: number[]; noteIndices: number[] }[] = []
  notes.forEach((note, index) => {
    if (note.stringIndex < 0) return
    const last = targets.at(-1)
    if (last && note.time - last.time <= CHORD_TOLERANCE) {
      last.midis.push(note.midi)
      last.strings.push(note.stringIndex)
      last.noteIndices.push(index)
    } else {
      targets.push({
        time: note.time,
        midis: [note.midi],
        strings: [note.stringIndex],
        noteIndices: [index],
      })
    }
  })
  return targets
}

export function pitchMatches(played: number, expected: number): boolean {
  const d = played - expected
  if (Math.abs(d) <= PITCH_TOLERANCE_SEMITONES) return true
  return ACCEPT_OCTAVE_ERRORS && Math.abs(Math.abs(d) - 12) <= PITCH_TOLERANCE_SEMITONES
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

  /** Сыгранная нота в момент time (время трека) → оценка, если совпала с целью */
  play(time: number, midi: number): Judgment | null {
    const { best, bestOffset } = this.nearest(
      time,
      (target, i) => !this.chords[i] && target.midis.some((m) => pitchMatches(midi, m)),
    )
    if (best >= 0) return this.decide(best, bestOffset)
    // Высота от удара по аккорду, который судится по хроме, — не «лишняя нота»
    if (this.nearest(time, (_, i) => this.chords[i]!).best < 0) this.extraNotes++
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

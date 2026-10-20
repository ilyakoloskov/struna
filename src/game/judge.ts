import type { FrettedNote } from '@/domain/tracks/types'
import { ACCEPT_OCTAVE_ERRORS, CHORD_TOLERANCE, PITCH_TOLERANCE_SEMITONES, TIMING } from './config'

// Судейство: сопоставление сыгранных нот с нотами трека.
// Цель — одна нота или аккорд (одновременные ноты): аккорд засчитывается,
// если вовремя прозвучала любая его нота. Засчитываем по высоте, а не по струне/ладу.

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

  constructor(readonly targets: readonly Target[]) {
    this.grades = targets.map(() => null)
  }

  /** Сыгранная нота в момент time (время трека) → оценка, если совпала с целью */
  play(time: number, midi: number): Judgment | null {
    let best = -1
    let bestOffset = Infinity
    for (let i = this.cursor; i < this.targets.length; i++) {
      const target = this.targets[i]!
      if (target.time - time > TIMING.good) break
      if (this.grades[i] !== null) continue
      const offset = time - target.time
      if (Math.abs(offset) > TIMING.good) continue
      if (!target.midis.some((m) => pitchMatches(midi, m))) continue
      if (Math.abs(offset) < Math.abs(bestOffset)) {
        best = i
        bestOffset = offset
      }
    }
    if (best < 0) {
      this.extraNotes++
      return null
    }
    const grade = gradeForOffset(bestOffset)
    this.grades[best] = grade
    return { targetIndex: best, grade, offset: bestOffset }
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

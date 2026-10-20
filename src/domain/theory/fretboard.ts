import type { Tuning } from '@/domain/music/tunings'

export const MAX_FRETS = 24

/** Отметки на грифе: одиночные точки и двойные (12, 24) */
export const SINGLE_MARKERS: readonly number[] = [3, 5, 7, 9, 15, 17, 19, 21]
export const DOUBLE_MARKERS: readonly number[] = [12, 24]

export function fretMarker(fret: number): 0 | 1 | 2 {
  if (DOUBLE_MARKERS.includes(fret)) return 2
  if (SINGLE_MARKERS.includes(fret)) return 1
  return 0
}

export interface FretPosition {
  /** Индекс струны от самой низкой */
  stringIndex: number
  fret: number
  midi: number
}

export interface FretRange {
  from: number
  to: number
}

export function clampFretRange(range: FretRange): FretRange {
  const from = Math.max(0, Math.min(MAX_FRETS - 1, Math.round(range.from)))
  const to = Math.max(from + 1, Math.min(MAX_FRETS, Math.round(range.to)))
  return { from, to }
}

/** Разбор «0-15» из URL */
export function parseFretRange(text: string): FretRange | null {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(text)
  if (!match) return null
  const from = Number(match[1])
  const to = Number(match[2])
  if (from >= to || to > MAX_FRETS) return null
  return { from, to }
}

export function formatFretRange(range: FretRange): string {
  return `${range.from}-${range.to}`
}

/** Все позиции, где звучит эта высота (точный MIDI), в диапазоне ладов */
export function positionsOf(tuning: Tuning, midi: number, range: FretRange): FretPosition[] {
  const positions: FretPosition[] = []
  tuning.strings.forEach((string, stringIndex) => {
    const fret = midi - string.midi
    if (fret >= range.from && fret <= range.to) positions.push({ stringIndex, fret, midi })
  })
  return positions
}

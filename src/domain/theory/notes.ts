// Нота с правильным написанием: буква + альтерация.
// Высота (pitch class) у E♯ и F одинаковая, но это разные ноты — в фа-диез мажоре пишется E♯.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

/** Высота букв без знаков, полутона от C */
const LETTER_CHROMA: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export interface SpelledNote {
  letter: Letter
  /** Альтерация: −2 = 𝄫, −1 = ♭, 0, 1 = ♯, 2 = 𝄪 */
  alt: number
}

export function note(letter: Letter, alt = 0): SpelledNote {
  return { letter, alt }
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter)
}

export function letterChroma(letter: Letter): number {
  return LETTER_CHROMA[letter]
}

/** Высота без октавы, 0…11 */
export function chroma(n: SpelledNote): number {
  return mod(LETTER_CHROMA[n.letter] + n.alt, 12)
}

export function isSameNote(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.alt === b.alt
}

const ACCIDENTAL_SYMBOLS: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }

export function accidentalSymbol(alt: number): string {
  return ACCIDENTAL_SYMBOLS[alt] ?? (alt > 0 ? '♯'.repeat(alt) : '♭'.repeat(-alt))
}

/** «F♯», «B♭», «F𝄪» */
export function formatNote(n: SpelledNote): string {
  return `${n.letter}${accidentalSymbol(n.alt)}`
}

/** ASCII-запись для URL: «F#», «Bb», «F##» */
export function toAscii(n: SpelledNote): string {
  return `${n.letter}${n.alt > 0 ? '#'.repeat(n.alt) : 'b'.repeat(-n.alt)}`
}

/** Разбор «F#», «F♯», «Bb», «B♭», «F##», «Fx», «F𝄪», «Bbb», «B𝄫» */
export function parseSpelledNote(text: string): SpelledNote | null {
  const match = /^([A-Ga-g])(#{1,2}|♯{1,2}|x|𝄪|b{1,2}|♭{1,2}|𝄫)?$/u.exec(text.trim())
  if (!match) return null
  const letter = match[1]!.toUpperCase() as Letter
  const acc = match[2] ?? ''
  let alt = 0
  if (acc === 'x' || acc === '𝄪') alt = 2
  else if (acc === '𝄫') alt = -2
  else if (acc.startsWith('#') || acc.startsWith('♯')) alt = [...acc].length
  else if (acc.startsWith('b') || acc.startsWith('♭')) alt = -[...acc].length
  return { letter, alt }
}

/**
 * Позиция ноты на квинтовом круге: C = 0, G = 1, … F = −1, B♭ = −2.
 * Для мажорной тональности это число знаков (плюс — диезы, минус — бемоли).
 */
export function fifthsOf(n: SpelledNote): number {
  const LETTER_FIFTHS: Record<Letter, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 }
  return LETTER_FIFTHS[n.letter] + 7 * n.alt
}

/** Октава ноты с учётом написания: у B♯3 высота как у C4, а у C♭4 — как у B3 */
export function octaveOf(n: SpelledNote, midi: number): number {
  const naturalMidi = midi - n.alt
  return Math.floor(naturalMidi / 12) - 1
}

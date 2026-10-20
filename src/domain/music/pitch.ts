// Базовые преобразования высоты: частота ↔ MIDI, центы, имена нот.
// Полноценная теория (написание по тональности, интервалы) появится на этапе 3.

export const DEFAULT_A4 = 440

export type Accidental = 'sharp' | 'flat'

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const

const LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export interface NoteName {
  /** Название без октавы: «E», «F♯», «B♭» */
  name: string
  /** Научная нотация октавы: E2 — шестая струна стандартного строя */
  octave: number
}

/** MIDI-номер (дробный) по частоте */
export function freqToMidi(freq: number, a4 = DEFAULT_A4): number {
  return 69 + 12 * Math.log2(freq / a4)
}

/** Частота по MIDI-номеру (допускается дробный) */
export function midiToFreq(midi: number, a4 = DEFAULT_A4): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

/** Отклонение частоты от эталона в центах */
export function centsBetween(freq: number, reference: number): number {
  return 1200 * Math.log2(freq / reference)
}

export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}

export function midiToNoteName(midi: number, accidental: Accidental = 'sharp'): NoteName {
  const rounded = Math.round(midi)
  const names = accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES
  return { name: names[pitchClass(rounded)]!, octave: Math.floor(rounded / 12) - 1 }
}

export function formatNote(midi: number, accidental: Accidental = 'sharp'): string {
  const { name, octave } = midiToNoteName(midi, accidental)
  return `${name}${octave}`
}

/**
 * Разбор записи ноты: «E2», «Eb2», «E♭2», «F#3», «C♯4».
 * Возвращает MIDI-номер или null, если запись некорректна.
 */
export function parseNote(note: string): number | null {
  const match = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/.exec(note.trim())
  if (!match) return null
  const [, letter, accidental, octave] = match
  let pc = LETTER_TO_PC[letter!.toUpperCase()]!
  if (accidental === '#' || accidental === '♯') pc += 1
  if (accidental === 'b' || accidental === '♭') pc -= 1
  return (Number(octave) + 1) * 12 + pc
}

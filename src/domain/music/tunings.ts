import { midiToNoteName, parseNote, type Accidental } from './pitch'

// Строй — единый источник правды для тюнера, расчёта ладов и подписей струн.

export type TuningId =
  '6-standard-e' | '6-drop-d' | '6-eb-standard' | '7-standard-b' | '7-drop-a' | 'custom'

export interface TuningString {
  /** Номер струны как у гитаристов: 1 — самая высокая */
  number: number
  midi: number
  /** Название без октавы: «E», «E♭» */
  name: string
  octave: number
}

export interface Tuning {
  id: TuningId
  label: string
  /** Струны от самой низкой к самой высокой (по возрастанию высоты) */
  strings: readonly TuningString[]
  accidental: Accidental
}

export const STRING_COUNTS = [6, 7] as const
export type StringCount = (typeof STRING_COUNTS)[number]

/** Допустимый диапазон для своего строя: от A0 до A4 */
export const CUSTOM_NOTE_RANGE = { min: 21, max: 69 } as const

/**
 * Создаёт строй из записей нот от низкой струны к высокой: ['E2', 'A2', …].
 * Бросает ошибку на некорректной записи — пресеты проверяются тестами.
 */
export function createTuning(id: TuningId, label: string, notes: readonly string[]): Tuning {
  const accidental: Accidental = notes.some((n) => /[b♭]\d$/.test(n)) ? 'flat' : 'sharp'
  const strings = notes.map((note, index) => {
    const midi = parseNote(note)
    if (midi === null) throw new Error(`Некорректная нота в строе: ${note}`)
    const { name, octave } = midiToNoteName(midi, accidental)
    return { number: notes.length - index, midi, name, octave }
  })
  return { id, label, strings, accidental }
}

export const TUNING_PRESETS: readonly Tuning[] = [
  createTuning('7-standard-b', '7 стр. · Standard B', ['B1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  createTuning('7-drop-a', '7 стр. · Drop A', ['A1', 'E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  createTuning('6-standard-e', '6 стр. · Standard E', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  createTuning('6-drop-d', '6 стр. · Drop D', ['D2', 'A2', 'D3', 'G3', 'B3', 'E4']),
  createTuning('6-eb-standard', '6 стр. · E♭ Standard', ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4']),
]

export const DEFAULT_TUNING_ID: TuningId = '7-standard-b'

export function findPreset(id: string): Tuning | undefined {
  return TUNING_PRESETS.find((t) => t.id === id)
}

/** Свой строй из MIDI-номеров (от низкой струны к высокой) */
export function createCustomTuning(midis: readonly number[]): Tuning {
  const notes = midis.map((m) => {
    const { name, octave } = midiToNoteName(m, 'sharp')
    return `${name.replace('♯', '#')}${octave}`
  })
  return createTuning('custom', `${midis.length} стр. · Свой строй`, notes)
}

/** Стартовые ноты своего строя — стандарт для выбранного числа струн */
export function defaultCustomMidis(count: StringCount): number[] {
  const base = findPreset(count === 7 ? '7-standard-b' : '6-standard-e')!
  return base.strings.map((s) => s.midi)
}

export function isValidCustomMidis(midis: unknown): midis is number[] {
  return (
    Array.isArray(midis) &&
    (midis.length === 6 || midis.length === 7) &&
    midis.every(
      (m) => Number.isInteger(m) && m >= CUSTOM_NOTE_RANGE.min && m <= CUSTOM_NOTE_RANGE.max,
    )
  )
}

export function lowestMidi(tuning: Tuning): number {
  return Math.min(...tuning.strings.map((s) => s.midi))
}

export function highestMidi(tuning: Tuning): number {
  return Math.max(...tuning.strings.map((s) => s.midi))
}

/** Индекс струны, открытая нота которой ближе всего к высоте (дробный MIDI) */
export function nearestStringIndex(tuning: Tuning, midi: number): number {
  let best = 0
  let bestDistance = Infinity
  tuning.strings.forEach((s, index) => {
    const distance = Math.abs(midi - s.midi)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

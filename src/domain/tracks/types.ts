import type { NoteTechnique } from './technique'

// Модель трека, независимая от формата файла (MIDI, Guitar Pro)

export interface NoteEvent {
  midi: number
  /** Начало, секунды от начала трека */
  time: number
  /** Длительность, секунды */
  duration: number
  /** Громкость 0…1 */
  velocity: number
}

export interface TrackInstrument {
  /** Программа General MIDI 0…127 */
  program: number
  /** Название GM: «distortion guitar» */
  name: string
  /** Семейство GM: «guitar», «bass», «piano» */
  family: string
  /** Ударные (10-й канал) */
  percussion: boolean
}

export interface SongTrack {
  /** Индекс в исходном файле — стабильный идентификатор дорожки */
  index: number
  name: string
  instrument: TrackInstrument
  notes: readonly NoteEvent[]
  /**
   * Позиции нот на грифе из файла (Guitar Pro) — по индексу notes; у MIDI нет.
   * Используются как есть, если строй совпадает с выбранным.
   */
  positions?: readonly NotePosition[]
  /** Приёмы исполнения по индексу notes (Guitar Pro); undefined — обычная нота */
  techniques?: readonly (NoteTechnique | undefined)[]
  /** Строй дорожки из файла, MIDI от низкой струны к высокой */
  tuning?: readonly number[]
}

export interface NotePosition {
  /** Индекс струны от самой низкой */
  stringIndex: number
  fret: number
}

export interface Beat {
  time: number
  /** Сильная доля — первая в такте */
  downbeat: boolean
}

export interface Song {
  name: string
  duration: number
  /** Темп в начале трека */
  bpm: number
  /** Размер в начале трека: [4, 4] */
  timeSignature: readonly [number, number]
  /** Сетка долей для метронома с учётом смен темпа и размера */
  beats: readonly Beat[]
  tracks: readonly SongTrack[]
}

/** Нота гитарной партии с позицией на грифе */
export interface FrettedNote extends NoteEvent {
  /** Индекс струны от самой низкой; −1 — нельзя сыграть в этом строе */
  stringIndex: number
  fret: number
  technique?: NoteTechnique
}

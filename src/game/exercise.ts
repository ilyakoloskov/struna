import { pitchClass } from '@/domain/music/pitch'
import type { Tuning } from '@/domain/music/tunings'
import type { FretRange } from '@/domain/theory/fretboard'
import { chroma, formatNote } from '@/domain/theory/notes'
import { positionRun, type ScalePosition } from '@/domain/theory/positions'
import type { Scale } from '@/domain/theory/scales'
import { assignFingering } from '@/domain/tracks/fingering'
import type { Beat, FrettedNote, NoteEvent, Song } from '@/domain/tracks/types'

// Упражнение «сыграй гамму вверх-вниз» в выбранном диапазоне ладов: восьмыми под метроном.
// От самой низкой тоники в диапазоне вверх до самой высокой ноты гаммы (не больше двух октав) и обратно.

export const EXERCISE_DEFAULT_BPM = 80
export const EXERCISE_MIN_BPM = 40
export const EXERCISE_MAX_BPM = 200
/** Длинная тоника в конце, в долях */
const FINAL_BEATS = 2
const MAX_OCTAVES = 2

export interface Exercise {
  song: Song
  notes: FrettedNote[]
}

/** Высоты гаммы, доступные в диапазоне ладов хоть на одной струне */
export function playablePitches(tuning: Tuning, scale: Scale, range: FretRange): number[] {
  const classes = new Set(scale.notes.map((n) => chroma(n.note)))
  const pitches = new Set<number>()
  for (const string of tuning.strings) {
    for (let fret = range.from; fret <= range.to; fret++) {
      const midi = string.midi + fret
      if (classes.has(pitchClass(midi))) pitches.add(midi)
    }
  }
  return [...pitches].sort((a, b) => a - b)
}

export function scaleRun(tuning: Tuning, scale: Scale, range: FretRange): number[] {
  const pitches = playablePitches(tuning, scale, range)
  const tonic = chroma(scale.tonic)
  const start = pitches.findIndex((m) => pitchClass(m) === tonic)
  if (start < 0) return []
  const top = pitches[start]! + 12 * MAX_OCTAVES
  const up = pitches.slice(start).filter((m) => m <= top)
  return [...up, ...up.slice(0, -1).reverse()]
}

export function createScaleExercise(
  tuning: Tuning,
  scale: Scale,
  range: FretRange,
  bpm = EXERCISE_DEFAULT_BPM,
): Exercise | null {
  const run = scaleRun(tuning, scale, range)
  if (run.length < 2) return null
  const name = `${formatNote(scale.tonic)} ${scale.type.title} · лады ${range.from}–${range.to}`
  const exercise = buildExercise(run, bpm, name)
  return {
    ...exercise,
    notes: assignFingering(exercise.song.tracks[0]!.notes, tuning, {
      minFret: range.from,
      maxFret: range.to,
    }),
  }
}

/** Упражнение в позиции (бокс или форма CAGED): ровно её клетки вверх и вниз */
export function createPositionExercise(
  tuning: Tuning,
  scale: Scale,
  position: ScalePosition,
  bpm = EXERCISE_DEFAULT_BPM,
): Exercise | null {
  const up = positionRun(tuning, position)
  if (up.length < 2) return null
  const items = [...up, ...up.slice(0, -1).reverse()]
  const name = `${formatNote(scale.tonic)} ${scale.type.title} · ${position.label.toLowerCase()}`
  const exercise = buildExercise(
    items.map((i) => i.midi),
    bpm,
    name,
  )
  const events = exercise.song.tracks[0]!.notes
  return {
    ...exercise,
    notes: events.map((note, i) => ({ ...note, ...items[i]!.cell })),
  }
}

/** Песня упражнения: такт на подготовку, восьмые, длинная последняя нота */
function buildExercise(run: readonly number[], bpm: number, name: string): { song: Song } {
  const beat = 60 / bpm
  const step = beat / 2
  // Такт тишины в начале — отсчёт транспорта уже даёт вступление, а это время на подготовку руки
  const offset = 4 * beat
  const events: NoteEvent[] = run.map((midi, i) => {
    const last = i === run.length - 1
    return {
      midi,
      time: offset + i * step,
      duration: (last ? FINAL_BEATS * beat : step) * 0.95,
      velocity: 0.8,
    }
  })
  const duration = offset + (run.length - 1) * step + FINAL_BEATS * beat + beat
  const beatCount = Math.ceil(duration / beat)
  const beats: Beat[] = Array.from({ length: beatCount }, (_, i) => ({
    time: i * beat,
    downbeat: i % 4 === 0,
  }))
  return {
    song: {
      name,
      duration,
      bpm,
      timeSignature: [4, 4],
      beats,
      tracks: [
        {
          index: 0,
          name: 'Упражнение',
          instrument: {
            program: 27,
            name: 'electric guitar (clean)',
            family: 'guitar',
            percussion: false,
          },
          notes: events,
        },
      ],
    },
  }
}

/** Ключ трека упражнения для истории прогресса: «exercise:E:aeolian:5-9:7-standard-b» */
export function exerciseTrackId(
  key: string,
  mode: string,
  range: FretRange,
  tuningId: string,
  position?: { number: number; system: string },
): string {
  const where = position ? `${position.system}${position.number}` : `${range.from}-${range.to}`
  return `exercise:${key}:${mode}:${where}:${tuningId}`
}

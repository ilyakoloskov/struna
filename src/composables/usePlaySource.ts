import { computed, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { parseFretRange } from '@/domain/theory/fretboard'
import { parseSpelledNote } from '@/domain/theory/notes'
import { buildScale, findScale } from '@/domain/theory/scales'
import { createDemoSong } from '@/domain/tracks/demoSong'
import { assignFingering, chartNotesFor } from '@/domain/tracks/fingering'
import type { Beat, FrettedNote, Song } from '@/domain/tracks/types'
import {
  EXERCISE_DEFAULT_BPM,
  EXERCISE_MAX_BPM,
  EXERCISE_MIN_BPM,
  createPositionExercise,
  createScaleExercise,
  exerciseTrackId,
} from '@/game/exercise'
import { scalePositions } from '@/domain/theory/positions'
import { TEST_BPM, createTestPattern, testPatternDuration } from '@/game/lane/testPattern'
import { guitarTrackOf, useLibraryStore } from '@/stores/library'
import { useSettingsStore } from '@/stores/settings'

// Что играем на экране игры:
//  /play/test      — тестовые ноты без звука
//  /play/demo      — демо-трек
//  /play/exercise  — упражнение на гамму (?key=E&mode=aeolian&frets=5-9&bpm=80)
//  /play/:id       — трек из библиотеки

export type PlayKind = 'test' | 'demo' | 'exercise' | 'library'

export interface PlaySource {
  kind: PlayKind
  /** Ключ для результатов и рекордов */
  trackId: string
  song: Song | null
  notes: readonly FrettedNote[]
  beats: readonly Beat[]
  guitarTrackIndex: number
}

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value) as string | undefined

export function usePlaySource(trackId: Ref<string>) {
  const route = useRoute()
  const library = useLibraryStore()
  const { tuning, tuningId } = storeToRefs(useSettingsStore())

  const kind = computed<PlayKind>(() =>
    trackId.value === 'test' || trackId.value === 'demo' || trackId.value === 'exercise'
      ? trackId.value
      : 'library',
  )

  const exercise = computed(() => {
    if (kind.value !== 'exercise') return null
    const key = first(route.query.key) ?? 'E'
    const mode = first(route.query.mode) ?? 'aeolian'
    const tonic = parseSpelledNote(key)
    const type = findScale(mode)
    const range = parseFretRange(first(route.query.frets) ?? '') ?? { from: 0, to: 4 }
    const bpm = Math.min(
      EXERCISE_MAX_BPM,
      Math.max(EXERCISE_MIN_BPM, Number(first(route.query.bpm)) || EXERCISE_DEFAULT_BPM),
    )
    if (!tonic || !type) return null
    const scale = buildScale(tonic, type)
    // Позиция (бокс или форма CAGED) — играются ровно её клетки
    const system = first(route.query.sys) === 'caged' ? 'caged' : 'boxes'
    const positionNumber = Number(first(route.query.pos)) || 0
    const position = positionNumber
      ? scalePositions(tuning.value, scale, system)[positionNumber - 1]
      : undefined
    const generated = position
      ? createPositionExercise(tuning.value, scale, position, bpm)
      : createScaleExercise(tuning.value, scale, range, bpm)
    const id = exerciseTrackId(
      key,
      type.id,
      range,
      tuningId.value,
      position ? { number: positionNumber, system } : undefined,
    )
    return generated && { ...generated, id }
  })

  const source = computed<PlaySource | null>(() => {
    const stringCount = tuning.value.strings.length
    switch (kind.value) {
      case 'test': {
        const beats: Beat[] = Array.from(
          { length: (testPatternDuration() * TEST_BPM) / 60 },
          (_, i) => ({ time: (i * 60) / TEST_BPM, downbeat: i % 4 === 0 }),
        )
        return {
          kind: 'test',
          trackId: 'test',
          song: null,
          notes: createTestPattern(stringCount),
          beats,
          guitarTrackIndex: 0,
        }
      }
      case 'exercise': {
        const ex = exercise.value
        if (!ex) return null
        return {
          kind: 'exercise',
          trackId: ex.id,
          song: ex.song,
          notes: ex.notes,
          beats: ex.song.beats,
          guitarTrackIndex: 0,
        }
      }
      case 'demo': {
        const song = createDemoSong()
        return {
          kind: 'demo',
          trackId: 'demo',
          song,
          notes: assignFingering(song.tracks[0]!.notes, tuning.value),
          beats: song.beats,
          guitarTrackIndex: 0,
        }
      }
      default: {
        const track = library.find(trackId.value)
        if (!track) return null
        const guitar = guitarTrackOf(track)
        return {
          kind: 'library',
          trackId: track.id,
          song: track.song,
          notes: guitar ? chartNotesFor(guitar, tuning.value) : [],
          beats: track.song.beats,
          guitarTrackIndex: track.guitarTrackIndex ?? 0,
        }
      }
    }
  })

  /** Источник ещё грузится (библиотека из IndexedDB) */
  const pending = computed(() => kind.value === 'library' && !library.loaded)

  return { kind, source, pending }
}

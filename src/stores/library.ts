import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { createDemoSong } from '@/domain/tracks/demoSong'
import { guessGuitarTrack, parseMidi } from '@/domain/tracks/midiImport'
import type { Song, SongTrack } from '@/domain/tracks/types'
import { repository, requestPersistentStorage, type StoredTrack, type TrackFormat } from '@/storage'

// Библиотека треков: в памяти для UI, на диске — IndexedDB (доступна офлайн).
// Исходные байты файла хранятся только в базе, в памяти не держим.

export type LibraryTrack = Omit<StoredTrack, 'source'>

export const useLibraryStore = defineStore('library', () => {
  const tracks = shallowRef<LibraryTrack[]>([])
  const selectedId = ref<string | null>(null)
  const loaded = ref(false)
  const loadError = ref<string | null>(null)
  let loading: Promise<void> | null = null

  const selected = computed(() => tracks.value.find((t) => t.id === selectedId.value) ?? null)

  /** Загрузка из IndexedDB; повторные вызовы ждут ту же загрузку */
  function load(): Promise<void> {
    loading ??= (async () => {
      try {
        const stored = await repository.listTracks()
        tracks.value = stored.map(toLibraryTrack)
        selectedId.value ??= tracks.value[0]?.id ?? null
      } catch (error) {
        loadError.value = error instanceof Error ? error.message : String(error)
      } finally {
        loaded.value = true
      }
    })()
    return loading
  }

  async function add(
    song: Song,
    fileName: string,
    format: TrackFormat,
    source?: ArrayBuffer,
  ): Promise<LibraryTrack> {
    const track: LibraryTrack = {
      id: crypto.randomUUID(),
      fileName,
      format,
      song,
      guitarTrackIndex: guessGuitarTrack(song),
      addedAt: Date.now(),
    }
    tracks.value = [track, ...tracks.value]
    selectedId.value = track.id
    await repository.saveTrack({ ...track, source })
    void requestPersistentStorage()
    return track
  }

  async function importFile(file: File): Promise<LibraryTrack> {
    const bytes = await file.arrayBuffer()
    if (isGuitarProFile(file.name)) {
      // alphaTab тяжёлый — грузим только когда выбран файл Guitar Pro
      const [at, gp] = await Promise.all([
        import('@coderline/alphatab'),
        import('@/domain/tracks/gpImport'),
      ])
      const song = gp.scoreToSong(at, gp.loadGpScore(at, new Uint8Array(bytes)), file.name)
      return add(song, file.name, 'gp', bytes)
    }
    const song = parseMidi(bytes, file.name)
    return add(song, file.name, 'midi', bytes)
  }

  function addDemo(): Promise<LibraryTrack> {
    return add(createDemoSong(), 'demo', 'demo')
  }

  async function setGuitarTrack(id: string, index: number | null) {
    tracks.value = tracks.value.map((t) => (t.id === id ? { ...t, guitarTrackIndex: index } : t))
    await repository.updateTrack(id, { guitarTrackIndex: index })
  }

  async function remove(id: string) {
    tracks.value = tracks.value.filter((t) => t.id !== id)
    if (selectedId.value === id) selectedId.value = tracks.value[0]?.id ?? null
    await repository.deleteTrack(id)
  }

  function find(id: string): LibraryTrack | undefined {
    return tracks.value.find((t) => t.id === id)
  }

  return {
    tracks,
    selectedId,
    selected,
    loaded,
    loadError,
    load,
    add,
    importFile,
    addDemo,
    setGuitarTrack,
    remove,
    find,
  }
})

/** Трек для памяти — без исходных байтов файла */
function toLibraryTrack(stored: StoredTrack): LibraryTrack {
  return {
    id: stored.id,
    fileName: stored.fileName,
    format: stored.format,
    song: stored.song,
    guitarTrackIndex: stored.guitarTrackIndex,
    addedAt: stored.addedAt,
  }
}

export const GUITAR_PRO_EXTENSIONS = ['.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.gp7'] as const

export function isGuitarProFile(name: string): boolean {
  const lower = name.toLowerCase()
  return GUITAR_PRO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function guitarTrackOf(track: LibraryTrack): SongTrack | undefined {
  return track.song.tracks.find((t) => t.index === track.guitarTrackIndex)
}

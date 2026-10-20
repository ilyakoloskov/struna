import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { createDemoSong } from '@/domain/tracks/demoSong'
import { guessGuitarTrack, parseMidi } from '@/domain/tracks/midiImport'
import type { Song, SongTrack } from '@/domain/tracks/types'

// Библиотека треков. Пока в памяти — на этапе 7 переедет в IndexedDB.

export interface LibraryTrack {
  id: string
  fileName: string
  song: Song
  /** Индекс гитарной дорожки (SongTrack.index) */
  guitarTrackIndex: number | null
  addedAt: number
}

export const useLibraryStore = defineStore('library', () => {
  const tracks = shallowRef<LibraryTrack[]>([])
  const selectedId = ref<string | null>(null)

  const selected = computed(() => tracks.value.find((t) => t.id === selectedId.value) ?? null)

  function add(song: Song, fileName: string): LibraryTrack {
    const track: LibraryTrack = {
      id: crypto.randomUUID(),
      fileName,
      song,
      guitarTrackIndex: guessGuitarTrack(song),
      addedAt: Date.now(),
    }
    tracks.value = [track, ...tracks.value]
    selectedId.value = track.id
    return track
  }

  async function importFile(file: File): Promise<LibraryTrack> {
    const song = parseMidi(await file.arrayBuffer(), file.name)
    return add(song, file.name)
  }

  function addDemo(): LibraryTrack {
    return add(createDemoSong(), 'demo')
  }

  function setGuitarTrack(id: string, index: number | null) {
    tracks.value = tracks.value.map((t) => (t.id === id ? { ...t, guitarTrackIndex: index } : t))
  }

  function remove(id: string) {
    tracks.value = tracks.value.filter((t) => t.id !== id)
    if (selectedId.value === id) selectedId.value = tracks.value[0]?.id ?? null
  }

  function find(id: string): LibraryTrack | undefined {
    return tracks.value.find((t) => t.id === id)
  }

  return { tracks, selectedId, selected, add, importFile, addDemo, setGuitarTrack, remove, find }
})

export function guitarTrackOf(track: LibraryTrack): SongTrack | undefined {
  return track.song.tracks.find((t) => t.index === track.guitarTrackIndex)
}

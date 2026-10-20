import Dexie, { type EntityTable } from 'dexie'
import type { Song } from '@/domain/tracks/types'
import type { SessionResult } from '@/game/results'

// IndexedDB приложения через Dexie: библиотека треков и результаты сессий.
// Настройки — в localStorage (маленькие и нужны синхронно на старте).

export type TrackFormat = 'midi' | 'gp' | 'demo'

export interface StoredTrack {
  id: string
  fileName: string
  format: TrackFormat
  song: Song
  /** Индекс гитарной дорожки (SongTrack.index) */
  guitarTrackIndex: number | null
  addedAt: number
  /** Исходные байты файла — чтобы перечитать, если импорт улучшится (и для Guitar Pro позже) */
  source?: ArrayBuffer
}

export class StrunaDatabase extends Dexie {
  tracks!: EntityTable<StoredTrack, 'id'>
  results!: EntityTable<SessionResult, 'id'>

  constructor(name = 'struna') {
    super(name)
    // Схема: первичный ключ и индексы. Новые версии — только добавлением this.version(N) ниже
    this.version(1).stores({
      tracks: 'id, addedAt',
      results: 'id, trackId, finishedAt, [trackId+score]',
    })
  }
}

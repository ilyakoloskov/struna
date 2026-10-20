import type { SessionResult } from '@/game/results'
import type { StoredTrack, StrunaDatabase } from './db'

// Операции с хранилищем. База передаётся параметром — в тестах это fake-indexeddb.

export function createRepository(db: StrunaDatabase) {
  return {
    /** Треки, новые сверху */
    async listTracks(): Promise<StoredTrack[]> {
      return db.tracks.orderBy('addedAt').reverse().toArray()
    },

    async saveTrack(track: StoredTrack): Promise<void> {
      await db.tracks.put(track)
    },

    async updateTrack(id: string, patch: Partial<Omit<StoredTrack, 'id'>>): Promise<void> {
      await db.tracks.update(id, patch)
    },

    /** Удаляет трек вместе с его результатами */
    async deleteTrack(id: string): Promise<void> {
      await db.transaction('rw', db.tracks, db.results, async () => {
        await db.tracks.delete(id)
        await db.results.where('trackId').equals(id).delete()
      })
    },

    async saveResult(result: SessionResult): Promise<void> {
      await db.results.put(result)
    },

    async getResult(id: string): Promise<SessionResult | undefined> {
      return db.results.get(id)
    },

    /** Все сессии трека по времени — для статистики прогресса */
    async resultsForTrack(trackId: string): Promise<SessionResult[]> {
      return db.results.where('trackId').equals(trackId).sortBy('finishedAt')
    },

    /** Лучший счёт по каждому треку */
    async bestScores(): Promise<Map<string, number>> {
      const best = new Map<string, number>()
      await db.results.each((r) => {
        if ((best.get(r.trackId) ?? -1) < r.score) best.set(r.trackId, r.score)
      })
      return best
    },
  }
}

export type Repository = ReturnType<typeof createRepository>

/**
 * Просим браузер не вытеснять наши данные при нехватке места.
 * Без этого IndexedDB «best effort» и может быть очищена.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

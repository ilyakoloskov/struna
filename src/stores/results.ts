import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { SessionResult } from '@/game/results'
import { repository, requestPersistentStorage } from '@/storage'

// Результаты сессий и рекорды — в IndexedDB; в памяти — для быстрого доступа на экранах
export const useResultsStore = defineStore('results', () => {
  const sessions = shallowRef<SessionResult[]>([])
  const loaded = ref(false)
  let loading: Promise<void> | null = null

  function load(): Promise<void> {
    loading ??= (async () => {
      try {
        // Пока сессий немного — держим все; на тысячах перейдём на запросы по треку
        const best = await repository.bestScores()
        const all: SessionResult[] = []
        for (const trackId of best.keys()) all.push(...(await repository.resultsForTrack(trackId)))
        sessions.value = all.sort((a, b) => a.finishedAt - b.finishedAt)
      } finally {
        loaded.value = true
      }
    })()
    return loading
  }

  async function add(result: SessionResult) {
    sessions.value = [...sessions.value, result]
    await repository.saveResult(result)
    void requestPersistentStorage()
  }

  function get(id: string): SessionResult | undefined {
    return sessions.value.find((s) => s.id === id)
  }

  /** Лучший счёт по треку, не считая указанной сессии */
  function bestScore(trackId: string, exceptId?: string): number | null {
    const scores = sessions.value
      .filter((s) => s.trackId === trackId && s.id !== exceptId)
      .map((s) => s.score)
    return scores.length ? Math.max(...scores) : null
  }

  /** Результаты удалённого трека убираем и из памяти */
  function forgetTrack(trackId: string) {
    sessions.value = sessions.value.filter((s) => s.trackId !== trackId)
  }

  return { sessions, loaded, load, add, get, bestScore, forgetTrack }
})

import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { isPractice } from '@/game/progress'
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
        sessions.value = await repository.listResults()
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

  /** Рекорд трека — только попытки целиком на полном темпе; без указанной сессии */
  function bestScore(trackId: string, exceptId?: string): number | null {
    const scores = sessions.value
      .filter((s) => s.trackId === trackId && s.id !== exceptId && !isPractice(s))
      .map((s) => s.score)
    return scores.length ? Math.max(...scores) : null
  }

  /** Все попытки трека по времени */
  function forTrack(trackId: string): SessionResult[] {
    return sessions.value.filter((s) => s.trackId === trackId)
  }

  /** Результаты удалённого трека убираем и из памяти */
  function forgetTrack(trackId: string) {
    sessions.value = sessions.value.filter((s) => s.trackId !== trackId)
  }

  return { sessions, loaded, load, add, get, bestScore, forTrack, forgetTrack }
})

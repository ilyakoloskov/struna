import { shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { SessionResult } from '@/game/results'

// Результаты сессий. Пока в памяти — на этапе 7 рекорды переедут в IndexedDB.
export const useResultsStore = defineStore('results', () => {
  const sessions = shallowRef<SessionResult[]>([])

  function add(result: SessionResult) {
    sessions.value = [...sessions.value, result]
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

  return { sessions, add, get, bestScore }
})

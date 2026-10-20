import type { SessionResult } from './results'

// Прогресс по треку: точность по попыткам и где чаще всего ошибаешься

export interface ProgressPoint {
  id: string
  finishedAt: number
  accuracy: number
  tempo: number
  practice: boolean
}

/** Попытка — практика (не идёт в рекорд): замедление или петля */
export function isPractice(result: Pick<SessionResult, 'tempo' | 'loop'>): boolean {
  return (result.tempo ?? 1) < 1 || !!result.loop
}

export function progressPoints(sessions: readonly SessionResult[]): ProgressPoint[] {
  return [...sessions]
    .sort((a, b) => a.finishedAt - b.finishedAt)
    .map((s) => ({
      id: s.id,
      finishedAt: s.finishedAt,
      accuracy: s.accuracy,
      tempo: s.tempo ?? 1,
      practice: isPractice(s),
    }))
}

export interface Hotspot {
  start: number
  end: number
  /** Средняя точность участка по всем попыткам */
  accuracy: number
  attempts: number
}

/**
 * Самые проблемные участки по всем попыткам: участки шкалы с нотами
 * сводятся по времени, считается средняя точность, берутся худшие.
 */
export function hotspots(
  sessions: readonly SessionResult[],
  limit = 3,
  threshold = 0.85,
): Hotspot[] {
  const buckets = new Map<string, { start: number; end: number; sum: number; count: number }>()
  for (const session of sessions) {
    for (const segment of session.timeline) {
      if (segment.accuracy === null || segment.notes === 0) continue
      // Ключ — участок, округлённый до секунды: у разных попыток шкалы совпадают по длительности трека
      const key = `${Math.round(segment.start)}-${Math.round(segment.end)}`
      const bucket = buckets.get(key) ?? {
        start: segment.start,
        end: segment.end,
        sum: 0,
        count: 0,
      }
      bucket.sum += segment.accuracy
      bucket.count++
      buckets.set(key, bucket)
    }
  }
  return [...buckets.values()]
    .map((b) => ({ start: b.start, end: b.end, accuracy: b.sum / b.count, attempts: b.count }))
    .filter((h) => h.accuracy < threshold)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit)
    .sort((a, b) => a.start - b.start)
}

/** Точность по струнам по всем попыткам (номер струны → точность) */
export function stringTotals(sessions: readonly SessionResult[]): Map<number, number> {
  const sums = new Map<number, { sum: number; weight: number }>()
  for (const session of sessions) {
    for (const s of session.strings) {
      if (s.accuracy === null || s.notes === 0) continue
      const entry = sums.get(s.number) ?? { sum: 0, weight: 0 }
      entry.sum += s.accuracy * s.notes
      entry.weight += s.notes
      sums.set(s.number, entry)
    }
  }
  return new Map([...sums].map(([n, e]) => [n, e.sum / e.weight]))
}

import type { Song } from '@/domain/tracks/types'

// Чистая логика планирования: курсор по отсортированным событиям и расчёт отсчёта

/** Индекс первого события со временем ≥ time (события отсортированы по времени) */
export function lowerBound(events: readonly { time: number }[], time: number): number {
  let lo = 0
  let hi = events.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (events[mid]!.time < time) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Курсор по событиям: отдаёт порциями всё, что началось до заданного времени */
export class EventCursor<T extends { time: number }> {
  private index = 0

  constructor(private readonly events: readonly T[]) {}

  /** Перемотка: следующими будут события со временем ≥ time */
  seek(time: number): void {
    this.index = lowerBound(this.events, time)
  }

  /** События с временем < until, ещё не выданные */
  take(until: number): T[] {
    const start = this.index
    while (this.index < this.events.length && this.events[this.index]!.time < until) this.index++
    return this.events.slice(start, this.index)
  }

  get done(): boolean {
    return this.index >= this.events.length
  }
}

/** Длительность доли в секундах для темпа и знаменателя размера (bpm считается в четвертях) */
export function beatDuration(bpm: number, denominator: number): number {
  return (60 / bpm) * (4 / denominator)
}

export interface CountIn {
  /** Смещения щелчков от начала отсчёта, с */
  clicks: { offset: number; accent: boolean }[]
  duration: number
}

/** Отсчёт: один такт по начальному темпу и размеру трека */
export function countIn(song: Pick<Song, 'bpm' | 'timeSignature'>): CountIn {
  const [numerator, denominator] = song.timeSignature
  const beat = beatDuration(song.bpm, denominator)
  return {
    clicks: Array.from({ length: numerator }, (_, i) => ({ offset: i * beat, accent: i === 0 })),
    duration: numerator * beat,
  }
}

import { lowerBound } from '@/audio/playback/timeline'

// Выбор нот, попадающих в окно дорожки. Без аллокаций: результат — диапазон индексов
// и проверка конца ноты; ноты отсортированы по времени начала.

export interface TimedEvent {
  time: number
  duration: number
}

export interface VisibleWindow {
  /** Самое раннее время, которое ещё видно (за линией удара) */
  from: number
  /** Самое позднее (дальний край дорожки) */
  to: number
}

export function visibleWindow(songTime: number, lookahead: number, behind: number): VisibleWindow {
  return { from: songTime - behind, to: songTime + lookahead }
}

/** Самая длинная нота — длинные ноты, начавшиеся до окна, тоже видны своим хвостом */
export function maxDuration(events: readonly TimedEvent[]): number {
  let max = 0
  for (const e of events) if (e.duration > max) max = e.duration
  return max
}

/**
 * Вызывает visit для каждой видимой ноты (у которой конец ≥ from и начало ≤ to).
 * Окно передаётся числами, а не объектом — функция вызывается каждый кадр.
 * Возвращает число посещённых нот.
 */
export function forEachVisible<T extends TimedEvent>(
  events: readonly T[],
  from: number,
  to: number,
  longest: number,
  visit: (event: T, index: number) => void,
): number {
  let count = 0
  for (let i = lowerBound(events, from - longest); i < events.length; i++) {
    const event = events[i]!
    if (event.time > to) break
    if (event.time + event.duration < from) continue
    visit(event, i)
    count++
  }
  return count
}

/** Сколько секунд вокруг момента ноты кольцо на линии удара подсвечено */
export const RING_WINDOW = 0.12
/** Длинные ноты держат кольцо подсвеченным, пока звучат */
const SUSTAIN_MIN = 0.4
const SUSTAIN_LEVEL = 0.45

/** Подсветка кольца струны 0…1: вспышка в момент ноты, ровный свет на удержании длинной */
export function ringActivity(songTime: number, note: TimedEvent): number {
  const since = songTime - note.time
  if (Math.abs(since) < RING_WINDOW) return 1 - Math.abs(since) / RING_WINDOW
  if (since > 0 && since < note.duration && note.duration > SUSTAIN_MIN) return SUSTAIN_LEVEL
  return 0
}

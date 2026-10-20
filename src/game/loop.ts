import type { Beat } from '@/domain/tracks/types'

// Петля на фрагмент: границы по тактам и заход за такт перед каждым проходом

export interface LoopRange {
  start: number
  end: number
}

export const MIN_TEMPO = 0.5
export const MAX_TEMPO = 1

/** Сильные доли (начала тактов) */
function downbeats(beats: readonly Beat[]): number[] {
  return beats.filter((b) => b.downbeat).map((b) => b.time)
}

/** Расширяет выделение до целых тактов: начало — к такту не позже start, конец — к такту не раньше end */
export function snapLoop(beats: readonly Beat[], range: LoopRange, duration: number): LoopRange {
  const bars = downbeats(beats)
  if (bars.length === 0)
    return { start: Math.max(0, range.start), end: Math.min(duration, range.end) }
  const start = [...bars].reverse().find((t) => t <= range.start + 1e-6) ?? 0
  const end = bars.find((t) => t >= range.end - 1e-6) ?? duration
  return { start, end: end > start ? end : Math.min(duration, start + 1) }
}

/** Начало захода: на такт раньше начала петли (или начало трека) */
export function leadInStart(beats: readonly Beat[], loopStart: number): number {
  const before = downbeats(beats).filter((t) => t < loopStart - 1e-6)
  return before.at(-1) ?? 0
}

/** «112.5-125» из URL */
export function parseLoop(text: string | undefined, duration: number): LoopRange | null {
  const match = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(text ?? '')
  if (!match) return null
  const start = Number(match[1])
  const end = Math.min(duration, Number(match[2]))
  return end - start >= 0.5 ? { start, end } : null
}

export function formatLoop(range: LoopRange): string {
  const round = (t: number) => Math.round(t * 1000) / 1000
  return `${round(range.start)}-${round(range.end)}`
}

/** Темп из URL в процентах: 50…100, шаг 5 */
export function parseTempo(text: string | undefined): number {
  const percent = Number(text)
  if (!Number.isFinite(percent)) return 1
  const snapped = Math.round(percent / 5) * 5
  return Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, snapped / 100))
}

import type { Tuning } from '@/domain/music/tunings'
import type { LetterGrade } from './config'
import type { Grade, Target } from './judge'
import { accuracyOf, letterGrade, starsFor, type ScoreState } from './score'

// Итоги сессии для экрана результатов: точность по ходу трека и по струнам, сложный участок

/** Участки шкалы — примерно по 5 секунд, от 8 до 32: в коротком участке 1–2 ноты дают шум */
const SEGMENT_SECONDS = 5
const MIN_SEGMENTS = 8
const MAX_SEGMENTS = 32

export function timelineSegments(duration: number): number {
  return Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(duration / SEGMENT_SECONDS)))
}
/** Участок «сложный», если точность ниже этого и в нём достаточно нот */
const HARD_ACCURACY = 0.8
const HARD_MIN_NOTES = 3

export interface TimelineSegment {
  start: number
  end: number
  /** null — в участке нет нот */
  accuracy: number | null
  notes: number
}

export interface StringAccuracy {
  /** Номер струны (1 — самая высокая) */
  number: number
  name: string
  accuracy: number | null
  notes: number
}

export interface SessionResult {
  id: string
  trackId: string
  trackName: string
  tuningLabel: string
  duration: number
  finishedAt: number
  score: number
  maxCombo: number
  perfect: number
  good: number
  miss: number
  extraNotes: number
  accuracy: number
  grade: LetterGrade
  stars: number
  timeline: TimelineSegment[]
  strings: StringAccuracy[]
  /** Самый провальный участок (подряд идущие слабые сегменты) */
  hardest: { start: number; end: number } | null
  /** Струна с наибольшей долей промахов */
  weakestString: number | null
}

interface Tally {
  perfect: number
  good: number
  miss: number
}

const emptyTally = (): Tally => ({ perfect: 0, good: 0, miss: 0 })
const count = (t: Tally) => t.perfect + t.good + t.miss

export function buildTimeline(
  targets: readonly Target[],
  grades: readonly (Grade | null)[],
  duration: number,
  segments = timelineSegments(duration),
): TimelineSegment[] {
  const size = duration > 0 ? duration / segments : 1
  const tallies = Array.from({ length: segments }, emptyTally)
  targets.forEach((target, i) => {
    const grade = grades[i] ?? 'miss'
    const segment = Math.min(segments - 1, Math.max(0, Math.floor(target.time / size)))
    tallies[segment]![grade]++
  })
  return tallies.map((t, i) => ({
    start: i * size,
    end: (i + 1) * size,
    accuracy: count(t) ? accuracyOf(t) : null,
    notes: count(t),
  }))
}

/** Самый провальный участок: подряд идущие слабые сегменты вокруг худшего */
export function findHardest(
  timeline: readonly TimelineSegment[],
): { start: number; end: number } | null {
  const weak = (s: TimelineSegment) =>
    s.accuracy !== null && s.accuracy < HARD_ACCURACY && s.notes >= HARD_MIN_NOTES
  let worst = -1
  timeline.forEach((s, i) => {
    if (weak(s) && (worst < 0 || s.accuracy! < timeline[worst]!.accuracy!)) worst = i
  })
  if (worst < 0) return null
  let from = worst
  let to = worst
  while (from > 0 && weak(timeline[from - 1]!)) from--
  while (to < timeline.length - 1 && weak(timeline[to + 1]!)) to++
  return { start: timeline[from]!.start, end: timeline[to]!.end }
}

export function buildStringStats(
  targets: readonly Target[],
  grades: readonly (Grade | null)[],
  tuning: Tuning,
): StringAccuracy[] {
  const tallies = tuning.strings.map(emptyTally)
  targets.forEach((target, i) => {
    const grade = grades[i] ?? 'miss'
    // Аккорд — одна цель, но в статистику идут все его струны
    for (const s of target.strings) if (tallies[s]) tallies[s]![grade]++
  })
  // От самой низкой струны к высокой, как на макете (7 · B … 1 · E)
  return tuning.strings.map((string, i) => ({
    number: string.number,
    name: string.name,
    accuracy: count(tallies[i]!) ? accuracyOf(tallies[i]!) : null,
    notes: count(tallies[i]!),
  }))
}

export function weakestString(strings: readonly StringAccuracy[]): number | null {
  const played = strings.filter((s) => s.accuracy !== null && s.notes >= HARD_MIN_NOTES)
  if (played.length === 0) return null
  const worst = played.reduce((a, b) => (b.accuracy! < a.accuracy! ? b : a))
  return worst.accuracy! < 1 ? worst.number : null
}

export function buildResult(input: {
  id: string
  trackId: string
  trackName: string
  tuning: Tuning
  duration: number
  targets: readonly Target[]
  grades: readonly (Grade | null)[]
  score: ScoreState
  extraNotes: number
}): SessionResult {
  // Не сыгранные до конца цели (вышли раньше) считаем промахами
  const misses = input.grades.filter((g) => g === null).length
  const counts = {
    perfect: input.score.perfect,
    good: input.score.good,
    miss: input.score.miss + misses,
  }
  const accuracy = accuracyOf(counts)
  const timeline = buildTimeline(input.targets, input.grades, input.duration)
  const strings = buildStringStats(input.targets, input.grades, input.tuning)
  return {
    id: input.id,
    trackId: input.trackId,
    trackName: input.trackName,
    tuningLabel: input.tuning.label,
    duration: input.duration,
    finishedAt: Date.now(),
    score: input.score.score,
    maxCombo: input.score.maxCombo,
    ...counts,
    extraNotes: input.extraNotes,
    accuracy,
    grade: letterGrade(accuracy),
    stars: starsFor(accuracy),
    timeline,
    strings,
    hardest: findHardest(timeline),
    weakestString: weakestString(strings),
  }
}

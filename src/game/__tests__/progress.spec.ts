import { describe, expect, it } from 'vitest'
import { hotspots, isPractice, progressPoints, stringTotals } from '../progress'
import type { SessionResult } from '../results'

const session = (
  id: string,
  finishedAt: number,
  accuracy: number,
  segments: (number | null)[],
  extra: Partial<SessionResult> = {},
): SessionResult =>
  ({
    id,
    finishedAt,
    accuracy,
    timeline: segments.map((a, i) => ({
      start: i * 5,
      end: (i + 1) * 5,
      accuracy: a,
      notes: a === null ? 0 : 4,
    })),
    strings: [
      { number: 6, name: 'E', accuracy: accuracy, notes: 10 },
      { number: 5, name: 'A', accuracy: null, notes: 0 },
    ],
    ...extra,
  }) as SessionResult

describe('progress', () => {
  it('практика — замедление или петля; старые записи без полей — не практика', () => {
    expect(isPractice({ tempo: 0.75 })).toBe(true)
    expect(isPractice({ tempo: 1, loop: { start: 1, end: 2 } })).toBe(true)
    expect(isPractice({})).toBe(false)
  })

  it('точки прогресса по времени', () => {
    const points = progressPoints([
      session('b', 2, 0.9, [], { tempo: 0.75 }),
      session('a', 1, 0.8, []),
    ])
    expect(points.map((p) => [p.id, p.tempo, p.practice])).toEqual([
      ['a', 1, false],
      ['b', 0.75, true],
    ])
  })

  it('проблемные участки — худшие в среднем по попыткам', () => {
    const result = hotspots([
      session('a', 1, 0.8, [1, 0.5, 0.9, 0.6]),
      session('b', 2, 0.85, [1, 0.7, 0.95, 0.4]),
    ])
    expect(result.map((h) => [h.start, Math.round(h.accuracy * 100)])).toEqual([
      [5, 60],
      [15, 50],
    ])
  })

  it('точность по струнам взвешена по числу нот', () => {
    const totals = stringTotals([session('a', 1, 0.5, []), session('b', 2, 1, [])])
    expect(totals.get(6)).toBeCloseTo(0.75)
    expect(totals.has(5)).toBe(false)
  })
})

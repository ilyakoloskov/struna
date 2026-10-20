import { describe, expect, it } from 'vitest'
import {
  buildResult,
  buildStringStats,
  buildTimeline,
  findHardest,
  timelineSegments,
} from '../results'
import type { Grade, Target } from '../judge'
import { EMPTY_SCORE } from '../score'
import { findPreset } from '@/domain/music/tunings'

const target = (time: number, strings = [0]): Target => ({
  time,
  midis: strings.map(() => 40),
  strings,
  noteIndices: [0],
})

describe('timeline', () => {
  it('точность по сегментам, пустые — null', () => {
    const targets = [target(0.5), target(1.5), target(1.6), target(3.5)]
    const grades: Grade[] = ['perfect', 'good', 'miss', 'perfect']
    const timeline = buildTimeline(targets, grades, 4, 4)
    expect(timeline.map((s) => s.accuracy)).toEqual([1, 0.25, null, 1])
    expect(timeline[1]).toMatchObject({ start: 1, end: 2, notes: 2 })
  })

  it('число участков зависит от длины трека', () => {
    expect(timelineSegments(19)).toBe(8)
    expect(timelineSegments(80)).toBe(16)
    expect(timelineSegments(600)).toBe(32)
  })

  it('сложный участок — подряд идущие слабые сегменты вокруг худшего', () => {
    const seg = (accuracy: number | null, i: number) => ({
      start: i,
      end: i + 1,
      accuracy,
      notes: 5,
    })
    const timeline = [1, 0.95, 0.7, 0.4, 0.75, 1].map(seg)
    expect(findHardest(timeline)).toEqual({ start: 2, end: 5 })
    expect(findHardest([1, 0.9].map(seg))).toBeNull()
  })
})

describe('по струнам', () => {
  it('аккорд считается на всех его струнах', () => {
    const tuning = findPreset('6-standard-e')!
    const stats = buildStringStats([target(0, [0, 1]), target(1, [0])], ['perfect', 'miss'], tuning)
    expect(stats[0]).toMatchObject({ number: 6, name: 'E', accuracy: 0.5, notes: 2 })
    expect(stats[1]).toMatchObject({ number: 5, accuracy: 1, notes: 1 })
    expect(stats[5]!.accuracy).toBeNull()
  })
})

describe('buildResult', () => {
  it('недоигранные цели — промахи; оценка и звёзды', () => {
    const targets = Array.from({ length: 10 }, (_, i) => target(i))
    const grades: (Grade | null)[] = [...Array(8).fill('perfect'), null, null]
    const result = buildResult({
      id: 's1',
      trackId: 't1',
      trackName: 'Трек',
      tuning: findPreset('6-standard-e')!,
      duration: 10,
      targets,
      grades,
      score: { ...EMPTY_SCORE, perfect: 8, score: 800, maxCombo: 8 },
      extraNotes: 3,
    })
    expect(result.miss).toBe(2)
    expect(result.accuracy).toBeCloseTo(0.8)
    expect(result.grade).toBe('B')
    expect(result.stars).toBe(3)
    expect(result.extraNotes).toBe(3)
    expect(result.weakestString).toBe(6)
  })
})

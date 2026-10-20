import { describe, expect, it } from 'vitest'
import { EventCursor, beatDuration, countIn, lowerBound } from '../timeline'

const events = [0, 0.5, 0.5, 1, 2.5].map((time, id) => ({ time, id }))

describe('lowerBound', () => {
  it('первое событие не раньше времени', () => {
    expect(lowerBound(events, 0)).toBe(0)
    expect(lowerBound(events, 0.5)).toBe(1)
    expect(lowerBound(events, 0.6)).toBe(3)
    expect(lowerBound(events, 10)).toBe(5)
    expect(lowerBound([], 1)).toBe(0)
  })
})

describe('EventCursor', () => {
  it('выдаёт события порциями без повторов', () => {
    const cursor = new EventCursor(events)
    expect(cursor.take(0.5).map((e) => e.id)).toEqual([0])
    expect(cursor.take(1.2).map((e) => e.id)).toEqual([1, 2, 3])
    expect(cursor.take(1.2)).toEqual([])
    expect(cursor.done).toBe(false)
    expect(cursor.take(100).map((e) => e.id)).toEqual([4])
    expect(cursor.done).toBe(true)
  })

  it('перемотка назад и вперёд', () => {
    const cursor = new EventCursor(events)
    cursor.take(100)
    cursor.seek(0.5)
    expect(cursor.take(0.9).map((e) => e.id)).toEqual([1, 2])
    cursor.seek(2)
    expect(cursor.take(100).map((e) => e.id)).toEqual([4])
  })
})

describe('отсчёт', () => {
  it('доля зависит от темпа и знаменателя', () => {
    expect(beatDuration(120, 4)).toBe(0.5)
    expect(beatDuration(120, 8)).toBe(0.25)
    expect(beatDuration(60, 2)).toBe(2)
  })

  it('такт 4/4 на 120 bpm', () => {
    const result = countIn({ bpm: 120, timeSignature: [4, 4] })
    expect(result.duration).toBe(2)
    expect(result.clicks).toEqual([
      { offset: 0, accent: true },
      { offset: 0.5, accent: false },
      { offset: 1, accent: false },
      { offset: 1.5, accent: false },
    ])
  })

  it('такт 6/8', () => {
    const result = countIn({ bpm: 90, timeSignature: [6, 8] })
    expect(result.clicks).toHaveLength(6)
    expect(result.duration).toBeCloseTo(6 * (60 / 90) * 0.5)
  })
})

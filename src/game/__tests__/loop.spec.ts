import { describe, expect, it } from 'vitest'
import { formatLoop, leadInStart, parseLoop, parseTempo, snapLoop } from '../loop'
import type { Beat } from '@/domain/tracks/types'

// 4/4, доля 0.5 с: такты на 0, 2, 4, 6, 8 …
const beats: Beat[] = Array.from({ length: 40 }, (_, i) => ({
  time: i * 0.5,
  downbeat: i % 4 === 0,
}))

describe('петля', () => {
  it('выделение расширяется до целых тактов', () => {
    expect(snapLoop(beats, { start: 4.7, end: 7.1 }, 20)).toEqual({ start: 4, end: 8 })
    expect(snapLoop(beats, { start: 4, end: 6 }, 20)).toEqual({ start: 4, end: 6 })
  })

  it('заход — с предыдущего такта', () => {
    expect(leadInStart(beats, 6)).toBe(4)
    expect(leadInStart(beats, 0)).toBe(0)
    expect(leadInStart(beats, 6.5)).toBe(6)
  })

  it('петля из URL и обратно', () => {
    expect(parseLoop('112.5-125', 200)).toEqual({ start: 112.5, end: 125 })
    expect(parseLoop(formatLoop({ start: 1 / 3, end: 2 }), 10)).toEqual({ start: 0.333, end: 2 })
    expect(parseLoop('5-5.2', 10)).toBeNull()
    expect(parseLoop('abc', 10)).toBeNull()
    expect(parseLoop(undefined, 10)).toBeNull()
  })

  it('темп из URL: 50…100 % с шагом 5', () => {
    expect(parseTempo('75')).toBe(0.75)
    expect(parseTempo('72')).toBe(0.7)
    expect(parseTempo('30')).toBe(0.5)
    expect(parseTempo('150')).toBe(1)
    expect(parseTempo(undefined)).toBe(1)
  })
})

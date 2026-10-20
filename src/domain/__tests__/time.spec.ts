import { describe, expect, it } from 'vitest'
import { formatClock, formatPrecise } from '../time'

describe('time', () => {
  it('formatClock', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(84.9)).toBe('1:24')
    expect(formatClock(221)).toBe('3:41')
    expect(formatClock(-2)).toBe('0:00')
  })

  it('formatPrecise', () => {
    expect(formatPrecise(1.25)).toBe('0:01.250')
    expect(formatPrecise(61.0004)).toBe('1:01.000')
    expect(formatPrecise(0.0996)).toBe('0:00.100')
  })
})

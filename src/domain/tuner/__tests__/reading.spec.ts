import { describe, expect, it } from 'vitest'
import { computeTunerReading, formatCents, pluralRu, tuneStatus } from '../reading'
import { findPreset } from '@/domain/music/tunings'

const seven = findPreset('7-standard-b')!
const eb = findPreset('6-eb-standard')!

describe('computeTunerReading', () => {
  it('авто-режим: открытая струна подсвечена', () => {
    const reading = computeTunerReading(40.04, seven)
    expect(reading.name).toBe('E')
    expect(reading.octave).toBe(2)
    expect(reading.cents).toBeCloseTo(4)
    expect(reading.stringIndex).toBe(1) // 6-я струна
    expect(reading.status).toBe('close')
  })

  it('авто-режим: нота не на открытой струне', () => {
    const reading = computeTunerReading(41.9, seven)
    expect(reading.name).toBe('F♯')
    expect(reading.stringIndex).toBeNull()
    expect(reading.cents).toBeCloseTo(-10)
  })

  it('режим фиксированной струны: отклонение больше полутона', () => {
    const reading = computeTunerReading(33.5, seven, 0) // играем ~A1, цель B1
    expect(reading.name).toBe('B')
    expect(reading.octave).toBe(1)
    expect(reading.cents).toBeCloseTo(-150)
    expect(reading.status).toBe('flat')
  })

  it('бемольный строй пишется бемолями', () => {
    expect(computeTunerReading(39, eb).name).toBe('E♭')
  })
})

describe('tuneStatus', () => {
  it.each([
    [0, 'in-tune'],
    [-3, 'in-tune'],
    [4, 'close'],
    [-10, 'close'],
    [-11, 'flat'],
    [25, 'sharp'],
  ] as const)('%i центов → %s', (cents, status) => {
    expect(tuneStatus(cents)).toBe(status)
  })
})

describe('formatCents', () => {
  it.each([
    [4, '+4 цента'],
    [-1, '−1 цент'],
    [0, '0 центов'],
    [11, '+11 центов'],
    [21, '+21 цент'],
    [-12.6, '−13 центов'],
  ])('%d → %s', (cents, text) => {
    expect(formatCents(cents)).toBe(text)
  })

  it('pluralRu', () => {
    expect(pluralRu(22, 'a', 'b', 'c')).toBe('b')
    expect(pluralRu(14, 'a', 'b', 'c')).toBe('c')
    expect(pluralRu(101, 'a', 'b', 'c')).toBe('a')
  })
})

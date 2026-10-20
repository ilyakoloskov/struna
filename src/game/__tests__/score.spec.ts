import { describe, expect, it } from 'vitest'
import {
  EMPTY_SCORE,
  accuracyOf,
  applyGrade,
  formatAccuracy,
  formatScore,
  letterGrade,
  multiplierFor,
  multiplierProgress,
  starsFor,
} from '../score'
import type { Grade } from '../judge'

const play = (grades: Grade[]) => grades.reduce(applyGrade, EMPTY_SCORE)

describe('score', () => {
  it('множитель ×1…×4 каждые 10 нот', () => {
    expect([0, 9, 10, 19, 20, 30, 100].map(multiplierFor)).toEqual([1, 1, 2, 2, 3, 4, 4])
    expect(multiplierProgress(13)).toBe(3)
    expect(multiplierProgress(45)).toBe(10)
  })

  it('очки умножаются на множитель после попадания', () => {
    const state = play(Array(10).fill('perfect'))
    // 9 нот по 100×1 и десятая уже ×2
    expect(state.score).toBe(900 + 200)
    expect(state.multiplier).toBe(2)
  })

  it('Miss сбрасывает комбо и множитель, макс. комбо сохраняется', () => {
    const state = play([...Array(12).fill('perfect'), 'miss', 'good'])
    expect(state.combo).toBe(1)
    expect(state.maxCombo).toBe(12)
    expect(state.multiplier).toBe(1)
    expect([state.perfect, state.good, state.miss]).toEqual([12, 1, 1])
  })

  it('точность: Good — половина', () => {
    expect(accuracyOf({ perfect: 3, good: 2, miss: 0 })).toBeCloseTo(0.8)
    expect(accuracyOf({ perfect: 0, good: 0, miss: 0 })).toBe(1)
  })

  it('оценка и звёзды', () => {
    expect([0.99, 0.93, 0.85, 0.7, 0.3].map(letterGrade)).toEqual(['S', 'A', 'B', 'C', 'D'])
    expect([0.99, 0.93, 0.85, 0.7, 0.5, 0.1].map(starsFor)).toEqual([5, 4, 3, 2, 1, 0])
  })

  it('форматирование по-русски', () => {
    expect(formatAccuracy(0.964)).toBe('96,4 %')
    expect(formatScore(128450).replace(/\s/g, ' ')).toBe('128 450')
  })
})

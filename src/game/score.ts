import {
  ACCURACY_WEIGHT,
  GRADE_THRESHOLDS,
  MULTIPLIER,
  POINTS,
  STAR_THRESHOLDS,
  type LetterGrade,
} from './config'
import type { Grade } from './judge'

// Счёт, комбо, множитель и точность — неизменяемое состояние и чистые функции

export interface ScoreState {
  score: number
  combo: number
  maxCombo: number
  multiplier: number
  perfect: number
  good: number
  miss: number
}

export const EMPTY_SCORE: ScoreState = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  perfect: 0,
  good: 0,
  miss: 0,
}

export function multiplierFor(combo: number): number {
  return Math.min(MULTIPLIER.max, 1 + Math.floor(combo / MULTIPLIER.step))
}

/** Сколько нот серии набрано в текущей ступени множителя (0…step−1), на максимуме — step */
export function multiplierProgress(combo: number): number {
  if (multiplierFor(combo) >= MULTIPLIER.max) return MULTIPLIER.step
  return combo % MULTIPLIER.step
}

export function applyGrade(state: ScoreState, grade: Grade): ScoreState {
  if (grade === 'miss') {
    return { ...state, combo: 0, multiplier: 1, miss: state.miss + 1 }
  }
  const combo = state.combo + 1
  const multiplier = multiplierFor(combo)
  return {
    ...state,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    multiplier,
    score: state.score + POINTS[grade] * multiplier,
    perfect: state.perfect + (grade === 'perfect' ? 1 : 0),
    good: state.good + (grade === 'good' ? 1 : 0),
  }
}

/** Точность 0…1 по уже сыгранным целям; до первой оценки — 1 */
export function accuracyOf(counts: Pick<ScoreState, 'perfect' | 'good' | 'miss'>): number {
  const total = counts.perfect + counts.good + counts.miss
  if (total === 0) return 1
  return (counts.perfect * ACCURACY_WEIGHT.perfect + counts.good * ACCURACY_WEIGHT.good) / total
}

export function letterGrade(accuracy: number): LetterGrade {
  return GRADE_THRESHOLDS.find((t) => accuracy >= t.min)?.grade ?? 'D'
}

export function starsFor(accuracy: number): number {
  return STAR_THRESHOLDS.filter((min) => accuracy >= min).length
}

/** «96,4 %» */
export function formatAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

/** «128 450» */
export function formatScore(score: number): string {
  return score.toLocaleString('ru-RU')
}

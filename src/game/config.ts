// Правила игры в одном месте: окна попадания, очки, множитель, оценки

/** Окна попадания по времени, ± секунды */
export const TIMING = {
  perfect: 0.05,
  good: 0.12,
} as const

/** Допуск по высоте: ±50 центов */
export const PITCH_TOLERANCE_SEMITONES = 0.5
/** Засчитывать ошибку детектора на октаву (сыграл E2, детектор услышал E3) */
export const ACCEPT_OCTAVE_ERRORS = true

/** Ноты ближе этого по времени — один аккорд (одна цель) */
export const CHORD_TOLERANCE = 0.03

export const POINTS = { perfect: 100, good: 50 } as const

/** Множитель растёт на 1 каждые `step` нот серии, до `max` */
export const MULTIPLIER = { step: 10, max: 4 } as const

/** Вклад оценок в точность */
export const ACCURACY_WEIGHT = { perfect: 1, good: 0.5 } as const

export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D'

/** Оценка за трек по точности (от лучшей к худшей) */
export const GRADE_THRESHOLDS: readonly { grade: LetterGrade; min: number }[] = [
  { grade: 'S', min: 0.97 },
  { grade: 'A', min: 0.9 },
  { grade: 'B', min: 0.8 },
  { grade: 'C', min: 0.65 },
  { grade: 'D', min: 0 },
]

/** Звёзды: по одной за каждый пройденный порог точности */
export const STAR_THRESHOLDS: readonly number[] = [0.4, 0.65, 0.8, 0.9, 0.97]

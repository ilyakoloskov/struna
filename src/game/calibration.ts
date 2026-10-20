import { medianOf } from '@/audio/dsp/stabilizer'

// Калибровка задержки: игрок бьёт по струне на каждый щелчок метронома.
// Смещение = медиана (удар − щелчок) после отбрасывания выбросов.
// Положительное — удары приходят позже щелчков (задержка не учтена), его вычитаем при судействе.

export const CALIBRATION_CLICKS = 16
export const MIN_VALID_HITS = 8
/** Удар дальше этого от щелчка — не ответ на него */
const MAX_DISTANCE = 0.25
/** Выброс — дальше этого от медианы */
const OUTLIER = 0.06

export interface CalibrationResult {
  offsetMs: number
  /** Разброс ударов (медиана отклонения от медианы), мс — насколько ровно играл */
  spreadMs: number
  used: number
}

export type CalibrationOutcome =
  | { ok: true; result: CalibrationResult }
  | { ok: false; reason: 'too-few-hits' | 'too-inconsistent'; used: number }

export function analyzeCalibration(
  clicks: readonly number[],
  onsets: readonly number[],
): CalibrationOutcome {
  const offsets: number[] = []
  for (const click of clicks) {
    let best: number | null = null
    for (const onset of onsets) {
      const d = onset - click
      if (Math.abs(d) <= MAX_DISTANCE && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
    if (best !== null) offsets.push(best)
  }
  if (offsets.length < MIN_VALID_HITS)
    return { ok: false, reason: 'too-few-hits', used: offsets.length }

  const median = medianOf(offsets)
  const kept = offsets.filter((d) => Math.abs(d - median) <= OUTLIER)
  if (kept.length < MIN_VALID_HITS) {
    return { ok: false, reason: 'too-inconsistent', used: kept.length }
  }
  const offset = medianOf(kept)
  const spread = medianOf(kept.map((d) => Math.abs(d - offset)))
  return {
    ok: true,
    result: {
      offsetMs: Math.round(offset * 1000),
      spreadMs: Math.round(spread * 1000),
      used: kept.length,
    },
  }
}

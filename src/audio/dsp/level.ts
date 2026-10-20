// Уровень сигнала в dBFS и его оценка для индикатора

export const SILENCE_DB = -90

export function amplitudeToDb(amplitude: number): number {
  return amplitude > 0 ? Math.max(SILENCE_DB, 20 * Math.log10(amplitude)) : SILENCE_DB
}

/** Нижняя граница шкалы индикатора */
export const METER_FLOOR_DB = -60
/** Отметка перегруза на шкале */
export const CLIP_WARNING_DB = -3

/** Позиция на шкале индикатора 0…1 */
export function dbToMeter(db: number): number {
  return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB))
}

export type LevelStatus = 'silent' | 'quiet' | 'good' | 'clipping'

export function levelStatus(peakDb: number): LevelStatus {
  if (peakDb >= CLIP_WARNING_DB) return 'clipping'
  if (peakDb >= -30) return 'good'
  if (peakDb >= -55) return 'quiet'
  return 'silent'
}

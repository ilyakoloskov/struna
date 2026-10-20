import { midiToFreq } from '@/domain/music/pitch'

// Параметры анализа выводятся из строя: окно подстраивается под самую низкую струну.
//
// YIN нужно увидеть два периода самой низкой ноты: τmax = sr / fmin и кадр = 2·τmax.
// Drop A (A1 ≈ 55 Гц, fmin ≈ 46.8 Гц) → кадр ≈ 2050 сэмплов ≈ 43 мс при 48 кГц;
// Standard E (E2 ≈ 82 Гц) → ≈ 1370 сэмплов ≈ 29 мс.
// Шаг анализа фиксированный и короткий (~10 мс): окна перекрываются,
// поэтому частота обновления не зависит от длины окна.

/** Запас вниз от самой низкой струны: на случай перестроя ниже и раскачки струны */
export const LOW_MARGIN = 0.85
/** Сколько ладов учитываем вверх от самой высокой открытой струны */
export const MAX_FRET = 24
export const HOP_SIZE = 512

export interface AnalysisConfig {
  sampleRate: number
  minFreq: number
  maxFreq: number
  frameSize: number
  hopSize: number
  /** Срез ФНЧ перед детектором, Гц */
  lowpassHz: number
}

export function createAnalysisConfig(
  sampleRate: number,
  lowestMidi: number,
  highestMidi: number,
  a4?: number,
): AnalysisConfig {
  const minFreq = midiToFreq(lowestMidi, a4) * LOW_MARGIN
  // Верхняя граница: 24-й лад самой высокой струны с запасом на полтона, но не выше sr/4
  const maxFreq = Math.min(midiToFreq(highestMidi + MAX_FRET + 1, a4), sampleRate / 4)
  const frameSize = 2 * Math.ceil(sampleRate / minFreq)
  // Срез с запасом над верхней границей, чтобы фильтр не ослаблял высокие ноты
  const lowpassHz = Math.min(maxFreq * 1.5, sampleRate * 0.45)
  return { sampleRate, minFreq, maxFreq, frameSize, hopSize: HOP_SIZE, lowpassHz }
}

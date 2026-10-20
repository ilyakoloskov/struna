// Детектор высоты тона YIN (de Cheveigné, Kawahara, 2002).
// Работает в AudioWorklet, поэтому detect() ничего не аллоцирует:
// буферы создаются один раз в конструкторе, результат пишется в переиспользуемый объект.

export interface YinOptions {
  sampleRate: number
  /** Длина кадра анализа в сэмплах; должна быть ≥ 2 × максимального периода */
  frameSize: number
  minFreq: number
  maxFreq: number
  /** Порог нормированной разности: меньше — строже (меньше ложных, больше пропусков) */
  threshold?: number
}

export interface PitchEstimate {
  /** Частота в Гц, 0 — высота не найдена */
  freq: number
  /** Уверенность 0…1 (1 − значение нормированной разности в минимуме) */
  clarity: number
}

export const DEFAULT_YIN_THRESHOLD = 0.15

export class YinDetector {
  readonly sampleRate: number
  readonly frameSize: number
  readonly tauMin: number
  readonly tauMax: number
  readonly threshold: number

  /** Длина окна интегрирования разности */
  private readonly integrationSize: number
  /** Нормированная разность d'(τ) */
  private readonly cmnd: Float32Array
  private readonly result: PitchEstimate = { freq: 0, clarity: 0 }

  constructor(options: YinOptions) {
    const { sampleRate, frameSize, minFreq, maxFreq } = options
    this.sampleRate = sampleRate
    this.frameSize = frameSize
    this.threshold = options.threshold ?? DEFAULT_YIN_THRESHOLD
    this.tauMin = Math.max(2, Math.floor(sampleRate / maxFreq))
    this.tauMax = Math.ceil(sampleRate / minFreq)
    if (frameSize < 2 * this.tauMax || this.tauMax <= this.tauMin + 2) {
      throw new Error('Кадр слишком короткий для заданного диапазона частот')
    }
    this.integrationSize = frameSize - this.tauMax
    this.cmnd = new Float32Array(this.tauMax + 2)
  }

  /**
   * Оценка высоты по кадру длиной frameSize.
   * Возвращает один и тот же объект — скопируйте поля, если нужно сохранить.
   */
  detect(frame: Float32Array): PitchEstimate {
    const { tauMin, tauMax, threshold, cmnd } = this
    const w = this.integrationSize
    const result = this.result

    cmnd[0] = 1
    let runningSum = 0
    let dipTau = -1
    let dipMin = Infinity
    let globalMinTau = -1
    let globalMin = Infinity
    // Последний τ, для которого посчитано cmnd
    let computedUpTo = 0

    for (let tau = 1; tau <= tauMax; tau++) {
      // Разностная функция d(τ) = Σ (x[j] − x[j+τ])²
      let sum = 0
      for (let j = 0; j < w; j++) {
        const delta = frame[j]! - frame[j + tau]!
        sum += delta * delta
      }
      runningSum += sum
      const value = runningSum > 0 ? (sum * tau) / runningSum : 1
      cmnd[tau] = value
      computedUpTo = tau

      if (tau < tauMin) continue

      if (value < globalMin) {
        globalMin = value
        globalMinTau = tau
      }

      // Первый провал ниже порога. Берём минимум по всей его ширине, а не первый
      // локальный минимум: у низких нот провал широкий, и шум делает его неровным —
      // классический спуск «до первого роста» останавливается раньше и врёт на десятки центов.
      if (value < threshold) {
        if (value < dipMin) {
          dipMin = value
          dipTau = tau
        }
      } else if (dipTau >= 0) {
        break
      }
    }

    // Ниже порога ничего нет — берём глобальный минимум как неуверенную оценку
    const bestTau = dipTau >= 0 ? dipTau : globalMinTau
    if (bestTau < 0) {
      result.freq = 0
      result.clarity = 0
      return result
    }

    // Параболическая интерполяция для субсэмпловой точности
    let refinedTau = bestTau
    if (bestTau > 1 && bestTau + 1 <= computedUpTo) {
      const s0 = cmnd[bestTau - 1]!
      const s1 = cmnd[bestTau]!
      const s2 = cmnd[bestTau + 1]!
      const denominator = s0 + s2 - 2 * s1
      if (denominator !== 0) refinedTau = bestTau + (s0 - s2) / (2 * denominator)
    }

    result.freq = this.sampleRate / refinedTau
    result.clarity = Math.max(0, Math.min(1, 1 - cmnd[bestTau]!))
    return result
  }
}

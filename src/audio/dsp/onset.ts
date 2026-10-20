// Детектор начала ноты (onset).
// Работает в AudioWorklet на каждом блоке (128 сэмплов ≈ 2.7 мс) — время удара точное,
// а не размытое длинным окном детектора высоты. Без аллокаций.
//
// Атаку ищем по энергии разностного сигнала x[n] − x[n−1] (high-frequency content):
// щелчок медиатора широкополосный и даёт резкий скачок, а ровно звучащая низкая нота
// почти не видна — поэтому повторный удар по звенящей струне тоже ловится.
// Начало ноты — когда одновременно:
//  • общая энергия блока выше порога (шум и затухающие струны не срабатывают),
//  • энергия разности резко выросла относительно своей огибающей,
//  • с прошлого начала прошло «мёртвое» время (одна атака — один onset).

export interface OnsetOptions {
  sampleRate: number
  /** Порог общей энергии блока (средний квадрат); 3e-5 ≈ −45 dBFS */
  minEnergy?: number
  /** Во сколько раз энергия разности должна превысить свою огибающую */
  ratio?: number
  /** Постоянная времени спада огибающей, с */
  envelopeTime?: number
  /** Минимальный интервал между onset, с */
  refractory?: number
}

export class OnsetDetector {
  private readonly minEnergy: number
  private readonly ratio: number
  private readonly envelopeTime: number
  private readonly refractory: number
  private readonly sampleRate: number
  private envelope = 0
  private previous = 0
  private lastOnset = -Infinity

  constructor(options: OnsetOptions) {
    this.sampleRate = options.sampleRate
    this.minEnergy = options.minEnergy ?? 3e-5
    this.ratio = options.ratio ?? 4
    this.envelopeTime = options.envelopeTime ?? 0.03
    this.refractory = options.refractory ?? 0.05
  }

  /**
   * Обрабатывает блок сэмплов, начинающийся в момент time (с).
   * Возвращает силу удара (энергию разности), если в блоке начало ноты, иначе 0.
   */
  process(block: Float32Array, time: number): number {
    let energy = 0
    let flux = 0
    let previous = this.previous
    for (let i = 0; i < block.length; i++) {
      const x = block[i]!
      const d = x - previous
      energy += x * x
      flux += d * d
      previous = x
    }
    this.previous = previous
    energy /= block.length
    flux /= block.length

    const isOnset =
      energy >= this.minEnergy &&
      flux > this.envelope * this.ratio &&
      time - this.lastOnset >= this.refractory

    // Огибающая: мгновенно поднимается на атаке, экспоненциально спадает
    const fall = Math.exp(-block.length / this.sampleRate / this.envelopeTime)
    this.envelope = flux > this.envelope ? flux : this.envelope * fall + flux * (1 - fall)

    if (!isOnset) return 0
    this.lastOnset = time
    return flux
  }

  reset(): void {
    this.envelope = 0
    this.previous = 0
    this.lastOnset = -Infinity
  }
}

import { FFT } from './fft'

// Хромаграмма: энергия спектра, разложенная по 12 нотам (без октав).
// Окно ~85 мс (4096 при 48 кГц): разрешение ~12 Гц не различает соседние ноты у самых низких струн,
// но их обертоны выше 160 Гц разрешаются хорошо и несут ту же ноту — поэтому берём 160 Гц – 2.5 кГц.
// Без аллокаций после создания — используется в AudioWorklet.

export const CHROMA_SIZE = 4096
/**
 * Нижняя граница 160 Гц: при окне 4096 бин шире полутона ниже ~150 Гц, ноты там смешиваются;
 * низкие ноты всё равно слышны своими 2-й и 3-й гармониками (подобрано по набору аккордов в тестах)
 */
export const CHROMA_MIN_HZ = 160
export const CHROMA_MAX_HZ = 2500

export class ChromaAnalyzer {
  private readonly fft: FFT
  private readonly re: Float64Array
  private readonly im: Float64Array
  private readonly window: Float64Array
  /** Нота (0…11) для каждого бина или −1, если бин вне диапазона */
  private readonly binClass: Int8Array
  /** Насколько бин близок к центру ноты (0…1) — бины между нотами весят меньше */
  private readonly binWeight: Float32Array
  readonly chroma = new Float32Array(12)

  constructor(
    readonly sampleRate: number,
    readonly size = CHROMA_SIZE,
    a4 = 440,
  ) {
    this.fft = new FFT(size)
    this.re = new Float64Array(size)
    this.im = new Float64Array(size)
    this.window = new Float64Array(size)
    for (let i = 0; i < size; i++)
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))
    this.binClass = new Int8Array(size / 2).fill(-1)
    this.binWeight = new Float32Array(size / 2)
    for (let k = 1; k < size / 2; k++) {
      const hz = (k * sampleRate) / size
      if (hz < CHROMA_MIN_HZ || hz > CHROMA_MAX_HZ) continue
      const midi = 69 + 12 * Math.log2(hz / a4)
      const nearest = Math.round(midi)
      this.binClass[k] = ((nearest % 12) + 12) % 12
      // Косинусный вес: 1 в центре ноты, 0 на границе ±50 центов
      this.binWeight[k] = Math.cos((midi - nearest) * Math.PI)
    }
  }

  /** Хрома кадра длиной size; нормирована так, что максимум = 1 (тишина — нули) */
  analyze(frame: Float32Array): Float32Array {
    const { re, im, window, chroma } = this
    for (let i = 0; i < this.size; i++) {
      re[i] = (frame[i] ?? 0) * window[i]!
      im[i] = 0
    }
    this.fft.transform(re, im)
    chroma.fill(0)
    for (let k = 1; k < this.size / 2; k++) {
      const pc = this.binClass[k]!
      if (pc < 0) continue
      const magnitude = Math.sqrt(re[k]! * re[k]! + im[k]! * im[k]!)
      chroma[pc]! += magnitude * this.binWeight[k]!
    }
    let max = 0
    for (let i = 0; i < 12; i++) max = Math.max(max, chroma[i]!)
    if (max > 0) for (let i = 0; i < 12; i++) chroma[i]! /= max
    return chroma
  }
}

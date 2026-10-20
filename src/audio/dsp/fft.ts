// БПФ radix-2 (Кули–Тьюки) на месте, для степеней двойки. Без аллокаций после создания:
// таблицы поворотных множителей и перестановки считаются один раз — используется в AudioWorklet.

export class FFT {
  readonly size: number
  private readonly cos: Float64Array
  private readonly sin: Float64Array
  private readonly reversed: Uint32Array

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error('Размер БПФ — степень двойки')
    this.size = size
    this.cos = new Float64Array(size / 2)
    this.sin = new Float64Array(size / 2)
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size)
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size)
    }
    this.reversed = new Uint32Array(size)
    const bits = Math.log2(size)
    for (let i = 0; i < size; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1)
      this.reversed[i] = r
    }
  }

  /** Прямое преобразование на месте: re и im — длины size */
  transform(re: Float64Array, im: Float64Array): void {
    const n = this.size
    for (let i = 0; i < n; i++) {
      const j = this.reversed[i]!
      if (j > i) {
        const tr = re[i]!
        re[i] = re[j]!
        re[j] = tr
        const ti = im[i]!
        im[i] = im[j]!
        im[j] = ti
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let start = 0; start < n; start += len) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step]!
          const wi = this.sin[k * step]!
          const a = start + k
          const b = a + half
          const xr = re[b]! * wr - im[b]! * wi
          const xi = re[b]! * wi + im[b]! * wr
          re[b] = re[a]! - xr
          im[b] = im[a]! - xi
          re[a] = re[a]! + xr
          im[a] = im[a]! + xi
        }
      }
    }
  }
}

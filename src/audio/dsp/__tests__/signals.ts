// Синтетические сигналы для тестов детектора

/** Детерминированный генератор псевдослучайных чисел (mulberry32) */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ToneOptions {
  sampleRate: number
  length: number
  /** Амплитуды гармоник, начиная с основного тона */
  harmonics?: number[]
  noise?: number
  amplitude?: number
  seed?: number
}

/** Гитароподобный тон: у низких струн на звукоснимателе 2-я гармоника громче основного тона */
export const GUITAR_HARMONICS = [0.6, 1, 0.55, 0.4, 0.25, 0.15, 0.1]

export function tone(freq: number, options: ToneOptions): Float32Array {
  const { sampleRate, length, harmonics = GUITAR_HARMONICS, noise = 0, amplitude = 0.3 } = options
  const random = seededRandom(options.seed ?? 1)
  const norm = harmonics.reduce((sum, a) => sum + a, 0)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let sample = 0
    harmonics.forEach((a, h) => {
      sample += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / sampleRate + h)
    })
    out[i] = (amplitude * sample) / norm + noise * (random() * 2 - 1)
  }
  return out
}

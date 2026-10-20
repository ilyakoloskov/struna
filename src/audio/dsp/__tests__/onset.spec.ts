import { describe, expect, it } from 'vitest'
import { OnsetDetector } from '../onset'
import { seededRandom } from './signals'

const SR = 48000
const BLOCK = 128

interface Pluck {
  at: number
  freq: number
  amplitude: number
  /** Струна: новый щипок на той же струне глушит предыдущий */
  string?: number
}

/**
 * Сигнал из щипков: тон с обертонами и затуханием + короткий щелчок медиатора (3 мс шума)
 * в момент атаки. Новый щипок на той же струне глушит предыдущий — как на гитаре.
 */
function render(seconds: number, plucks: Pluck[], noise = 0.001): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR))
  const random = seededRandom(5)
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    let sample = noise * (random() * 2 - 1)
    plucks.forEach((p, k) => {
      if (t < p.at) return
      const next = plucks.slice(k + 1).find((q) => (q.string ?? 0) === (p.string ?? 0))
      if (next && t >= next.at) return
      const age = t - p.at
      const tone =
        Math.sin(2 * Math.PI * p.freq * age) + 0.5 * Math.sin(2 * Math.PI * 2 * p.freq * age)
      sample += p.amplitude * Math.exp(-age * 2.5) * tone * 0.67
      if (age < 0.003) sample += p.amplitude * 0.4 * (random() * 2 - 1)
    })
    out[i] = sample
  }
  return out
}

function detect(signal: Float32Array, options = {}): number[] {
  const detector = new OnsetDetector({ sampleRate: SR, ...options })
  const onsets: number[] = []
  for (let i = 0; i + BLOCK <= signal.length; i += BLOCK) {
    const time = i / SR
    if (detector.process(signal.subarray(i, i + BLOCK), time) > 0) onsets.push(time)
  }
  return onsets
}

describe('OnsetDetector', () => {
  it('находит удары с точностью до блока', () => {
    const onsets = detect(
      render(2, [
        { at: 0.2, freq: 82.4, amplitude: 0.3 },
        { at: 0.7, freq: 110, amplitude: 0.3 },
        { at: 1.3, freq: 146.8, amplitude: 0.3 },
      ]),
    )
    expect(onsets).toHaveLength(3)
    ;[0.2, 0.7, 1.3].forEach((at, i) => expect(Math.abs(onsets[i]! - at)).toBeLessThan(0.006))
  })

  it('длинная звучащая нота — один onset', () => {
    expect(detect(render(3, [{ at: 0.1, freq: 61.7, amplitude: 0.4 }]))).toHaveLength(1)
  })

  it('повторный щипок той же струны, пока звучит предыдущий', () => {
    const onsets = detect(
      render(1.5, [
        { at: 0.1, freq: 82.4, amplitude: 0.3 },
        { at: 0.5, freq: 82.4, amplitude: 0.3 },
      ]),
    )
    expect(onsets).toHaveLength(2)
  })

  it('быстрые шестнадцатые на 160 bpm (≈ 94 мс) различаются', () => {
    const plucks = Array.from({ length: 8 }, (_, i) => ({
      at: 0.1 + i * 0.094,
      freq: 98,
      amplitude: 0.25,
    }))
    expect(detect(render(1.2, plucks))).toHaveLength(8)
  })

  it('шум и тишина не дают ложных срабатываний', () => {
    expect(detect(render(2, [], 0.003))).toEqual([])
    expect(detect(new Float32Array(SR))).toEqual([])
  })

  it('тихий щипок ниже порога не считается', () => {
    expect(detect(render(1, [{ at: 0.2, freq: 82.4, amplitude: 0.004 }]))).toEqual([])
  })
})

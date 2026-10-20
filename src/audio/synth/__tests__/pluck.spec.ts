import { describe, expect, it } from 'vitest'
import { pluck } from '../pluck'
import { YinDetector } from '@/audio/dsp/yin'
import { seededRandom } from '@/audio/dsp/__tests__/signals'
import { centsBetween, midiToFreq } from '@/domain/music/pitch'

const SR = 48000

/** Высота звука с учётом скорости воспроизведения, измеренная тем же YIN, что и вход */
function measuredFreq(midi: number): number {
  const freq = midiToFreq(midi)
  const { samples, playbackRate } = pluck(freq, { sampleRate: SR, random: seededRandom(midi) })
  const detector = new YinDetector({ sampleRate: SR, frameSize: 4096, minFreq: 40, maxFreq: 3000 })
  const raw = detector.detect(samples.subarray(4800, 4800 + 4096)).freq
  return raw * playbackRate
}

describe('pluck', () => {
  it.each([
    ['A1', 33],
    ['E2', 40],
    ['G3', 55],
    ['E4', 64],
    ['E6', 88],
  ])('%s звучит точно (±5 центов)', (_, midi) => {
    expect(Math.abs(centsBetween(measuredFreq(midi), midiToFreq(midi)))).toBeLessThan(5)
  })

  it('нормализован и затухает', () => {
    const { samples } = pluck(110, { sampleRate: SR, random: seededRandom(1) })
    const peak = (from: number, to: number) =>
      samples.subarray(from, to).reduce((m, x) => Math.max(m, Math.abs(x)), 0)
    expect(peak(0, samples.length)).toBeCloseTo(0.5, 2)
    expect(peak(samples.length - 2000, samples.length)).toBeLessThan(peak(0, 2000) / 4)
    expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(0.001)
  })
})

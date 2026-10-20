import { describe, expect, it } from 'vitest'
import { BiquadLowpass } from '../biquad'

const SR = 48000

/** Усиление фильтра на частоте, дБ (по установившемуся синусу) */
function gainDb(cutoff: number, freq: number): number {
  const filter = new BiquadLowpass(SR, cutoff)
  let peakIn = 0
  let peakOut = 0
  for (let i = 0; i < SR / 2; i++) {
    const x = Math.sin((2 * Math.PI * freq * i) / SR)
    const y = filter.process(x)
    if (i > SR / 4) {
      peakIn = Math.max(peakIn, Math.abs(x))
      peakOut = Math.max(peakOut, Math.abs(y))
    }
  }
  return 20 * Math.log10(peakOut / peakIn)
}

describe('BiquadLowpass', () => {
  it('пропускает гитарный диапазон', () => {
    expect(gainDb(2000, 82)).toBeGreaterThan(-0.1)
    expect(gainDb(2000, 1318)).toBeGreaterThan(-2)
  })

  it('на частоте среза −3 дБ', () => {
    expect(gainDb(2000, 2000)).toBeCloseTo(-3, 0)
  })

  it('давит шум выше среза', () => {
    expect(gainDb(2000, 10000)).toBeLessThan(-25)
  })
})

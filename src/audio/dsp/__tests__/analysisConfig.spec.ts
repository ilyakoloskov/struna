import { describe, expect, it } from 'vitest'
import { createAnalysisConfig, HOP_SIZE } from '../analysisConfig'
import { midiToFreq } from '@/domain/music/pitch'

describe('createAnalysisConfig', () => {
  it('для Drop A окно вмещает два периода с запасом и не длиннее ~45 мс', () => {
    const config = createAnalysisConfig(48000, 33, 64)
    const period = 48000 / midiToFreq(33)
    expect(config.frameSize).toBeGreaterThanOrEqual(2 * period)
    expect((config.frameSize / 48000) * 1000).toBeLessThan(45)
    expect(config.minFreq).toBeLessThan(midiToFreq(33))
  })

  it('для 6-струнного стандарта окно короче', () => {
    const dropA = createAnalysisConfig(48000, 33, 64)
    const standard = createAnalysisConfig(48000, 40, 64)
    expect(standard.frameSize).toBeLessThan(dropA.frameSize)
  })

  it('верхняя граница покрывает 24-й лад, но не выше sr/4', () => {
    const config = createAnalysisConfig(48000, 40, 64)
    expect(config.maxFreq).toBeGreaterThan(midiToFreq(88))
    expect(createAnalysisConfig(4000, 40, 64).maxFreq).toBe(1000)
    expect(config.lowpassHz).toBeGreaterThan(config.maxFreq)
  })

  it('шаг анализа не зависит от строя', () => {
    expect(createAnalysisConfig(44100, 33, 64).hopSize).toBe(HOP_SIZE)
  })
})

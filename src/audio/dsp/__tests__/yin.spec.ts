import { describe, expect, it } from 'vitest'
import { YinDetector } from '../yin'
import { BiquadLowpass } from '../biquad'
import { createAnalysisConfig } from '../analysisConfig'
import { centsBetween, midiToFreq } from '@/domain/music/pitch'
import { seededRandom, tone, type ToneOptions } from './signals'

const SR = 48000
// Drop A (A1) — самая низкая нота, которую должны поддерживать
const config = createAnalysisConfig(SR, 33, 64)
const detector = new YinDetector(config)

/** Тот же тракт, что в ворклете: ФНЧ → кадр → YIN */
function analyze(signal: Float32Array) {
  const lowpass = new BiquadLowpass(SR, config.lowpassHz)
  const filtered = signal.map((x) => lowpass.process(x))
  return detector.detect(filtered.subarray(filtered.length - config.frameSize))
}

function analyzeTone(freq: number, options: Partial<ToneOptions> = {}) {
  return analyze(tone(freq, { sampleRate: SR, length: config.frameSize * 2, ...options }))
}

describe('YinDetector', () => {
  it.each([
    ['A1 (Drop A)', 33],
    ['B1 (7 стр.)', 35],
    ['D2 (Drop D)', 38],
    ['E2', 40],
    ['A2', 45],
    ['G3', 55],
    ['E4', 64],
    ['E6 (24-й лад)', 88],
  ])('определяет %s с точностью ±2 цента', (_, midi) => {
    const freq = midiToFreq(midi)
    const result = analyzeTone(freq, { noise: 0.01 })
    expect(Math.abs(centsBetween(result.freq, freq))).toBeLessThan(2)
    expect(result.clarity).toBeGreaterThan(0.85)
  })

  it.each([-30, -12, 7, 25])('различает отклонение %i центов', (cents) => {
    const freq = midiToFreq(40 + cents / 100)
    const result = analyzeTone(freq)
    expect(centsBetween(result.freq, midiToFreq(40))).toBeCloseTo(cents, 0)
  })

  it('не путает октаву при слабом основном тоне', () => {
    const freq = midiToFreq(33)
    const result = analyzeTone(freq, { harmonics: [0.3, 1, 0.7, 0.5, 0.3], noise: 0.005 })
    expect(Math.abs(centsBetween(result.freq, freq))).toBeLessThan(5)
  })

  it('не уползает на затухающем хвосте с шумом', () => {
    // Хвост щипка: сигнал ~−36 dBFS, шум ~−59 dBFS — без ФНЧ и поиска по всему провалу давало до +30 центов
    for (const midi of [33, 40, 45]) {
      const freq = midiToFreq(midi)
      for (const seed of [1, 2, 3, 4, 5]) {
        const result = analyzeTone(freq, { amplitude: 0.015, noise: 0.002, seed })
        expect(Math.abs(centsBetween(result.freq, freq))).toBeLessThan(3)
      }
    }
  })

  it('на белом шуме даёт низкую уверенность', () => {
    const random = seededRandom(42)
    const noise = Float32Array.from({ length: config.frameSize }, () => random() * 2 - 1)
    expect(detector.detect(noise).clarity).toBeLessThan(0.6)
  })

  it('на тишине не находит высоту', () => {
    const result = detector.detect(new Float32Array(config.frameSize))
    expect(result.clarity).toBeLessThan(0.5)
  })

  it('отказывается работать с кадром короче двух периодов', () => {
    expect(
      () => new YinDetector({ sampleRate: SR, frameSize: 512, minFreq: 50, maxFreq: 1000 }),
    ).toThrow()
  })
})

describe('A♭ Standard (7 стр.): самая низкая струна A♭1 ≈ 52 Гц', () => {
  const low = createAnalysisConfig(SR, 32, 61)
  const lowDetector = new YinDetector(low)
  const analyzeLow = (freq: number, options: Partial<ToneOptions> = {}) => {
    const lowpass = new BiquadLowpass(SR, low.lowpassHz)
    const signal = tone(freq, { sampleRate: SR, length: low.frameSize * 2, ...options })
    const filtered = signal.map((x) => lowpass.process(x))
    return lowDetector.detect(filtered.subarray(filtered.length - low.frameSize))
  }

  it('окно под A♭1 — не длиннее ~46 мс', () => {
    expect(low.frameSize / SR).toBeLessThan(0.046)
  })

  it('A♭1: точно, со слабым основным тоном и на затухающем хвосте', () => {
    const freq = midiToFreq(32)
    expect(Math.abs(centsBetween(analyzeLow(freq, { noise: 0.01 }).freq, freq))).toBeLessThan(2)
    const weak = analyzeLow(freq, { harmonics: [0.3, 1, 0.7, 0.5, 0.3], noise: 0.005 })
    expect(Math.abs(centsBetween(weak.freq, freq))).toBeLessThan(5)
    for (const seed of [1, 2, 3]) {
      const tail = analyzeLow(freq, { amplitude: 0.015, noise: 0.002, seed })
      expect(Math.abs(centsBetween(tail.freq, freq))).toBeLessThan(3)
    }
  })
})

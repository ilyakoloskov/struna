import { describe, expect, it } from 'vitest'
import { PitchStabilizer, medianOf, type PitchFrame } from '../stabilizer'
import { midiToFreq } from '@/domain/music/pitch'

let time = 0
function frame(midi: number | null, overrides: Partial<PitchFrame> = {}): PitchFrame {
  time += 10
  return {
    freq: midi === null ? 0 : midiToFreq(midi),
    clarity: 0.95,
    rms: 0.1,
    time,
    ...overrides,
  }
}

describe('PitchStabilizer', () => {
  it('сглаживает дрожание высоты', () => {
    const stabilizer = new PitchStabilizer()
    const jitter = [0.08, -0.08, 0.1, -0.06, 0.07, -0.09, 0.08, -0.07]
    const outputs = jitter.map((j) => stabilizer.push(frame(40 + j))!.midi)
    const spread = Math.max(...outputs.slice(3)) - Math.min(...outputs.slice(3))
    expect(spread).toBeLessThan(0.06)
  })

  it('игнорирует одиночный октавный выброс', () => {
    const stabilizer = new PitchStabilizer()
    for (let i = 0; i < 5; i++) stabilizer.push(frame(40))
    const reading = stabilizer.push(frame(52))!
    expect(reading.note).toBe(40)
    expect(reading.midi).toBeCloseTo(40, 1)
  })

  it('переключает ноту только после нескольких кадров подряд', () => {
    const stabilizer = new PitchStabilizer({ switchFrames: 3 })
    for (let i = 0; i < 5; i++) stabilizer.push(frame(40))
    const notes = [45, 45, 45, 45, 45, 45].map((m) => stabilizer.push(frame(m))!.note)
    // Медиана из 5 переходит на новую ноту на 3-м кадре, затем ещё 3 кадра подтверждения
    expect(notes.indexOf(45)).toBeGreaterThanOrEqual(2)
    expect(notes.at(-1)).toBe(45)
  })

  it('отбрасывает тихие и неуверенные кадры', () => {
    const stabilizer = new PitchStabilizer()
    expect(stabilizer.push(frame(40, { rms: 0.0001 }))).toBeNull()
    expect(stabilizer.push(frame(40, { clarity: 0.3 }))).toBeNull()
  })

  it('удерживает показание после затухания, затем сбрасывает', () => {
    const stabilizer = new PitchStabilizer({ holdMs: 100 })
    stabilizer.push(frame(40))
    const held = stabilizer.push(frame(null))
    expect(held?.held).toBe(true)
    expect(held?.note).toBe(40)
    time += 200
    expect(stabilizer.push(frame(null))).toBeNull()
  })
})

describe('medianOf', () => {
  it('нечётное и чётное количество', () => {
    expect(medianOf([3, 1, 2])).toBe(2)
    expect(medianOf([4, 1, 3, 2])).toBe(2.5)
  })
})

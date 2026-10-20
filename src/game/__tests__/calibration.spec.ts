import { describe, expect, it } from 'vitest'
import { analyzeCalibration } from '../calibration'
import { seededRandom } from '@/domain/random'

const clicks = Array.from({ length: 16 }, (_, i) => 1 + i * 0.667)

function hits(offset: number, jitter: number, seed = 1, drop = 0): number[] {
  const random = seededRandom(seed)
  return clicks.slice(drop).map((c) => c + offset + (random() * 2 - 1) * jitter)
}

describe('analyzeCalibration', () => {
  it('находит постоянную задержку сквозь разброс', () => {
    const outcome = analyzeCalibration(clicks, hits(0.042, 0.015))
    expect(outcome.ok).toBe(true)
    const { result } = outcome as Extract<typeof outcome, { ok: true }>
    expect(Math.abs(result.offsetMs - 42)).toBeLessThanOrEqual(6)
    expect(result.spreadMs).toBeLessThan(15)
  })

  it('отрицательное смещение — играет раньше', () => {
    const outcome = analyzeCalibration(clicks, hits(-0.03, 0.01))
    expect(outcome.ok && outcome.result.offsetMs).toBeCloseTo(-30, -1)
  })

  it('лишние удары и выбросы не сбивают', () => {
    const noisy = [...hits(0.05, 0.01), 2.3, 4.4, 7.77, ...clicks.slice(0, 3).map((c) => c + 0.2)]
    const outcome = analyzeCalibration(clicks, noisy)
    expect(outcome.ok && Math.abs(outcome.result.offsetMs - 50)).toBeLessThanOrEqual(6)
  })

  it('мало ударов — просим повторить', () => {
    expect(analyzeCalibration(clicks, hits(0.04, 0.01, 1, 10))).toMatchObject({
      ok: false,
      reason: 'too-few-hits',
    })
  })

  it('слишком неровно — просим повторить', () => {
    expect(analyzeCalibration(clicks, hits(0, 0.2, 3))).toMatchObject({ ok: false })
  })
})

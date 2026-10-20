import { describe, expect, it } from 'vitest'
import { amplitudeToDb, dbToMeter, levelStatus, SILENCE_DB } from '../level'

describe('level', () => {
  it('amplitudeToDb', () => {
    expect(amplitudeToDb(1)).toBe(0)
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1)
    expect(amplitudeToDb(0)).toBe(SILENCE_DB)
  })

  it('dbToMeter ограничен 0…1', () => {
    expect(dbToMeter(-90)).toBe(0)
    expect(dbToMeter(-30)).toBeCloseTo(0.5)
    expect(dbToMeter(6)).toBe(1)
  })

  it('levelStatus', () => {
    expect(levelStatus(-80)).toBe('silent')
    expect(levelStatus(-40)).toBe('quiet')
    expect(levelStatus(-12)).toBe('good')
    expect(levelStatus(-1)).toBe('clipping')
  })
})

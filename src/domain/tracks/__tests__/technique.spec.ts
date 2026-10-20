import { describe, expect, it } from 'vitest'
import { SLIDE_IN_RANGE, hasTechnique, pitchRange, portableTechnique } from '../technique'

describe('pitchRange', () => {
  it('обычная нота — одна высота', () => {
    expect(pitchRange(60)).toEqual({ low: 60, high: 60 })
    expect(pitchRange(60, { vibrato: true })).toEqual({ low: 60, high: 60 })
  })

  it('бенд — весь путь подтяжки, пребенд — от подтянутой высоты', () => {
    expect(pitchRange(60, { bend: { from: 0, peak: 2, to: 0 } })).toEqual({ low: 60, high: 62 })
    expect(pitchRange(60, { bend: { from: 3, peak: 3, to: 1 } })).toEqual({ low: 61, high: 63 })
  })

  it('слайд в ноту — несколько полутонов со стороны въезда', () => {
    expect(pitchRange(60, { slideIn: 'below' })).toEqual({ low: 60 - SLIDE_IN_RANGE, high: 60 })
    expect(pitchRange(60, { slideIn: 'above' })).toEqual({ low: 60, high: 60 + SLIDE_IN_RANGE })
  })
})

describe('portableTechnique', () => {
  it('без ладов из файла остаются бенд, легато, мьют, вибрато, глухая', () => {
    expect(
      portableTechnique({
        harmonic: 'natural',
        slideIn: 'below',
        slideOut: { frets: 2, toNote: true },
        bend: { from: 0, peak: 2, to: 2 },
        palmMute: true,
      }),
    ).toEqual({ bend: { from: 0, peak: 2, to: 2 }, palmMute: true })
    expect(portableTechnique({ legato: 'hammer' })).toEqual({ legato: 'hammer' })
  })

  it('легато-слайд без слайда теряет смысл; пусто — undefined', () => {
    expect(portableTechnique({ legato: 'slide' })).toBeUndefined()
    expect(portableTechnique({ harmonic: 'natural' })).toBeUndefined()
    expect(portableTechnique(undefined)).toBeUndefined()
  })

  it('hasTechnique', () => {
    expect(hasTechnique({})).toBe(false)
    expect(hasTechnique({ palmMute: false })).toBe(false)
    expect(hasTechnique({ dead: true })).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { FrettedNote } from '@/domain/tracks/types'
import type { NoteTechnique } from '@/domain/tracks/technique'
import { GLYPH } from '../digitAtlas'
import {
  MAX_MARKS,
  SHAPE_DEAD,
  SHAPE_GEM,
  SHAPE_HARMONIC,
  buildNoteLooks,
  noteLook,
} from '../noteLook'

const note = (fret: number, technique?: NoteTechnique): FrettedNote => ({
  time: 0,
  midi: 40 + fret,
  duration: 0.2,
  velocity: 0.8,
  stringIndex: 0,
  fret,
  ...(technique && { technique }),
})

describe('noteLook', () => {
  it('обычная нота — плашка с номером лада, без знаков', () => {
    expect(noteLook(note(7))).toEqual({ shape: SHAPE_GEM, mute: false, label: 7, marks: [] })
  })

  it('флажолет — ромб, глухая — плашка с ×', () => {
    expect(noteLook(note(12, { harmonic: 'natural' })).shape).toBe(SHAPE_HARMONIC)
    expect(noteLook(note(12, { harmonic: 'natural' })).label).toBe(12)
    expect(noteLook(note(3, { dead: true }))).toMatchObject({
      shape: SHAPE_DEAD,
      label: GLYPH.dead,
    })
  })

  it('бенд: величина в тонах и знак отпускания', () => {
    expect(noteLook(note(7, { bend: { from: 0, peak: 1, to: 1 } })).marks).toEqual([GLYPH.bendHalf])
    expect(noteLook(note(7, { bend: { from: 0, peak: 2, to: 0 } })).marks).toEqual([
      GLYPH.bendFull,
      GLYPH.release,
    ])
    expect(noteLook(note(7, { bend: { from: 3, peak: 3, to: 0 } })).marks).toEqual([
      GLYPH.bendOneHalf,
      GLYPH.release,
    ])
    expect(noteLook(note(7, { bend: { from: 0, peak: 4, to: 4 } })).marks).toEqual([GLYPH.bendTwo])
  })

  it('легато, слайды, мьют, вибрато', () => {
    expect(noteLook(note(7, { legato: 'hammer' })).marks).toEqual([GLYPH.hammer])
    expect(noteLook(note(5, { legato: 'pull' })).marks).toEqual([GLYPH.pull])
    expect(noteLook(note(5, { slideOut: { frets: 2, toNote: true } })).marks).toEqual([
      GLYPH.slideUp,
    ])
    expect(noteLook(note(5, { slideOut: { frets: -3, toNote: false } })).marks).toEqual([
      GLYPH.slideDown,
    ])
    expect(noteLook(note(5, { slideIn: 'above' })).marks).toEqual([GLYPH.slideDown])
    const pm = noteLook(note(0, { palmMute: true }))
    expect(pm).toMatchObject({ mute: true, marks: [GLYPH.palmMute] })
    expect(noteLook(note(5, { vibrato: true })).marks).toEqual([GLYPH.vibrato])
  })

  it('знаков не больше MAX_MARKS, по важности', () => {
    const look = noteLook(
      note(7, { bend: { from: 0, peak: 2, to: 0 }, palmMute: true, vibrato: true }),
    )
    expect(look.marks).toHaveLength(MAX_MARKS)
    expect(look.marks).toEqual([GLYPH.bendFull, GLYPH.release])
  })

  it('лад вне атласа обрезается', () => {
    expect(noteLook(note(30)).label).toBe(24)
  })
})

describe('buildNoteLooks', () => {
  it('плоские массивы по индексу нот, пустые знаки — −1', () => {
    const looks = buildNoteLooks([note(3), note(5, { legato: 'hammer', vibrato: true })])
    expect([...looks.label]).toEqual([3, 5])
    expect([...looks.marks]).toEqual([-1, -1, GLYPH.hammer, GLYPH.vibrato])
    expect([...looks.shape]).toEqual([SHAPE_GEM, SHAPE_GEM])
  })
})

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SELECTION,
  decodeTuningParam,
  encodeTuningParam,
  parseTheoryQuery,
  toTheoryQuery,
} from '../selection'

describe('parseTheoryQuery', () => {
  it('пример из CLAUDE.md', () => {
    expect(parseTheoryQuery({ key: 'E', mode: 'phrygian', tuning: '7-standard-b' })).toEqual({
      tonic: { letter: 'E', alt: 0 },
      scaleId: 'phrygian',
    })
  })

  it('диезы, бемоли и синонимы ладов', () => {
    expect(parseTheoryQuery({ key: 'F#', mode: 'minor' })).toMatchObject({
      tonic: { letter: 'F', alt: 1 },
      scaleId: 'aeolian',
    })
    expect(parseTheoryQuery({ key: 'Bb' }).tonic).toEqual({ letter: 'B', alt: -1 })
  })

  it('подписи и диапазон ладов', () => {
    expect(parseTheoryQuery({ labels: 'degrees', frets: '5-12' })).toEqual({
      labels: 'degrees',
      fretRange: { from: 5, to: 12 },
    })
  })

  it('мусор игнорируется', () => {
    expect(parseTheoryQuery({ key: 'H', mode: 'jazz', labels: 'colors', frets: '12-3' })).toEqual(
      {},
    )
    // Тоника с дубль-знаком — не выбирается в интерфейсе
    expect(parseTheoryQuery({ key: 'F##' })).toEqual({})
  })

  it('массивы значений: берётся первое', () => {
    expect(parseTheoryQuery({ key: ['A', 'B'] }).tonic).toEqual({ letter: 'A', alt: 0 })
  })
})

describe('toTheoryQuery', () => {
  it('по умолчанию — только тональность и лад', () => {
    expect(toTheoryQuery(DEFAULT_SELECTION)).toEqual({ key: 'E', mode: 'ionian' })
  })

  it('пишет отличия от умолчаний', () => {
    expect(
      toTheoryQuery({
        tonic: { letter: 'F', alt: 1 },
        scaleId: 'dorian',
        labels: 'intervals',
        fretRange: { from: 3, to: 12 },
      }),
    ).toEqual({ key: 'F#', mode: 'dorian', labels: 'intervals', frets: '3-12' })
  })

  it('туда и обратно', () => {
    const selection = {
      tonic: { letter: 'B' as const, alt: -1 },
      scaleId: 'blues' as const,
      labels: 'degrees' as const,
      fretRange: { from: 0, to: 24 },
    }
    expect(parseTheoryQuery(toTheoryQuery(selection))).toEqual(selection)
  })
})

describe('строй в URL', () => {
  it('пресет', () => {
    expect(encodeTuningParam({ tuningId: '7-drop-a' })).toBe('7-drop-a')
    expect(decodeTuningParam('7-drop-a')).toEqual({ tuningId: '7-drop-a' })
  })

  it('свой строй', () => {
    const param = encodeTuningParam({ tuningId: 'custom', customMidis: [37, 44, 49, 54, 58, 63] })
    expect(param).toBe('custom-C#2-G#2-C#3-F#3-A#3-D#4')
    expect(decodeTuningParam(param)).toEqual({
      tuningId: 'custom',
      customMidis: [37, 44, 49, 54, 58, 63],
    })
  })

  it('некорректный строй', () => {
    expect(decodeTuningParam('8-strings')).toBeNull()
    expect(decodeTuningParam('custom-E2-A2')).toBeNull()
    expect(decodeTuningParam(undefined)).toBeNull()
  })
})

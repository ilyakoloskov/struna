import { describe, expect, it } from 'vitest'
import { diatonicTriads } from '../chords'
import { buildScale, findScale } from '../scales'
import { n } from './helpers'

const triads = (tonic: string, id: string) => diatonicTriads(buildScale(n(tonic), findScale(id)!))

describe('diatonicTriads', () => {
  it('ми мажор — как на макете', () => {
    const chords = triads('E', 'ionian')
    expect(chords.map((c) => c.symbol)).toEqual(['E', 'F♯m', 'G♯m', 'A', 'B', 'C♯m', 'D♯°'])
    expect(chords.map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
    expect(chords.map((c) => c.function).join('')).toBe('TSTSDTD')
  })

  it('ми натуральный минор — как на макете грифа', () => {
    expect(triads('E', 'aeolian').map((c) => c.symbol)).toEqual([
      'Em',
      'F♯°',
      'G',
      'Am',
      'Bm',
      'C',
      'D',
    ])
  })

  it('гармонический минор: увеличенное III+ и мажорная доминанта', () => {
    const chords = triads('A', 'harmonic-minor')
    expect(chords[2]!.symbol).toBe('C+')
    expect(chords[2]!.roman).toBe('III+')
    expect(chords[4]!.symbol).toBe('E')
    expect(chords[4]!.roman).toBe('V')
  })

  it('ноты аккорда с правильным написанием', () => {
    const vii = triads('F#', 'ionian')[6]!
    expect(vii.symbol).toBe('E♯°')
  })

  it('для пентатоники и блюза аккордов нет', () => {
    expect(triads('E', 'minor-pentatonic')).toEqual([])
    expect(triads('A', 'blues')).toEqual([])
  })
})

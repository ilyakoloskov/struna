import { describe, expect, it } from 'vitest'
import {
  centsBetween,
  formatNote,
  freqToMidi,
  midiToFreq,
  midiToNoteName,
  parseNote,
} from '../pitch'

describe('pitch', () => {
  it('A4 = 440 Гц = MIDI 69', () => {
    expect(midiToFreq(69)).toBe(440)
    expect(freqToMidi(440)).toBe(69)
  })

  it('частоты открытых струн', () => {
    expect(midiToFreq(40)).toBeCloseTo(82.41, 2) // E2
    expect(midiToFreq(35)).toBeCloseTo(61.74, 2) // B1
    expect(midiToFreq(33)).toBeCloseTo(55, 2) // A1
  })

  it('учитывает свою частоту A4', () => {
    expect(midiToFreq(69, 432)).toBe(432)
    expect(freqToMidi(432, 432)).toBe(69)
  })

  it('центы', () => {
    expect(centsBetween(880, 440)).toBe(1200)
    expect(centsBetween(midiToFreq(40.04), midiToFreq(40))).toBeCloseTo(4)
  })

  it('имена нот с диезами и бемолями', () => {
    expect(formatNote(40)).toBe('E2')
    expect(formatNote(61)).toBe('C♯4')
    expect(formatNote(61, 'flat')).toBe('D♭4')
    expect(midiToNoteName(59.6)).toEqual({ name: 'C', octave: 4 })
    expect(formatNote(23)).toBe('B0')
  })

  it.each([
    ['E2', 40],
    ['Eb2', 39],
    ['E♭2', 39],
    ['F#3', 54],
    ['C♯4', 61],
    ['B1', 35],
    ['a1', 33],
  ])('parseNote(%s) = %i', (note, midi) => {
    expect(parseNote(note)).toBe(midi)
  })

  it('parseNote отвергает мусор', () => {
    expect(parseNote('H2')).toBeNull()
    expect(parseNote('E')).toBeNull()
    expect(parseNote('E##2')).toBeNull()
  })
})

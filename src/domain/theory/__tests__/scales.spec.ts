import { describe, expect, it } from 'vitest'
import {
  SCALES,
  TONIC_CHOICES,
  buildScale,
  describePitch,
  findScale,
  pitchLabel,
  scaleNoteByChroma,
} from '../scales'
import { chroma, formatNote } from '../notes'
import { n, names } from './helpers'

const spell = (tonic: string, id: string) =>
  names(buildScale(n(tonic), findScale(id)!).notes.map((x) => x.note))

describe('scales', () => {
  it.each([
    ['C', 'ionian', 'C D E F G A B'],
    ['F', 'ionian', 'F G A B♭ C D E'],
    ['F#', 'ionian', 'F♯ G♯ A♯ B C♯ D♯ E♯'],
    ['Gb', 'ionian', 'G♭ A♭ B♭ C♭ D♭ E♭ F'],
    ['E', 'aeolian', 'E F♯ G A B C D'],
    ['D', 'dorian', 'D E F G A B C'],
    ['E', 'phrygian', 'E F G A B C D'],
    ['F', 'lydian', 'F G A B C D E'],
    ['G', 'mixolydian', 'G A B C D E F'],
    ['B', 'locrian', 'B C D E F G A'],
    ['A', 'harmonic-minor', 'A B C D E F G♯'],
    ['G#', 'harmonic-minor', 'G♯ A♯ B C♯ D♯ E F𝄪'],
    ['A', 'melodic-minor', 'A B C D E F♯ G♯'],
    ['G', 'major-pentatonic', 'G A B D E'],
    ['E', 'minor-pentatonic', 'E G A B D'],
    ['A', 'blues', 'A C D E♭ E G'],
  ])('%s %s', (tonic, id, expected) => {
    expect(spell(tonic, id)).toBe(expected)
  })

  it('все гаммы без повторов высот и без лишних знаков у натуральных ладов от C', () => {
    for (const type of SCALES) {
      const scale = buildScale(n('C'), type)
      const chromas = scale.notes.map((x) => chroma(x.note))
      expect(new Set(chromas).size).toBe(chromas.length)
      for (const x of scale.notes) expect(Math.abs(x.note.alt)).toBeLessThanOrEqual(1)
    }
  })

  it('в семиступенных гаммах каждая буква ровно один раз', () => {
    for (const tonic of TONIC_CHOICES) {
      for (const type of SCALES.filter((s) => s.degrees.length === 7)) {
        const letters = buildScale(tonic, type).notes.map((x) => x.note.letter)
        expect(new Set(letters).size).toBe(7)
      }
    }
  })

  it('роли: тоника, терция, квинта', () => {
    const roles = buildScale(n('E'), findScale('aeolian')!).notes.map((x) => x.role)
    expect(roles).toEqual(['tonic', 'other', 'third', 'other', 'fifth', 'other', 'other'])
  })

  it('в локрийском квинта — пониженная', () => {
    const fifth = buildScale(n('B'), findScale('locrian')!).notes.find((x) => x.role === 'fifth')
    expect(fifth?.degree).toEqual({ number: 5, alt: -1 })
  })

  it('в блюзовой квинта — натуральная, ♭5 — просто ступень', () => {
    const scale = buildScale(n('A'), findScale('blues')!)
    expect(scale.notes.filter((x) => x.role === 'fifth')).toHaveLength(1)
    expect(scale.notes.find((x) => x.role === 'fifth')?.degree.alt).toBe(0)
  })

  it('синонимы major/minor', () => {
    expect(findScale('major')?.id).toBe('ionian')
    expect(findScale('minor')?.id).toBe('aeolian')
    expect(findScale('nope')).toBeUndefined()
  })

  it('поиск ноты гаммы по высоте', () => {
    const scale = buildScale(n('E'), findScale('aeolian')!)
    expect(scaleNoteByChroma(scale, 7)?.role).toBe('third') // G
    expect(scaleNoteByChroma(scale, 8)).toBeUndefined() // G♯ не входит
  })
})

describe('describePitch', () => {
  const eMinor = buildScale(n('E'), findScale('aeolian')!)

  it('нота гаммы — с её ролью и написанием', () => {
    const g = describePitch(eMinor, 55) // G3
    expect(formatNote(g.note)).toBe('G')
    expect(g.role).toBe('third')
    expect(pitchLabel(g, 'degrees')).toBe('♭3')
    expect(pitchLabel(g, 'intervals')).toBe('м3')
  })

  it('нота вне гаммы пишется от тоники', () => {
    const gSharp = describePitch(eMinor, 56)
    expect(formatNote(gSharp.note)).toBe('G♯')
    expect(gSharp.role).toBeNull()
    expect(pitchLabel(gSharp, 'degrees')).toBe('3')
    expect(formatNote(describePitch(eMinor, 58).note)).toBe('A♯') // ♯4
    const fMajor = buildScale(n('F'), findScale('ionian')!)
    expect(formatNote(describePitch(fMajor, 61).note)).toBe('D♭') // ♭6
  })
})

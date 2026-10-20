import { describe, expect, it } from 'vitest'
import { chroma, fifthsOf, formatNote, octaveOf, parseSpelledNote, toAscii } from '../notes'
import { n } from './helpers'

describe('notes', () => {
  it.each([
    ['F#', 'F♯'],
    ['F♯', 'F♯'],
    ['Bb', 'B♭'],
    ['bb', 'B♭'],
    ['F##', 'F𝄪'],
    ['Fx', 'F𝄪'],
    ['Bbb', 'B𝄫'],
    ['C', 'C'],
  ])('parse %s → %s', (text, formatted) => {
    expect(formatNote(n(text))).toBe(formatted)
  })

  it('отвергает некорректную запись', () => {
    expect(parseSpelledNote('H')).toBeNull()
    expect(parseSpelledNote('F###')).toBeNull()
    expect(parseSpelledNote('')).toBeNull()
  })

  it('энгармонизмы имеют одну высоту', () => {
    expect(chroma(n('E#'))).toBe(chroma(n('F')))
    expect(chroma(n('Cb'))).toBe(chroma(n('B')))
    expect(chroma(n('F##'))).toBe(chroma(n('G')))
    expect(chroma(n('Dbb'))).toBe(chroma(n('C')))
  })

  it('ASCII для URL', () => {
    expect(toAscii(n('F♯'))).toBe('F#')
    expect(toAscii(n('B♭'))).toBe('Bb')
    expect(toAscii(n('F𝄪'))).toBe('F##')
  })

  it('позиция на квинтовом круге', () => {
    expect(fifthsOf(n('C'))).toBe(0)
    expect(fifthsOf(n('E'))).toBe(4)
    expect(fifthsOf(n('F'))).toBe(-1)
    expect(fifthsOf(n('Gb'))).toBe(-6)
    expect(fifthsOf(n('F#'))).toBe(6)
    expect(fifthsOf(n('C#'))).toBe(7)
  })

  it('октава учитывает написание', () => {
    expect(octaveOf(n('B#'), 60)).toBe(3) // B♯3 звучит как C4
    expect(octaveOf(n('Cb'), 59)).toBe(4) // C♭4 звучит как B3
    expect(octaveOf(n('G'), 55)).toBe(3)
  })
})

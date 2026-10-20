import { describe, expect, it } from 'vitest'
import { formatDegree, intervalName, parseDegree, transpose } from '../intervals'
import { formatNote } from '../notes'
import { n } from './helpers'

const up = (tonic: string, degree: string) => formatNote(transpose(n(tonic), parseDegree(degree)))

describe('intervals', () => {
  it('написание по буквам', () => {
    expect(up('F', '4')).toBe('B♭') // в фа мажоре — B♭, а не A♯
    expect(up('F#', '7')).toBe('E♯') // в фа-диез мажоре — E♯
    expect(up('G#', '7')).toBe('F𝄪') // гармонический соль-диез минор
    expect(up('Db', 'b3')).toBe('F♭')
    expect(up('C', 'b5')).toBe('G♭')
    expect(up('C', '#4')).toBe('F♯')
    expect(up('B', '5')).toBe('F♯')
    expect(up('E', '6')).toBe('C♯')
  })

  it('подписи ступеней', () => {
    expect(formatDegree(parseDegree('b3'))).toBe('♭3')
    expect(formatDegree(parseDegree('#4'))).toBe('♯4')
    expect(formatDegree(parseDegree('1'))).toBe('1')
  })

  it.each([
    ['1', 'ч1'],
    ['b2', 'м2'],
    ['2', 'б2'],
    ['b3', 'м3'],
    ['3', 'б3'],
    ['4', 'ч4'],
    ['#4', 'ув4'],
    ['b5', 'ум5'],
    ['5', 'ч5'],
    ['b6', 'м6'],
    ['7', 'б7'],
    ['bb7', 'ум7'],
  ])('интервал %s → %s', (degree, name) => {
    expect(intervalName(parseDegree(degree))).toBe(name)
  })

  it('некорректная ступень', () => {
    expect(() => parseDegree('9')).toThrow()
  })
})

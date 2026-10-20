import { describe, expect, it } from 'vitest'
import {
  CIRCLE_OF_FIFTHS,
  circleIndex,
  neighborKeys,
  parallelKey,
  relativeKey,
  signatureCount,
  signatureNotes,
  type Key,
} from '../keys'
import { formatNote } from '../notes'
import { capitalize, formatSignatureCount, keyNameRu } from '../names'
import { n, names } from './helpers'

const major = (t: string): Key => ({ tonic: n(t), quality: 'major' })
const minor = (t: string): Key => ({ tonic: n(t), quality: 'minor' })

describe('keys', () => {
  it.each([
    [major('C'), 0, ''],
    [major('E'), 4, 'F♯ C♯ G♯ D♯'],
    [major('F'), -1, 'B♭'],
    [major('Db'), -5, 'B♭ E♭ A♭ D♭ G♭'],
    [major('F#'), 6, 'F♯ C♯ G♯ D♯ A♯ E♯'],
    [major('Cb'), -7, 'B♭ E♭ A♭ D♭ G♭ C♭ F♭'],
    [minor('A'), 0, ''],
    [minor('C#'), 4, 'F♯ C♯ G♯ D♯'],
    [minor('D'), -1, 'B♭'],
    [minor('Eb'), -6, 'B♭ E♭ A♭ D♭ G♭ C♭'],
  ])('знаки %o', (key, count, list) => {
    expect(signatureCount(key)).toBe(count)
    expect(names(signatureNotes(key))).toBe(list)
  })

  it('теоретическая тональность D♯ мажор — 9 знаков с дубль-диезами', () => {
    expect(names(signatureNotes(major('D#')))).toBe('F♯ C♯ G♯ D♯ A♯ E♯ B♯ F𝄪 C𝄪')
  })

  it('параллельные и одноимённые', () => {
    expect(formatNote(relativeKey(major('E')).tonic)).toBe('C♯')
    expect(relativeKey(major('E')).quality).toBe('minor')
    expect(formatNote(relativeKey(minor('C#')).tonic)).toBe('E')
    expect(formatNote(relativeKey(major('F')).tonic)).toBe('D')
    expect(formatNote(relativeKey(minor('Bb')).tonic)).toBe('D♭')
    expect(parallelKey(major('E'))).toEqual(minor('E'))
  })

  it('соседние тональности', () => {
    const { subdominant, dominant } = neighborKeys(major('E'))
    expect(formatNote(subdominant.tonic)).toBe('A')
    expect(formatNote(dominant.tonic)).toBe('B')
    expect(formatNote(neighborKeys(minor('E')).subdominant.tonic)).toBe('A')
  })

  it('круг: параллельные тональности стоят в одном секторе', () => {
    for (const sector of CIRCLE_OF_FIFTHS) {
      expect(circleIndex({ tonic: sector.major[0]!, quality: 'major' })).toBe(sector.index)
      expect(circleIndex({ tonic: sector.minor[0]!, quality: 'minor' })).toBe(sector.index)
      expect(relativeKey({ tonic: sector.major[0]!, quality: 'major' }).tonic).toEqual(
        sector.minor[0],
      )
    }
  })

  it('энгармонические тональности попадают в один сектор', () => {
    expect(circleIndex(major('F#'))).toBe(circleIndex(major('Gb')))
    expect(circleIndex(major('C#'))).toBe(circleIndex(major('Db')))
    expect(circleIndex(minor('D#'))).toBe(circleIndex(minor('Eb')))
  })

  it('русские названия', () => {
    expect(capitalize(keyNameRu(n('E'), 'major'))).toBe('Ми мажор')
    expect(keyNameRu(n('C#'), 'minor')).toBe('до-диез минор')
    expect(keyNameRu(n('Bb'), 'major')).toBe('си-бемоль мажор')
    expect(formatSignatureCount(4)).toBe('4♯')
    expect(formatSignatureCount(-2)).toBe('2♭')
    expect(formatSignatureCount(0)).toBe('—')
  })
})

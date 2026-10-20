import { parseDegree, transpose } from './intervals'
import { fifthsOf, mod, note, type SpelledNote } from './notes'

export type KeyQuality = 'major' | 'minor'

export interface Key {
  tonic: SpelledNote
  quality: KeyQuality
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const

/** Число знаков: плюс — диезы, минус — бемоли */
export function signatureCount(key: Key): number {
  return fifthsOf(key.tonic) - (key.quality === 'minor' ? 3 : 0)
}

/**
 * Ключевые знаки в порядке записи: E мажор → F♯ C♯ G♯ D♯.
 * Для теоретических тональностей (больше 7 знаков) добавляются дубль-знаки.
 */
export function signatureNotes(key: Key): SpelledNote[] {
  const count = signatureCount(key)
  const order = count >= 0 ? SHARP_ORDER : FLAT_ORDER
  const sign = count >= 0 ? 1 : -1
  return Array.from({ length: Math.abs(count) }, (_, i) =>
    note(order[i % 7]!, sign * (1 + Math.floor(i / 7))),
  )
}

/** Параллельная тональность (в русской терминологии): E мажор ↔ C♯ минор */
export function relativeKey(key: Key): Key {
  return key.quality === 'major'
    ? { tonic: transpose(key.tonic, parseDegree('6')), quality: 'minor' }
    : { tonic: transpose(key.tonic, parseDegree('b3')), quality: 'major' }
}

/** Одноимённая тональность: E мажор ↔ E минор */
export function parallelKey(key: Key): Key {
  return { tonic: key.tonic, quality: key.quality === 'major' ? 'minor' : 'major' }
}

/** Соседние по кругу тональности того же наклонения: субдоминанта и доминанта */
export function neighborKeys(key: Key): { subdominant: Key; dominant: Key } {
  return {
    subdominant: { tonic: transpose(key.tonic, parseDegree('4')), quality: key.quality },
    dominant: { tonic: transpose(key.tonic, parseDegree('5')), quality: key.quality },
  }
}

export interface CircleSector {
  /** Позиция по часовой стрелке от C (0) */
  index: number
  /** Основное написание и энгармоническая пара (у F♯/G♭ и D♯m/E♭m) */
  major: readonly SpelledNote[]
  minor: readonly SpelledNote[]
}

const n = note
/** Квинтовый круг: внешнее кольцо — мажоры, внутреннее — параллельные миноры */
export const CIRCLE_OF_FIFTHS: readonly CircleSector[] = [
  { major: [n('C')], minor: [n('A')] },
  { major: [n('G')], minor: [n('E')] },
  { major: [n('D')], minor: [n('B')] },
  { major: [n('A')], minor: [n('F', 1)] },
  { major: [n('E')], minor: [n('C', 1)] },
  { major: [n('B')], minor: [n('G', 1)] },
  { major: [n('F', 1), n('G', -1)], minor: [n('D', 1), n('E', -1)] },
  { major: [n('D', -1)], minor: [n('B', -1)] },
  { major: [n('A', -1)], minor: [n('F')] },
  { major: [n('E', -1)], minor: [n('C')] },
  { major: [n('B', -1)], minor: [n('G')] },
  { major: [n('F')], minor: [n('D')] },
].map((sector, index) => ({ ...sector, index }))

/** Позиция тональности на круге (энгармонические тональности попадают в один сектор) */
export function circleIndex(key: Key): number {
  return mod(signatureCount(key), 12)
}

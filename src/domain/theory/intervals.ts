import {
  LETTERS,
  accidentalSymbol,
  chroma,
  letterChroma,
  letterIndex,
  mod,
  type SpelledNote,
} from './notes'

// Ступень относительно тоники в записи от мажора: «1», «♭3», «♯4», «♭5».
// Номер ступени задаёт букву, альтерация — высоту: так получается правильное написание.

export interface Degree {
  /** Номер ступени 1…7 */
  number: number
  /** Альтерация относительно мажорной гаммы */
  alt: number
}

const MAJOR_SEMITONES = [0, 2, 4, 5, 7, 9, 11]
/** Ступени, у которых «чистые» интервалы (1, 4, 5); остальные — большие/малые */
const PERFECT = new Set([1, 4, 5])

/** Разбор записи ступени: «1», «b3», «#4», «bb7» */
export function parseDegree(text: string): Degree {
  const match = /^(b{1,2}|#{1,2})?([1-7])$/.exec(text)
  if (!match) throw new Error(`Некорректная ступень: ${text}`)
  const acc = match[1] ?? ''
  const alt = acc.startsWith('#') ? acc.length : acc ? -acc.length : 0
  return { number: Number(match[2]), alt }
}

export function degreeSemitones(d: Degree): number {
  return MAJOR_SEMITONES[d.number - 1]! + d.alt
}

/** Нота на заданной ступени от тоники с правильным написанием */
export function transpose(tonic: SpelledNote, d: Degree): SpelledNote {
  const letter = LETTERS[(letterIndex(tonic.letter) + d.number - 1) % 7]!
  const target = chroma(tonic) + degreeSemitones(d)
  // Альтерация, приводящая букву к нужной высоте, в диапазоне −6…5
  const alt = mod(target - letterChroma(letter) + 6, 12) - 6
  return { letter, alt }
}

/** Подпись ступени: «1», «♭3», «♯4» */
export function formatDegree(d: Degree): string {
  return `${accidentalSymbol(d.alt)}${d.number}`
}

/** Краткое название интервала от тоники: «ч1», «м3», «б3», «ув4», «ум5», «ч5», «м7» */
export function intervalName(d: Degree): string {
  if (PERFECT.has(d.number)) {
    const quality = d.alt === 0 ? 'ч' : d.alt > 0 ? 'ув' : 'ум'
    return `${quality}${d.number}`
  }
  const quality = d.alt === 0 ? 'б' : d.alt === -1 ? 'м' : d.alt > 0 ? 'ув' : 'ум'
  return `${quality}${d.number}`
}

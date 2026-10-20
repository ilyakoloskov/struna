import type { KeyQuality } from './keys'
import type { Letter, SpelledNote } from './notes'

// Русские названия нот и тональностей: «до-диез минор», «си-бемоль мажор»

const SOLFEGE: Record<Letter, string> = {
  C: 'до',
  D: 'ре',
  E: 'ми',
  F: 'фа',
  G: 'соль',
  A: 'ля',
  B: 'си',
}

const ALTERATION: Record<number, string> = {
  [-2]: '-дубль-бемоль',
  [-1]: '-бемоль',
  0: '',
  1: '-диез',
  2: '-дубль-диез',
}

export function noteNameRu(n: SpelledNote): string {
  return `${SOLFEGE[n.letter]}${ALTERATION[n.alt] ?? ''}`
}

export function keyNameRu(tonic: SpelledNote, quality: KeyQuality): string {
  return `${noteNameRu(tonic)} ${quality === 'major' ? 'мажор' : 'минор'}`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «4♯», «2♭», «—» */
export function formatSignatureCount(count: number): string {
  if (count === 0) return '—'
  return `${Math.abs(count)}${count > 0 ? '♯' : '♭'}`
}

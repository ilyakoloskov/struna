import { chroma, formatNote, mod, type SpelledNote } from './notes'
import type { Scale } from './scales'

export type TriadQuality = 'major' | 'minor' | 'diminished' | 'augmented'
export type HarmonicFunction = 'T' | 'S' | 'D'

export interface Triad {
  root: SpelledNote
  notes: readonly [SpelledNote, SpelledNote, SpelledNote]
  quality: TriadQuality
  /** «E», «F♯m», «D♯°», «C+» */
  symbol: string
  /** «I», «ii», «vii°», «III+» */
  roman: string
  function: HarmonicFunction
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
/** Функции по ступени: I, iii, vi — тоника; ii, IV — субдоминанта; V, vii° — доминанта */
const FUNCTIONS: readonly HarmonicFunction[] = ['T', 'S', 'T', 'S', 'D', 'T', 'D']

const SUFFIX: Record<TriadQuality, string> = {
  major: '',
  minor: 'm',
  diminished: '°',
  augmented: '+',
}

export function triadQuality(third: number, fifth: number): TriadQuality {
  if (third === 4 && fifth === 7) return 'major'
  if (third === 3 && fifth === 7) return 'minor'
  if (third === 3 && fifth === 6) return 'diminished'
  if (third === 4 && fifth === 8) return 'augmented'
  throw new Error(`Не трезвучие: терция ${third}, квинта ${fifth}`)
}

/** Диатонические трезвучия семиступенной гаммы; для пентатоник и блюза — пусто */
export function diatonicTriads(scale: Scale): Triad[] {
  const notes = scale.notes.map((n) => n.note)
  if (notes.length !== 7) return []

  return notes.map((root, i) => {
    const third = notes[(i + 2) % 7]!
    const fifth = notes[(i + 4) % 7]!
    const quality = triadQuality(
      mod(chroma(third) - chroma(root), 12),
      mod(chroma(fifth) - chroma(root), 12),
    )
    const numeral =
      quality === 'major' || quality === 'augmented' ? ROMAN[i]! : ROMAN[i]!.toLowerCase()
    const mark = quality === 'diminished' ? '°' : quality === 'augmented' ? '+' : ''
    return {
      root,
      notes: [root, third, fifth] as const,
      quality,
      symbol: `${formatNote(root)}${SUFFIX[quality]}`,
      roman: `${numeral}${mark}`,
      function: FUNCTIONS[i]!,
    }
  })
}

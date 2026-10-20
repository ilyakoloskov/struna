import { CHROMA_MAX_HZ, CHROMA_MIN_HZ } from '@/audio/dsp/chroma'
import { midiToFreq } from '@/domain/music/pitch'

// Проверка ожидаемого аккорда по хромаграмме (не распознавание произвольных аккордов):
// игра знает точные ноты аккорда (с октавами) и строит ожидаемый профиль хромы
// вместе с обертонами — у открытого A обертон B от двух E входит в картину, а у чужого аккорда
// профиль другой. Аккорд засчитан, если сыгранный профиль похож на ожидаемый, все ноты аккорда
// (без октав) слышны, и ни один «сосед» не объясняет звук лучше ожидаемого аккорда:
//  • одна нота на полтона выше/ниже (E ↔ Em, A ↔ Am, sus);
//  • одной ноты нет (E5 вместо E: терция «слышна» лишь как 5-я гармоника тоники).
// Сыграно больше нужного (E вместо E5) — засчитывается: все ноты аккорда на месте.

/** Средние амплитуды гармоник гитарной ноты (1-я — основной тон) */
export const GUITAR_HARMONIC_PROFILE = [0.7, 1, 0.6, 0.4, 0.25, 0.15]

/** Минимальное косинусное сходство с ожидаемым профилем */
export const CHORD_SIMILARITY = 0.85
/**
 * Нота аккорда «слышна», если её энергия в хроме не меньше этой доли максимума.
 * Рабочий диапазон на наборе аккордов в тестах — 0.3…0.4 (ниже — низкий квинтаккорд «сходит»
 * за полный аккорд из-за 5-й гармоники, выше — теряется терция в Em); берём середину.
 */
export const CHORD_PRESENCE = 0.35

export interface ChordMatch {
  ok: boolean
  /** Косинусное сходство с ожидаемым профилем 0…1 */
  similarity: number
  /** Сходство с самым похожим «соседом» (аккорд с одной нотой на полтона в сторону) */
  nearestVariant: number
  /** Сколько нот аккорда (без октав) слышно */
  present: number
  total: number
}

/** Ожидаемая хрома аккорда из его нот с обертонами, в том же диапазоне частот, что и анализ */
export function expectedChroma(midis: readonly number[]): Float32Array {
  const chroma = new Float32Array(12)
  for (const midi of midis) {
    GUITAR_HARMONIC_PROFILE.forEach((amplitude, i) => {
      const harmonic = i + 1
      const hz = midiToFreq(midi) * harmonic
      if (hz < CHROMA_MIN_HZ || hz > CHROMA_MAX_HZ) return
      const pc = ((Math.round(midi + 12 * Math.log2(harmonic)) % 12) + 12) % 12
      chroma[pc]! += amplitude
    })
  }
  const max = Math.max(...chroma)
  if (max > 0) for (let i = 0; i < 12; i++) chroma[i]! /= max
  return chroma
}

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < 12; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0
}

const pcOf = (m: number) => ((Math.round(m) % 12) + 12) % 12

/**
 * «Соседи» аккорда: все ноты одного звука (без октав) сдвинуты на полтона вверх или вниз,
 * или убраны совсем (если в аккорде больше одного звука)
 */
export function chordVariants(midis: readonly number[]): number[][] {
  const classes = [...new Set(midis.map(pcOf))]
  return classes.flatMap((pc) => {
    const shifted = [-1, 1].map((shift) => midis.map((m) => (pcOf(m) === pc ? m + shift : m)))
    return classes.length > 1 ? [...shifted, midis.filter((m) => pcOf(m) !== pc)] : shifted
  })
}

export function matchChord(chroma: ArrayLike<number>, midis: readonly number[]): ChordMatch {
  const similarity = cosine(chroma, expectedChroma(midis))
  const classes = new Set(midis.map((m) => ((Math.round(m) % 12) + 12) % 12))
  let present = 0
  for (const pc of classes) if ((chroma[pc] ?? 0) >= CHORD_PRESENCE) present++
  const nearestVariant = Math.max(
    0,
    ...chordVariants(midis).map((variant) => cosine(chroma, expectedChroma(variant))),
  )
  return {
    ok: similarity >= CHORD_SIMILARITY && present === classes.size && similarity > nearestVariant,
    similarity,
    nearestVariant,
    present,
    total: classes.size,
  }
}

/** Аккорд в смысле судейства: хотя бы два разных звука (без октав) */
export function isChord(midis: readonly number[]): boolean {
  return new Set(midis.map(pcOf)).size >= 2
}

import type { FrettedNote } from '@/domain/tracks/types'
import { ATLAS_MAX, GLYPH } from './digitAtlas'

// Как нота выглядит на дорожке: форма плашки, надпись на ней и знаки приёмов над ней.
// Считается один раз при загрузке нот, в цикле кадра — только чтение из массивов.

export const SHAPE_GEM = 0
export const SHAPE_HARMONIC = 1
export const SHAPE_DEAD = 2

/** Сколько знаков приёмов помещается над нотой */
export const MAX_MARKS = 2

export interface NoteLook {
  shape: number
  /** Палм-мьют: полоса на плашке */
  mute: boolean
  /** Глиф на плашке: номер лада или × */
  label: number
  /** Глифы знаков над плашкой, по важности, не больше MAX_MARKS */
  marks: number[]
}

/** Знак величины бенда, полутоны → ½, 1, 1½, 2 тона */
function bendGlyph(semitones: number): number {
  if (semitones <= 1) return GLYPH.bendHalf
  if (semitones <= 2) return GLYPH.bendFull
  if (semitones <= 3) return GLYPH.bendOneHalf
  return GLYPH.bendTwo
}

export function noteLook(note: FrettedNote): NoteLook {
  const t = note.technique
  const marks: number[] = []
  const bend = t?.bend
  if (bend) {
    // Пребенд показывает, на сколько подтянуть до удара; обычный бенд — до какой высоты
    const amount = bend.from > 0 ? bend.from : bend.peak
    if (amount > 0) marks.push(bendGlyph(amount))
    if (bend.to < Math.max(bend.from, bend.peak)) marks.push(GLYPH.release)
  }
  if (t?.legato === 'hammer') marks.push(GLYPH.hammer)
  if (t?.legato === 'pull') marks.push(GLYPH.pull)
  if (t?.slideIn === 'below') marks.push(GLYPH.slideUp)
  if (t?.slideIn === 'above') marks.push(GLYPH.slideDown)
  if (t?.slideOut) marks.push(t.slideOut.frets >= 0 ? GLYPH.slideUp : GLYPH.slideDown)
  if (t?.palmMute) marks.push(GLYPH.palmMute)
  if (t?.vibrato) marks.push(GLYPH.vibrato)

  return {
    shape: t?.dead ? SHAPE_DEAD : t?.harmonic ? SHAPE_HARMONIC : SHAPE_GEM,
    mute: t?.palmMute ?? false,
    label: t?.dead ? GLYPH.dead : Math.max(0, Math.min(ATLAS_MAX, Math.round(note.fret))),
    marks: marks.slice(0, MAX_MARKS),
  }
}

/** Вид всех нот в плоских массивах — для цикла кадра без аллокаций */
export interface NoteLooks {
  shape: Uint8Array
  mute: Uint8Array
  label: Int16Array
  /** MAX_MARKS глифов на ноту, −1 — пусто */
  marks: Int16Array
}

export function buildNoteLooks(notes: readonly FrettedNote[]): NoteLooks {
  const looks: NoteLooks = {
    shape: new Uint8Array(notes.length),
    mute: new Uint8Array(notes.length),
    label: new Int16Array(notes.length),
    marks: new Int16Array(notes.length * MAX_MARKS).fill(-1),
  }
  notes.forEach((note, i) => {
    const look = noteLook(note)
    looks.shape[i] = look.shape
    looks.mute[i] = look.mute ? 1 : 0
    looks.label[i] = look.label
    look.marks.forEach((glyph, k) => (looks.marks[i * MAX_MARKS + k] = glyph))
  })
  return looks
}

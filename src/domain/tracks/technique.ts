// Приёмы исполнения ноты (из Guitar Pro). В MIDI их нет.
// Высота ноты (NoteEvent.midi) — звучащая высота в момент удара без бенда:
// у флажолета — высота флажолета, у бенда — прижатый лад; диапазон, который засчитывается
// при игре, даёт pitchRange.

export interface BendTechnique {
  /** С какой высоты нота начинается, полутоны над ладом (пребенд — больше нуля) */
  from: number
  /** Максимум подтяжки, полутоны */
  peak: number
  /** Чем заканчивается, полутоны (отпускание — меньше peak) */
  to: number
}

export interface SlideOut {
  /** На сколько ладов уезжает (плюс — вверх по грифу) */
  frets: number
  /** Ведёт в следующую ноту (слайд к ноте); иначе — «в никуда» */
  toNote: boolean
}

export interface NoteTechnique {
  harmonic?: 'natural' | 'artificial'
  bend?: BendTechnique
  /** Нота звучит без удара: хаммер-он, пулл-офф или легато-слайд из предыдущей */
  legato?: 'hammer' | 'pull' | 'slide'
  /** Въезд в ноту слайдом снизу или сверху */
  slideIn?: 'below' | 'above'
  slideOut?: SlideOut
  palmMute?: boolean
  vibrato?: boolean
  /** Глухая нота: только удар, без высоты */
  dead?: boolean
}

/** Длина слайда «в никуда», ладов — для отрисовки */
export const SLIDE_OUT_FRETS = 3
/** На сколько полутонов может «не доехать» слайд в ноту, когда звучит её начало */
export const SLIDE_IN_RANGE = 4

export interface PitchRange {
  low: number
  high: number
}

/**
 * Какие высоты засчитываются за эту ноту: звучит начало ноты, поэтому у бенда —
 * весь путь подтяжки, у слайда в ноту — несколько полутонов со стороны въезда.
 */
export function pitchRange(midi: number, technique?: NoteTechnique): PitchRange {
  let low = midi
  let high = midi
  const bend = technique?.bend
  if (bend) {
    low = midi + Math.min(bend.from, bend.peak, bend.to)
    high = midi + Math.max(bend.from, bend.peak, bend.to)
  }
  if (technique?.slideIn === 'below') low -= SLIDE_IN_RANGE
  if (technique?.slideIn === 'above') high += SLIDE_IN_RANGE
  return { low, high }
}

/** Пустой ли набор приёмов (чтобы не хранить пустые объекты) */
export function hasTechnique(t: NoteTechnique): boolean {
  return Object.values(t).some((v) => v !== undefined && v !== false)
}

/**
 * Приёмы, которые имеют смысл в другой расстановке (строй не совпал с файлом):
 * флажолет и слайды привязаны к ладам из файла, поэтому сбрасываются,
 * остальное зависит только от высоты.
 */
export function portableTechnique(t: NoteTechnique | undefined): NoteTechnique | undefined {
  if (!t) return undefined
  const result: NoteTechnique = {
    bend: t.bend,
    legato: t.legato === 'slide' ? undefined : t.legato,
    palmMute: t.palmMute,
    vibrato: t.vibrato,
    dead: t.dead,
  }
  for (const key of Object.keys(result) as (keyof NoteTechnique)[]) {
    if (result[key] === undefined) delete result[key]
  }
  return hasTechnique(result) ? result : undefined
}

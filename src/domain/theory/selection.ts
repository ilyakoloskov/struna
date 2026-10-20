import { formatNote as formatMidiNote, parseNote } from '@/domain/music/pitch'
import { findPreset, isValidCustomMidis, type TuningId } from '@/domain/music/tunings'
import { clampFretRange, formatFretRange, parseFretRange, type FretRange } from './fretboard'
import { isSameNote, parseSpelledNote, toAscii, type SpelledNote } from './notes'
import { findScale, type LabelKind, type ScaleId } from './scales'

// Выбор на страницах теории ↔ query-параметры URL, чтобы ссылкой можно было поделиться:
// /theory/fretboard?key=E&mode=phrygian&tuning=7-standard-b&labels=degrees&frets=0-12

export type LabelMode = LabelKind
export const LABEL_MODES: readonly LabelMode[] = ['notes', 'degrees', 'intervals']

export interface TheorySelection {
  tonic: SpelledNote
  scaleId: ScaleId
  labels: LabelMode
  fretRange: FretRange
}

export interface TuningSelection {
  tuningId: TuningId
  customMidis?: number[]
}

export const DEFAULT_SELECTION: TheorySelection = {
  tonic: { letter: 'E', alt: 0 },
  scaleId: 'ionian',
  labels: 'notes',
  fretRange: { from: 0, to: 15 },
}

export type QueryValue = string | null | (string | null)[] | undefined
export type Query = Record<string, QueryValue>

function first(value: QueryValue): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v : undefined
}

/** Читает из query только корректные значения; остальное игнорируется */
export function parseTheoryQuery(query: Query): Partial<TheorySelection> {
  const result: Partial<TheorySelection> = {}
  const key = first(query.key)
  const tonic = key ? parseSpelledNote(key) : null
  if (tonic && Math.abs(tonic.alt) <= 1) result.tonic = tonic

  const mode = first(query.mode)
  const scale = mode ? findScale(mode) : undefined
  if (scale) result.scaleId = scale.id

  const labels = first(query.labels)
  if (labels && (LABEL_MODES as readonly string[]).includes(labels)) {
    result.labels = labels as LabelMode
  }

  const frets = first(query.frets)
  const range = frets ? parseFretRange(frets) : null
  if (range) result.fretRange = clampFretRange(range)
  return result
}

/** Query для выбора; подписи и лады по умолчанию не пишем, чтобы ссылка была короче */
export function toTheoryQuery(selection: TheorySelection): Record<string, string> {
  const query: Record<string, string> = {
    key: toAscii(selection.tonic),
    mode: selection.scaleId,
  }
  if (selection.labels !== DEFAULT_SELECTION.labels) query.labels = selection.labels
  const { from, to } = selection.fretRange
  if (from !== DEFAULT_SELECTION.fretRange.from || to !== DEFAULT_SELECTION.fretRange.to) {
    query.frets = formatFretRange(selection.fretRange)
  }
  return query
}

const CUSTOM_PREFIX = 'custom-'

/** «7-standard-b» или «custom-B1-E2-A2-D3-G3-B3-E4» */
export function encodeTuningParam(selection: TuningSelection): string {
  if (selection.tuningId !== 'custom' || !selection.customMidis) return selection.tuningId
  const notes = selection.customMidis.map((m) => formatMidiNote(m).replace('♯', '#'))
  return `${CUSTOM_PREFIX}${notes.join('-')}`
}

export function decodeTuningParam(value: QueryValue): TuningSelection | null {
  const text = first(value)
  if (!text) return null
  if (text.startsWith(CUSTOM_PREFIX)) {
    const midis = text.slice(CUSTOM_PREFIX.length).split('-').map(parseNote)
    return isValidCustomMidis(midis) ? { tuningId: 'custom', customMidis: midis } : null
  }
  const preset = findPreset(text)
  return preset ? { tuningId: preset.id } : null
}

export function isSameSelection(a: TheorySelection, b: TheorySelection): boolean {
  return (
    isSameNote(a.tonic, b.tonic) &&
    a.scaleId === b.scaleId &&
    a.labels === b.labels &&
    a.fretRange.from === b.fretRange.from &&
    a.fretRange.to === b.fretRange.to
  )
}

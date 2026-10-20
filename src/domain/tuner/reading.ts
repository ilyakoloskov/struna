import { midiToNoteName } from '@/domain/music/pitch'
import type { Tuning } from '@/domain/music/tunings'
import { pluralRu } from '@/domain/ru'

export { pluralRu }

export type TuneStatus = 'in-tune' | 'close' | 'flat' | 'sharp'

/** Порог «в строе», центы */
export const IN_TUNE_CENTS = 3
/** Порог «почти в строе», центы */
export const CLOSE_CENTS = 10

export interface TunerReading {
  /** Нота, к которой подстраиваемся (целый MIDI) */
  targetMidi: number
  name: string
  octave: number
  /** Отклонение от целевой ноты в центах */
  cents: number
  /** Индекс струны (от низкой), если цель — открытая струна */
  stringIndex: number | null
  status: TuneStatus
}

/**
 * Показания тюнера.
 * Авто-режим: цель — ближайший полутон, струна подсвечивается, если он совпадает с открытой струной.
 * Режим фиксированной струны: цель — нота выбранной струны, отклонение может быть больше полутона.
 */
export function computeTunerReading(
  midi: number,
  tuning: Tuning,
  lockedStringIndex: number | null = null,
): TunerReading {
  const locked = lockedStringIndex !== null ? tuning.strings[lockedStringIndex] : undefined
  const targetMidi = locked ? locked.midi : Math.round(midi)
  const stringIndex = locked
    ? lockedStringIndex
    : tuning.strings.findIndex((s) => s.midi === targetMidi)
  const cents = (midi - targetMidi) * 100
  const { name, octave } = midiToNoteName(targetMidi, tuning.accidental)

  return {
    targetMidi,
    name,
    octave,
    cents,
    stringIndex: stringIndex === -1 ? null : stringIndex,
    status: tuneStatus(cents),
  }
}

export function tuneStatus(cents: number): TuneStatus {
  const abs = Math.abs(cents)
  if (abs <= IN_TUNE_CENTS) return 'in-tune'
  if (abs <= CLOSE_CENTS) return 'close'
  return cents < 0 ? 'flat' : 'sharp'
}

const STATUS_TEXT: Record<TuneStatus, string> = {
  'in-tune': 'в строе',
  close: 'почти в строе',
  flat: 'ниже — подтяни',
  sharp: 'выше — ослабь',
}

export function statusText(status: TuneStatus): string {
  return STATUS_TEXT[status]
}

/** «+4 цента», «−1 цент», «0 центов» */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents)
  const abs = Math.abs(rounded)
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${abs} ${pluralRu(abs, 'цент', 'цента', 'центов')}`
}

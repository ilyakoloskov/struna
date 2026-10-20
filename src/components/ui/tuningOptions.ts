import { TUNING_PRESETS, type TuningId } from '@/domain/music/tunings'
import type { SelectOption } from './types'

/** Варианты строя для выпадающих списков: пресеты + свой */
export const TUNING_OPTIONS: readonly SelectOption<TuningId>[] = [
  ...TUNING_PRESETS.map((t) => ({ value: t.id, label: t.label })),
  { value: 'custom', label: 'Свой строй…' },
]

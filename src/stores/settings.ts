import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_A4 } from '@/domain/music/pitch'
import { DEFAULT_LOOKAHEAD } from '@/game/lane/geometry'
import {
  DEFAULT_TUNING_ID,
  createCustomTuning,
  defaultCustomMidis,
  findPreset,
  isValidCustomMidis,
  type Tuning,
  type TuningId,
} from '@/domain/music/tunings'

// Настройки — в localStorage: маленькие и нужны синхронно на старте (решение этапа 7)
const STORAGE_KEY = 'struna:settings:v1'

interface PersistedSettings {
  tuningId: TuningId
  customMidis: number[]
  inputDeviceId: string | null
  a4: number
  /** Поправка задержки по калибровке, мс (плюс — удары приходят позже) */
  latencyOffsetMs: number
  /** Сколько секунд вперёд видно нот на дорожке (скорость нот) */
  noteLookahead: number
}

export const LATENCY_OFFSET_LIMIT = 300
export const LOOKAHEAD_RANGE = { min: 1.4, max: 3.4 } as const

function loadSettings(): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<PersistedSettings>) : {}
  } catch {
    return {}
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()

  const tuningId = ref<TuningId>(
    saved.tuningId === 'custom' || (saved.tuningId && findPreset(saved.tuningId))
      ? saved.tuningId
      : DEFAULT_TUNING_ID,
  )
  const customMidis = ref<number[]>(
    isValidCustomMidis(saved.customMidis) ? saved.customMidis : defaultCustomMidis(7),
  )
  const inputDeviceId = ref<string | null>(
    typeof saved.inputDeviceId === 'string' ? saved.inputDeviceId : null,
  )
  const a4 = ref(
    typeof saved.a4 === 'number' && saved.a4 >= 415 && saved.a4 <= 466 ? saved.a4 : DEFAULT_A4,
  )
  const latencyOffsetMs = ref(
    typeof saved.latencyOffsetMs === 'number' &&
      Math.abs(saved.latencyOffsetMs) <= LATENCY_OFFSET_LIMIT
      ? saved.latencyOffsetMs
      : 0,
  )
  const noteLookahead = ref(
    typeof saved.noteLookahead === 'number' &&
      saved.noteLookahead >= LOOKAHEAD_RANGE.min &&
      saved.noteLookahead <= LOOKAHEAD_RANGE.max
      ? saved.noteLookahead
      : DEFAULT_LOOKAHEAD,
  )

  const tuning = computed<Tuning>(() =>
    tuningId.value === 'custom'
      ? createCustomTuning(customMidis.value)
      : (findPreset(tuningId.value) ?? findPreset(DEFAULT_TUNING_ID)!),
  )

  function setCustomMidis(midis: number[]) {
    if (isValidCustomMidis(midis)) customMidis.value = [...midis]
  }

  watch(
    [tuningId, customMidis, inputDeviceId, a4, latencyOffsetMs, noteLookahead],
    () => {
      const data: PersistedSettings = {
        tuningId: tuningId.value,
        customMidis: customMidis.value,
        inputDeviceId: inputDeviceId.value,
        a4: a4.value,
        latencyOffsetMs: latencyOffsetMs.value,
        noteLookahead: noteLookahead.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // Хранилище недоступно (приватный режим) — работаем без сохранения
      }
    },
    { deep: true },
  )

  return {
    tuningId,
    customMidis,
    inputDeviceId,
    a4,
    latencyOffsetMs,
    noteLookahead,
    tuning,
    setCustomMidis,
  }
})

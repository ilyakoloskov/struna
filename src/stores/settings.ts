import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_A4 } from '@/domain/music/pitch'
import {
  DEFAULT_TUNING_ID,
  createCustomTuning,
  defaultCustomMidis,
  findPreset,
  isValidCustomMidis,
  type Tuning,
  type TuningId,
} from '@/domain/music/tunings'

// Пока настройки живут в localStorage; на этапе 7 переедут в IndexedDB
const STORAGE_KEY = 'struna:settings:v1'

interface PersistedSettings {
  tuningId: TuningId
  customMidis: number[]
  inputDeviceId: string | null
  a4: number
}

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

  const tuning = computed<Tuning>(() =>
    tuningId.value === 'custom'
      ? createCustomTuning(customMidis.value)
      : (findPreset(tuningId.value) ?? findPreset(DEFAULT_TUNING_ID)!),
  )

  function setCustomMidis(midis: number[]) {
    if (isValidCustomMidis(midis)) customMidis.value = [...midis]
  }

  watch(
    [tuningId, customMidis, inputDeviceId, a4],
    () => {
      const data: PersistedSettings = {
        tuningId: tuningId.value,
        customMidis: customMidis.value,
        inputDeviceId: inputDeviceId.value,
        a4: a4.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // Хранилище недоступно (приватный режим) — работаем без сохранения
      }
    },
    { deep: true },
  )

  return { tuningId, customMidis, inputDeviceId, a4, tuning, setCustomMidis }
})

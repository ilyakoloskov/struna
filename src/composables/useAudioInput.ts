import { computed, onBeforeUnmount, onMounted, readonly, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  AudioInput,
  AudioInputError,
  audioInput,
  type AudioInputErrorCode,
  type InputDevice,
  type PitchRange,
} from '@/audio/audioInput'
import { SILENCE_DB, amplitudeToDb } from '@/audio/dsp/level'
import { highestMidi, lowestMidi } from '@/domain/music/tunings'
import { useSettingsStore } from '@/stores/settings'
import { useAnimationFrame } from './useAnimationFrame'

export type InputStatus = 'idle' | 'starting' | 'running' | 'needs-gesture' | 'error'

// Состояние общее для всех экранов: вход один на приложение
const status = ref<InputStatus>('idle')
const errorCode = ref<AudioInputErrorCode | null>(null)
const devices = shallowRef<InputDevice[]>([])
const peakDb = ref(SILENCE_DB)
let users = 0
let deviceListenerAttached = false

/** Скорость спада индикатора уровня, дБ/с */
const PEAK_DECAY_DB_PER_SECOND = 30

async function refreshDevices() {
  try {
    devices.value = await AudioInput.listDevices()
  } catch {
    devices.value = []
  }
}

async function hasMicrophonePermission(): Promise<boolean> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return result.state === 'granted'
  } catch {
    return false
  }
}

/**
 * Доступ к звуковому входу. Пока экран, вызвавший composable, смонтирован, вход держится открытым;
 * когда последний такой экран закрыт — поток останавливается и микрофон освобождается.
 */
export function useAudioInput() {
  const settings = useSettingsStore()
  const { inputDeviceId, tuning, a4 } = storeToRefs(settings)

  const range = computed<PitchRange>(() => ({
    lowestMidi: lowestMidi(tuning.value),
    highestMidi: highestMidi(tuning.value),
    a4: a4.value,
  }))

  async function start() {
    if (status.value === 'starting') return
    status.value = 'starting'
    errorCode.value = null
    try {
      try {
        await audioInput.start(inputDeviceId.value, range.value)
      } catch (error) {
        // Сохранённое устройство отключено — пробуем вход по умолчанию
        if (error instanceof AudioInputError && error.code === 'not-found' && inputDeviceId.value) {
          inputDeviceId.value = null
          await audioInput.start(null, range.value)
        } else {
          throw error
        }
      }
      // После выдачи разрешения у устройств появляются названия
      await refreshDevices()
      status.value = audioInput.isSuspended ? 'needs-gesture' : 'running'
    } catch (error) {
      status.value = 'error'
      errorCode.value = error instanceof AudioInputError ? error.code : 'unknown'
    }
  }

  async function resume() {
    await audioInput.resume()
    if (!audioInput.isSuspended) status.value = 'running'
  }

  async function stop() {
    await audioInput.stop()
    status.value = 'idle'
    peakDb.value = SILENCE_DB
  }

  // Индикатор уровня: пик за кадр с плавным спадом
  let framePeak = 0
  const unsubscribe = audioInput.onFrame((frame) => {
    if (frame.peak > framePeak) framePeak = frame.peak
  })
  useAnimationFrame((dt) => {
    if (status.value !== 'running') return
    const db = amplitudeToDb(framePeak)
    framePeak = 0
    peakDb.value = Math.max(db, peakDb.value - (PEAK_DECAY_DB_PER_SECOND * dt) / 1000)
  })

  watch(range, (value) => {
    if (audioInput.isRunning) audioInput.setRange(value)
  })

  watch(inputDeviceId, () => {
    if (audioInput.isRunning) void start()
  })

  onMounted(async () => {
    users++
    if (!deviceListenerAttached && AudioInput.isSupported()) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
      deviceListenerAttached = true
    }
    if (!AudioInput.isSupported()) {
      status.value = 'error'
      errorCode.value = 'unsupported'
      return
    }
    await refreshDevices()
    // Если доступ уже выдан — включаемся сразу, без лишнего клика
    if (!audioInput.isRunning && (await hasMicrophonePermission())) await start()
  })

  onBeforeUnmount(() => {
    unsubscribe()
    users--
    if (users === 0 && audioInput.isRunning) void stop()
  })

  return {
    status: readonly(status),
    errorCode: readonly(errorCode),
    devices,
    peakDb: readonly(peakDb),
    selectedDeviceId: inputDeviceId,
    start,
    resume,
    stop,
  }
}

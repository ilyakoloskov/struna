import { onBeforeUnmount, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { audioInput } from '@/audio/audioInput'
import { PitchStabilizer, type StableReading } from '@/audio/dsp/stabilizer'
import { midiToFreq } from '@/domain/music/pitch'
import { useSettingsStore } from '@/stores/settings'
import { useAnimationFrame } from './useAnimationFrame'

export interface DetectedPitch extends StableReading {
  /** Сглаженная частота, Гц */
  freq: number
}

/**
 * Стабилизированная высота с аудиовхода.
 * Каждый кадр анализа (~10 мс) идёт в стабилизатор, а реактивное значение
 * обновляется не чаще кадра отрисовки.
 */
export function usePitchDetector() {
  const { a4 } = storeToRefs(useSettingsStore())
  let stabilizer = new PitchStabilizer({ a4: a4.value })
  let latest: StableReading | null = null
  let dirty = false

  const pitch = shallowRef<DetectedPitch | null>(null)

  watch(a4, (value) => {
    stabilizer = new PitchStabilizer({ a4: value })
  })

  const unsubscribe = audioInput.onFrame((frame) => {
    latest = stabilizer.push(frame)
    dirty = true
  })

  useAnimationFrame(() => {
    if (!dirty) return
    dirty = false
    pitch.value = latest ? { ...latest, freq: midiToFreq(latest.midi, a4.value) } : null
  })

  onBeforeUnmount(unsubscribe)

  return { pitch }
}

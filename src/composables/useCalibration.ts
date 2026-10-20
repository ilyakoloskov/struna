import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { audioInput } from '@/audio/audioInput'
import { getAudioContext, resumeAudioContext } from '@/audio/context'
import { scheduleClick } from '@/audio/playback/instruments'
import { outputLatencyOf } from '@/game/clock'
import { CALIBRATION_CLICKS, analyzeCalibration, type CalibrationOutcome } from '@/game/calibration'

// Калибровка задержки: 4 щелчка вступления + 16 щелчков, на каждый — удар по струне.
// Щелчок слышен в момент отправки + задержка вывода; удар доходит до нас + задержка ввода.
// Остаток сверх этих известных задержек — поправка, которую прибавляем при судействе.

const BPM = 90
const LEAD_IN = 4

export type CalibrationState = 'idle' | 'running' | 'done'

export function useCalibration() {
  const state = ref<CalibrationState>('idle')
  /** Номер текущего щелчка (вступление — отрицательные) */
  const beat = ref(-LEAD_IN)
  const hits = ref(0)
  const outcome = shallowRef<CalibrationOutcome | null>(null)

  let clicks: number[] = []
  let onsets: number[] = []
  let timer = 0
  let unsubscribe: (() => void) | null = null
  let gain: GainNode | null = null

  async function start() {
    if (state.value === 'running') return
    await resumeAudioContext()
    const context = getAudioContext()
    gain ??= (() => {
      const node = context.createGain()
      node.gain.value = 0.9
      node.connect(context.destination)
      return node
    })()

    const interval = 60 / BPM
    const first = context.currentTime + 0.3
    clicks = []
    onsets = []
    hits.value = 0
    outcome.value = null
    for (let i = 0; i < LEAD_IN + CALIBRATION_CLICKS; i++) {
      const when = first + i * interval
      scheduleClick(context, when, i % 4 === 0, gain)
      if (i >= LEAD_IN) clicks.push(when)
    }

    const last = clicks.at(-1)!
    unsubscribe = audioInput.onOnset((onset) => {
      onsets.push(onset.time / 1000)
      if (onset.time / 1000 >= clicks[0]! - 0.3) hits.value++
    })
    state.value = 'running'

    // Индикатор текущего щелчка
    const tick = () => {
      const now = context.currentTime
      beat.value = Math.floor((now - first) / interval) - LEAD_IN
      if (now > last + 0.6) {
        finish()
        return
      }
      timer = requestAnimationFrame(tick)
    }
    timer = requestAnimationFrame(tick)
  }

  function finish() {
    cancelAnimationFrame(timer)
    unsubscribe?.()
    unsubscribe = null
    const context = getAudioContext()
    // Когда игрок слышит щелчок и когда реально ударил — по известным задержкам
    const heard = clicks.map((c) => c + outputLatencyOf(context))
    const played = onsets.map((o) => o - audioInput.inputLatency)
    outcome.value = analyzeCalibration(heard, played)
    state.value = 'done'
  }

  function cancel() {
    cancelAnimationFrame(timer)
    unsubscribe?.()
    unsubscribe = null
    state.value = 'idle'
  }

  onBeforeUnmount(() => {
    cancel()
    gain?.disconnect()
  })

  return { state, beat, hits, outcome, start, cancel, total: CALIBRATION_CLICKS }
}

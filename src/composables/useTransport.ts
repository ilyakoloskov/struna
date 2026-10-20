import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { getAudioContext } from '@/audio/context'
import { Transport, type TransportOptions, type TransportState } from '@/audio/playback/transport'
import type { LoadProgress } from '@/audio/playback/instruments'
import type { Song } from '@/domain/tracks/types'
import { heardTime, outputLatencyOf, type GameClock } from '@/game/clock'
import { useAnimationFrame } from './useAnimationFrame'

/** Транспорт трека для экрана: реактивное состояние, позиция обновляется по кадрам отрисовки */
export function useTransport() {
  const transport = new Transport()

  const state = ref<TransportState>(transport.state)
  const position = ref(0)
  const duration = ref(0)
  const progress = shallowRef<LoadProgress>(transport.progress)
  const failedInstruments = shallowRef<string[]>([])
  const options = shallowRef<TransportOptions>(transport.options)

  const sync = () => {
    state.value = transport.state
    duration.value = transport.duration
    progress.value = transport.progress
    failedInstruments.value = transport.failedInstruments
    options.value = transport.options
    position.value = transport.position
  }
  const unsubscribe = transport.onChange(sync)

  useAnimationFrame(() => {
    if (transport.state === 'playing' || transport.state === 'counting') {
      position.value = transport.position
    }
  })

  onBeforeUnmount(() => {
    unsubscribe()
    transport.dispose()
  })

  // Часы для рендера: читают транспорт напрямую (без реактивности) с учётом задержки вывода звука
  const clock: GameClock = {
    now: () => heardTime(transport.position, outputLatencyOf(getAudioContext())),
  }

  return {
    clock,
    /** Время трека для момента по часам AudioContext — точно, без привязки к кадрам */
    songTimeAt: (contextTime: number) => transport.songTimeAt(contextTime),
    state,
    position,
    duration,
    progress,
    failedInstruments,
    options,
    load: (song: Song) => transport.load(song),
    play: () => transport.play(),
    pause: () => transport.pause(),
    toggle: () =>
      transport.state === 'playing' || transport.state === 'counting'
        ? transport.pause()
        : transport.play(),
    stop: () => transport.stop(),
    seek: (time: number) => transport.seek(time),
    setOptions: (partial: Partial<TransportOptions>) => transport.setOptions(partial),
  }
}

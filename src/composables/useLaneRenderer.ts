import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import type { GameClock } from '@/game/clock'
import { LaneRenderer, type FrameStats } from '@/game/render/LaneRenderer'
import type { Beat, FrettedNote } from '@/domain/tracks/types'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

export interface LaneSource {
  stringCount: number
  notes: readonly FrettedNote[]
  beats: readonly Beat[]
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * WebGL-дорожка в canvas: создаётся при монтировании, пересоздаётся при смене числа струн.
 * Отдаёт экранные позиции струн для подписей HUD и статистику кадров.
 */
export function useLaneRenderer(
  canvas: Ref<HTMLCanvasElement | null>,
  source: Ref<LaneSource | null>,
  clock: GameClock,
) {
  const { noteLookahead } = storeToRefs(useSettingsStore())
  const renderer = shallowRef<LaneRenderer | null>(null)
  const labelX = ref<number[]>([])
  const hitLineY = ref(0)
  const ready = ref(false)
  let noteStates: Uint8Array | null = null

  async function create(stringCount: number) {
    renderer.value?.dispose()
    ready.value = false
    if (!canvas.value) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const instance = new LaneRenderer(
      canvas.value,
      {
        stringCount,
        // Цвета струн из дизайн-токенов: у струны с номером N — --string-N
        stringColors: Array.from({ length: stringCount }, (_, i) =>
          cssVar(`--string-${stringCount - i}`),
        ),
        background: cssVar('--color-bg') || '#07070b',
        reducedMotion,
        lookahead: noteLookahead.value,
      },
      (xs, y) => {
        labelX.value = xs
        hitLineY.value = y
      },
    )
    renderer.value = instance
    await instance.init()
    if (renderer.value !== instance) return
    if (source.value) {
      instance.setNotes(source.value.notes)
      instance.setBeats(source.value.beats)
    }
    instance.setNoteStates(noteStates)
    instance.start(clock)
    ready.value = true
  }

  onMounted(() => {
    if (source.value) void create(source.value.stringCount)
  })

  watch(source, (next, previous) => {
    if (!next) return
    if (!renderer.value || next.stringCount !== previous?.stringCount) {
      void create(next.stringCount)
      return
    }
    renderer.value.setNotes(next.notes)
    renderer.value.setBeats(next.beats)
  })

  // Скорость нот поменялась в настройках — пересоздаём дорожку
  watch(noteLookahead, () => {
    if (source.value) void create(source.value.stringCount)
  })

  onBeforeUnmount(() => {
    renderer.value?.dispose()
    renderer.value = null
  })

  return {
    labelX,
    hitLineY,
    ready,
    stats: (): FrameStats | null => renderer.value?.stats() ?? null,
    /** Состояния нот — общий массив с сессией игры; переживает пересоздание рендера */
    setNoteStates(states: Uint8Array | null) {
      noteStates = states
      renderer.value?.setNoteStates(states)
    },
    hit: (strings: readonly number[], perfect: boolean) => renderer.value?.hit(strings, perfect),
    resetEffects: () => renderer.value?.resetEffects(),
  }
}

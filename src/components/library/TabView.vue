<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import bravuraWoff2 from '@coderline/alphatab/font/Bravura.woff2?url'
import type { AlphaTabApi } from '@coderline/alphatab'

// Табулатура Guitar Pro через alphaTab. Звук — наш транспорт, alphaTab только рисует:
// режим «внешнего проигрывателя» — мы сообщаем время трека, alphaTab сам переводит его в позицию
// курсора (с повторами и сменами темпа); клик по такту приходит обратно как перемотка.
// alphaTab грузится лениво; рендер в основном потоке (без воркеров) — табулатура открывается изредка.

const props = defineProps<{
  source: ArrayBuffer
  trackIndex: number
  /** Позиция транспорта, с */
  position: number
  duration: number
}>()

const emit = defineEmits<{ seek: [time: number]; play: []; pause: [] }>()

interface ExternalOutput {
  handler: unknown
  updatePosition(currentTime: number): void
}

const host = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
let api: AlphaTabApi | null = null
let output: ExternalOutput | null = null

// Тёмная тема в цветах приложения
const COLORS = {
  staffLineColor: '#3a3650',
  barSeparatorColor: '#4a4664',
  barNumberColor: '#8e8aa6',
  mainGlyphColor: '#edebf5',
  secondaryGlyphColor: '#9c98b3',
  scoreInfoColor: '#c9c6da',
}

onMounted(async () => {
  try {
    const at = await import('@coderline/alphatab')
    if (!host.value || !scroller.value) return
    api = new at.AlphaTabApi(host.value, {
      core: {
        useWorkers: false,
        engine: 'svg',
        fontDirectory: null,
        smuflFontSources: new Map([['woff2', bravuraWoff2]]),
      },
      display: { staveProfile: 'tab', layoutMode: 'page', scale: 0.95, resources: COLORS },
      player: {
        playerMode: 'EnabledExternalMedia',
        enableCursor: true,
        enableUserInteraction: true,
        scrollElement: scroller.value,
        scrollMode: 'continuous',
      },
    })
    api.error.on(() => (state.value = 'error'))
    api.renderFinished.on(() => (state.value = 'ready'))
    api.playerReady.on(() => {
      output = api!.player!.output as unknown as ExternalOutput
      output.handler = {
        get backingTrackDuration() {
          return props.duration * 1000
        },
        playbackRate: 1,
        masterVolume: 1,
        seekTo: (ms: number) => emit('seek', ms / 1000),
        play: () => emit('play'),
        pause: () => emit('pause'),
      }
      output.updatePosition(Math.max(0, props.position) * 1000)
    })
    api.load(new Uint8Array(props.source), [props.trackIndex])
  } catch {
    state.value = 'error'
  }
})

watch(
  () => props.position,
  (position) => output?.updatePosition(Math.max(0, position) * 1000),
)

watch(
  () => props.trackIndex,
  (index) => {
    const track = api?.score?.tracks[index]
    if (track) api!.renderTracks([track])
  },
)

onBeforeUnmount(() => {
  api?.destroy()
  api = null
  output = null
})
</script>

<template>
  <div class="tab">
    <p v-if="state === 'loading'" class="tab__status" role="status">Рисую табулатуру…</p>
    <p v-else-if="state === 'error'" class="tab__status tab__status--error" role="alert">
      Не удалось нарисовать табулатуру этого файла.
    </p>
    <div ref="scroller" class="tab__scroll">
      <div ref="host" class="tab__host" />
    </div>
  </div>
</template>

<style scoped>
.tab {
  position: relative;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
}

.tab__status {
  padding: 18px;
  color: var(--color-text-muted);
}

.tab__status--error {
  color: var(--grade-good-text);
}

.tab__scroll {
  position: relative;
  height: 480px;
  overflow: auto;
}

.tab__host {
  padding: 8px 12px;
}

/* Курсор и подсветка alphaTab — в цветах приложения */
.tab :deep(.at-cursor-bar) {
  background: rgba(167, 139, 250, 0.12);
}

.tab :deep(.at-cursor-beat) {
  width: 3px;
  background: var(--color-accent);
  box-shadow: 0 0 10px var(--color-accent);
}

.tab :deep(.at-highlight *) {
  fill: var(--string-1);
  stroke: var(--string-1);
}

.tab :deep(.at-selection div) {
  background: rgba(167, 139, 250, 0.15);
}
</style>

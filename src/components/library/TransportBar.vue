<script setup lang="ts">
import { computed } from 'vue'
import type { LoadProgress } from '@/audio/playback/instruments'
import type { TransportOptions, TransportState } from '@/audio/playback/transport'
import { formatClock } from '@/domain/time'

// Плеер трека: воспроизведение, позиция, отсчёт, метроном, гитарная партия
const props = defineProps<{
  state: TransportState
  position: number
  duration: number
  progress: LoadProgress
  options: TransportOptions
  failedInstruments: string[]
}>()

const emit = defineEmits<{
  toggle: []
  stop: []
  seek: [time: number]
  options: [options: Partial<TransportOptions>]
}>()

const isPlaying = computed(() => props.state === 'playing' || props.state === 'counting')
const isLoading = computed(() => props.state === 'loading' || props.state === 'idle')
const loadPercent = computed(() =>
  props.progress.total ? Math.round((props.progress.loaded / props.progress.total) * 100) : 0,
)
const playLabel = computed(() => {
  if (isLoading.value) return 'Загружаю сэмплы'
  if (props.state === 'counting') return 'Отсчёт…'
  return isPlaying.value ? 'Пауза' : 'Играть'
})

function toggleOption(key: 'countIn' | 'metronome' | 'guitarAudible') {
  emit('options', { [key]: !props.options[key] })
}
</script>

<template>
  <div class="transport">
    <div class="transport__main">
      <button
        type="button"
        class="play"
        :disabled="isLoading"
        :aria-label="playLabel"
        :title="playLabel"
        @click="emit('toggle')"
      >
        <svg v-if="isPlaying" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        class="stop"
        :disabled="isLoading"
        aria-label="В начало"
        title="В начало"
        @click="emit('stop')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
        </svg>
      </button>

      <span class="time">{{ formatClock(Math.max(0, position)) }}</span>
      <input
        class="seek"
        type="range"
        min="0"
        :max="duration || 1"
        step="0.05"
        :value="Math.max(0, position)"
        :disabled="isLoading"
        aria-label="Позиция в треке"
        :style="{ '--fill': `${duration ? (Math.max(0, position) / duration) * 100 : 0}%` }"
        @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
      />
      <span class="time">{{ formatClock(duration) }}</span>
    </div>

    <div v-if="isLoading" class="loading" role="status">
      <div class="loading__bar"><div :style="{ width: `${loadPercent}%` }" /></div>
      <span>Загружаю сэмплы инструментов… {{ loadPercent }}%</span>
    </div>
    <p v-else-if="failedInstruments.length" class="warning" role="alert">
      Не загрузились сэмплы: {{ failedInstruments.join(', ') }} — эти дорожки будут молчать. Проверь
      сеть.
    </p>

    <div class="toggles">
      <button
        v-for="item in [
          { key: 'countIn', label: 'Отсчёт такта' },
          { key: 'metronome', label: 'Метроном' },
          { key: 'guitarAudible', label: 'Слышать гитарную партию' },
        ] as const"
        :key="item.key"
        type="button"
        class="toggle"
        :class="{ 'toggle--on': options[item.key] }"
        :aria-pressed="options[item.key]"
        @click="toggleOption(item.key)"
      >
        <span class="toggle__dot" aria-hidden="true" />
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.transport {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.transport__main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play,
.stop {
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 0;
}

.play {
  width: 52px;
  height: 52px;
  background: var(--color-text);
  color: var(--color-text-inverse);
}

.stop {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border-strong);
  background: transparent;
  color: var(--color-text);
}

.play:disabled,
.stop:disabled {
  opacity: 0.4;
  cursor: wait;
}

.time {
  width: 44px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  text-align: center;
}

.seek {
  flex: 1;
  height: 6px;
  appearance: none;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--color-text) var(--fill),
    rgba(255, 255, 255, 0.1) var(--fill)
  );
  cursor: pointer;
}

.seek::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-text-strong);
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.loading__bar {
  width: 160px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.loading__bar div {
  height: 100%;
  background: var(--color-accent);
  transition: width var(--dur-fast) linear;
}

.warning {
  font-size: 13px;
  color: var(--grade-good-text);
}

.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--color-border-mid);
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-soft);
}

.toggle__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-dim);
}

.toggle--on {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent-text);
}

.toggle--on .toggle__dot {
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent);
}
</style>

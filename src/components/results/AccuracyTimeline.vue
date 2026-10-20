<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatClock } from '@/domain/time'
import type { TimelineSegment } from '@/game/results'
import { formatAccuracy } from '@/game/score'

// Точность по ходу трека: столбик на участок. Слабые участки — красные и подписаны текстом
// (цвет не единственный признак); подсказка при наведении; таблица для скринридеров.
const props = defineProps<{
  segments: readonly TimelineSegment[]
  duration: number
  hardest: { start: number; end: number } | null
}>()

const WEAK = 0.8
const hovered = ref<number | null>(null)

const ticks = computed(() => {
  const step = props.duration > 240 ? 60 : props.duration > 60 ? 30 : 10
  const result: number[] = []
  for (let t = 0; t < props.duration - step / 3; t += step) result.push(t)
  return [...result, props.duration]
})

const tooltip = computed(() => {
  if (hovered.value === null) return null
  const s = props.segments[hovered.value]!
  return {
    left: `${((hovered.value + 0.5) / props.segments.length) * 100}%`,
    text: `${formatClock(s.start)}–${formatClock(s.end)} · ${
      s.accuracy === null ? 'нет нот' : `${formatAccuracy(s.accuracy)} · ${s.notes} нот`
    }`,
  }
})
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h2 class="card__title">Точность по ходу трека</h2>
      <span v-if="hardest" class="card__note">
        Сложный участок: {{ formatClock(hardest.start) }}–{{ formatClock(hardest.end) }}
      </span>
    </header>

    <div class="chart" @mouseleave="hovered = null">
      <div v-for="(segment, i) in segments" :key="i" class="chart__slot" @mouseenter="hovered = i">
        <span
          v-if="segment.accuracy !== null"
          class="chart__bar"
          :class="{
            'chart__bar--weak': segment.accuracy < WEAK,
            'chart__bar--hover': hovered === i,
          }"
          :style="{ height: `${Math.max(4, segment.accuracy * 100)}%` }"
        />
      </div>
      <div v-if="tooltip" class="chart__tooltip" :style="{ left: tooltip.left }" role="tooltip">
        {{ tooltip.text }}
      </div>
    </div>

    <div class="axis" aria-hidden="true">
      <span
        v-for="t in ticks"
        :key="t"
        :style="{ left: `${duration ? (t / duration) * 100 : 0}%` }"
      >
        {{ formatClock(t) }}
      </span>
    </div>

    <table class="visually-hidden">
      <caption>
        Точность по участкам трека
      </caption>
      <tr v-for="(segment, i) in segments" :key="i">
        <th>{{ formatClock(segment.start) }}–{{ formatClock(segment.end) }}</th>
        <td>{{ segment.accuracy === null ? 'нет нот' : formatAccuracy(segment.accuracy) }}</td>
      </tr>
    </table>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.card__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-strong);
}

.card__note {
  font-size: 13px;
  font-weight: 600;
  color: #ff9db0;
}

.chart {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 180px;
}

.chart__slot {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.chart__bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: rgba(52, 227, 154, 0.75);
  transition: background-color var(--dur-fast) ease;
}

.chart__bar--weak {
  background: var(--grade-miss);
  box-shadow: 0 0 14px rgba(255, 92, 122, 0.4);
}

.chart__bar--hover {
  background: var(--grade-perfect-text);
}

.chart__bar--weak.chart__bar--hover {
  background: #ff8aa0;
}

.chart__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-border-mid);
  background: var(--color-surface-3);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  pointer-events: none;
}

.axis {
  position: relative;
  height: 18px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.axis span {
  position: absolute;
  transform: translateX(-50%);
}

.axis span:first-child {
  transform: none;
}

.axis span:last-child {
  transform: translateX(-100%);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>

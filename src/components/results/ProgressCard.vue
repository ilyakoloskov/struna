<script setup lang="ts">
import { computed, ref } from 'vue'
import { pluralRu } from '@/domain/ru'
import { formatClock } from '@/domain/time'
import type { Hotspot, ProgressPoint } from '@/game/progress'
import { formatAccuracy } from '@/game/score'

// Прогресс по треку: точность каждой попытки (линия) и проблемные места по всем попыткам.
// Полный темп — сплошная точка, практика — полая (с темпом в подсказке); легенда и таблица для скринридеров.
const props = defineProps<{
  points: readonly ProgressPoint[]
  hotspots: readonly Hotspot[]
  currentId: string
}>()

const emit = defineEmits<{ loop: [hotspot: Hotspot] }>()

const WIDTH = 600
const HEIGHT = 140
const PAD = { left: 8, right: 8, top: 10, bottom: 10 }

/** Шкала точности от минимума попыток (с запасом) до 100 % — чтобы рост был виден */
const yMin = computed(() =>
  Math.max(0, Math.floor((Math.min(...props.points.map((p) => p.accuracy)) - 0.05) * 10) / 10),
)

const coords = computed(() =>
  props.points.map((p, i) => {
    const n = props.points.length
    const x = PAD.left + (n === 1 ? 0.5 : i / (n - 1)) * (WIDTH - PAD.left - PAD.right)
    const t = (p.accuracy - yMin.value) / (1 - yMin.value || 1)
    const y = PAD.top + (1 - t) * (HEIGHT - PAD.top - PAD.bottom)
    return { ...p, x, y }
  }),
)

const path = computed(() => coords.value.map((c, i) => `${i ? 'L' : 'M'}${c.x},${c.y}`).join(' '))

const hovered = ref<number | null>(null)
const tooltip = computed(() => {
  if (hovered.value === null) return null
  const c = coords.value[hovered.value]!
  const date = new Date(c.finishedAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
  const tempo = c.tempo < 1 ? ` · темп ${Math.round(c.tempo * 100)} %` : ''
  return {
    left: `${(c.x / WIDTH) * 100}%`,
    top: `${(c.y / HEIGHT) * 100}%`,
    text: `Попытка ${hovered.value + 1} · ${date} · ${formatAccuracy(c.accuracy)}${tempo}${c.practice ? ' · практика' : ''}`,
  }
})

const trend = computed(() => {
  const full = props.points.filter((p) => !p.practice)
  if (full.length < 2) return null
  const delta = full.at(-1)!.accuracy - full[0]!.accuracy
  return `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta * 1000) / 10).toLocaleString('ru-RU')} п. п. с первой попытки`
})
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h2 class="card__title">
        Прогресс · {{ points.length }}
        {{ pluralRu(points.length, 'попытка', 'попытки', 'попыток') }}
      </h2>
      <span v-if="trend" class="card__note">{{ trend }}</span>
    </header>

    <div v-if="points.length > 1" class="chart" @mouseleave="hovered = null">
      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none" aria-hidden="true">
        <line
          v-for="level in [0, 0.5, 1]"
          :key="level"
          class="grid"
          :x1="0"
          :x2="WIDTH"
          :y1="PAD.top + level * (HEIGHT - PAD.top - PAD.bottom)"
          :y2="PAD.top + level * (HEIGHT - PAD.top - PAD.bottom)"
        />
        <path class="line" :d="path" vector-effect="non-scaling-stroke" />
      </svg>
      <button
        v-for="(c, i) in coords"
        :key="c.id"
        type="button"
        class="point"
        :class="{ 'point--practice': c.practice, 'point--current': c.id === currentId }"
        :style="{ left: `${(c.x / WIDTH) * 100}%`, top: `${(c.y / HEIGHT) * 100}%` }"
        :aria-label="`Попытка ${i + 1}: ${formatAccuracy(c.accuracy)}`"
        @mouseenter="hovered = i"
        @focus="hovered = i"
        @blur="hovered = null"
      />
      <div
        v-if="tooltip"
        class="tooltip"
        :style="{ left: tooltip.left, top: tooltip.top }"
        role="tooltip"
      >
        {{ tooltip.text }}
      </div>
      <span class="axis axis--top">100 %</span>
      <span class="axis axis--bottom">{{ Math.round(yMin * 100) }} %</span>
    </div>
    <p v-else class="empty">Сыграй трек ещё раз — здесь появится график точности по попыткам.</p>

    <div v-if="points.length > 1" class="legend">
      <span><i class="legend__dot" />Полный темп</span>
      <span><i class="legend__dot legend__dot--practice" />Практика (замедление, петля)</span>
    </div>

    <div v-if="hotspots.length" class="hotspots">
      <span class="caps-label">Чаще всего ошибаешься</span>
      <div v-for="h in hotspots" :key="h.start" class="hotspot">
        <span class="hotspot__time">{{ formatClock(h.start) }}–{{ formatClock(h.end) }}</span>
        <span class="hotspot__acc"
          >{{ formatAccuracy(h.accuracy) }} в среднем за {{ h.attempts }}</span
        >
        <button type="button" class="hotspot__loop" @click="emit('loop', h)">Зациклить</button>
      </div>
    </div>

    <table class="visually-hidden">
      <caption>
        Точность по попыткам
      </caption>
      <tr v-for="(p, i) in points" :key="p.id">
        <th>Попытка {{ i + 1 }}</th>
        <td>
          {{ formatAccuracy(p.accuracy)
          }}{{ p.practice ? `, практика, темп ${Math.round(p.tempo * 100)} %` : '' }}
        </td>
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
  color: var(--grade-perfect-text);
}

.chart {
  position: relative;
  height: 140px;
  margin-left: 44px;
}

.chart svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.grid {
  stroke: rgba(255, 255, 255, 0.06);
  stroke-width: 1;
}

.line {
  fill: none;
  stroke: var(--grade-perfect);
  stroke-width: 2;
}

.point {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--color-surface);
  background: var(--grade-perfect);
}

.point::after {
  /* Цель наведения больше самой точки */
  content: '';
  position: absolute;
  inset: -8px;
}

.point--practice {
  background: var(--color-surface);
  border: 2px solid var(--grade-good);
}

.point--current {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
}

.tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--color-border-mid);
  background: var(--color-surface-3);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

.axis {
  position: absolute;
  left: -44px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.axis--top {
  top: 2px;
}

.axis--bottom {
  bottom: 2px;
}

.empty {
  color: var(--color-text-muted);
  font-size: 14px;
}

.legend {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: var(--color-text-soft);
}

.legend span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--grade-perfect);
}

.legend__dot--practice {
  background: transparent;
  border: 2px solid var(--grade-good);
}

.hotspots {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.hotspot {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 14px;
}

.hotspot__time {
  width: 96px;
  font-weight: 700;
  color: #ff9db0;
  font-variant-numeric: tabular-nums;
}

.hotspot__acc {
  flex: 1;
  color: var(--color-text-soft);
}

.hotspot__loop {
  height: 30px;
  padding: 0 12px;
  border-radius: var(--radius-chip);
  border: 1px solid rgba(255, 198, 90, 0.6);
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  color: #ffc65a;
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

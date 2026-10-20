<script setup lang="ts">
import { formatAccuracy, formatScore } from '@/game/score'

// Правая панель HUD: точность, счётчики оценок, рекорд
defineProps<{
  accuracy: number
  perfect: number
  good: number
  miss: number
  best: number | null
}>()
</script>

<template>
  <section class="panel" aria-label="Точность">
    <div class="panel__group">
      <span class="caps-label">Точность</span>
      <span class="panel__value">{{ formatAccuracy(accuracy) }}</span>
    </div>
    <ul class="counts">
      <li>
        <i class="dot dot--perfect" />Perfect<b>{{ perfect }}</b>
      </li>
      <li>
        <i class="dot dot--good" />Good<b>{{ good }}</b>
      </li>
      <li>
        <i class="dot dot--miss" />Miss<b>{{ miss }}</b>
      </li>
    </ul>
    <span v-if="best !== null" class="panel__best">Рекорд: {{ formatScore(best) }}</span>
  </section>
</template>

<style scoped>
.panel {
  width: 230px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 28px;
}

.panel__group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.panel .caps-label {
  letter-spacing: 0.18em;
}

.panel__value {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 40px;
  line-height: 1.1;
  color: var(--color-text-strong);
}

.counts {
  width: 200px;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.counts li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-soft);
}

.counts b {
  margin-left: auto;
  font-weight: 700;
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot--perfect {
  background: var(--grade-perfect);
}

.dot--good {
  background: var(--grade-good);
}

.dot--miss {
  background: var(--grade-miss);
}

.panel__best {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>

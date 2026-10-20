<script setup lang="ts">
import { computed } from 'vue'
import { CLIP_WARNING_DB, dbToMeter, levelStatus, type LevelStatus } from '@/audio/dsp/level'

const props = defineProps<{ peakDb: number; active: boolean }>()

const STATUS_TEXT: Record<LevelStatus, string> = {
  silent: 'Сигнала нет — проверь кабель и гейн',
  quiet: 'Тихо — прибавь гейн на звуковой карте',
  good: 'Хороший уровень, без перегруза',
  clipping: 'Перегруз — убавь гейн',
}

const status = computed(() => levelStatus(props.peakDb))
const fill = computed(() => `${(dbToMeter(props.peakDb) * 100).toFixed(1)}%`)
const clipMark = `${dbToMeter(CLIP_WARNING_DB) * 100}%`
</script>

<template>
  <div class="level">
    <div class="caps-label">Уровень сигнала</div>
    <div
      class="level__track"
      role="meter"
      aria-label="Уровень сигнала"
      :aria-valuenow="Math.round(peakDb)"
      aria-valuemin="-60"
      aria-valuemax="0"
    >
      <div class="level__fill" :class="`level__fill--${status}`" :style="{ width: fill }" />
      <div class="level__clip" :style="{ left: clipMark }" />
    </div>
    <div class="level__text">{{ active ? STATUS_TEXT[status] : 'Вход не подключён' }}</div>
  </div>
</template>

<style scoped>
.level {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.level__track {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
}

.level__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 5px;
  --fill-color: var(--grade-perfect);
  background: var(--fill-color);
  box-shadow: 0 0 12px color-mix(in srgb, var(--fill-color) 60%, transparent);
}

.level__fill--quiet,
.level__fill--silent {
  --fill-color: var(--grade-good);
}

.level__fill--clipping {
  --fill-color: var(--grade-miss);
}

.level__clip {
  position: absolute;
  top: -4px;
  width: 2px;
  height: 18px;
  background: var(--grade-miss);
}

.level__text {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>

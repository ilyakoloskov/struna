<script setup lang="ts">
import { computed } from 'vue'
import { CLIP_WARNING_DB, dbToMeter } from '@/audio/dsp/level'

// Нижний левый угол HUD: уровень входа столбиками и название устройства
const props = defineProps<{ peakDb: number; label: string; active: boolean }>()

const BARS = 14
const HEIGHTS = [8, 12, 16, 20, 24, 28, 26, 22, 18, 14, 10, 8, 6, 6]

const lit = computed(() => Math.round(dbToMeter(props.peakDb) * BARS))
const clipFrom = Math.round(dbToMeter(CLIP_WARNING_DB) * BARS)
</script>

<template>
  <div class="input" aria-label="Уровень входа">
    <div class="input__bars" aria-hidden="true">
      <span
        v-for="(height, i) in HEIGHTS"
        :key="i"
        :style="{ height: `${height}px` }"
        :class="{
          'bar--on': active && i < lit,
          'bar--hot': active && i < lit && i >= clipFrom - 4,
          'bar--clip': active && i < lit && i >= clipFrom,
        }"
      />
    </div>
    <div class="input__text">
      <span class="caps-label">Вход</span>
      <span class="input__label">{{ active ? label : 'не подключён' }}</span>
    </div>
  </div>
</template>

<style scoped>
.input {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.input__bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 28px;
}

.input__bars span {
  width: 5px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.14);
}

.input__bars .bar--on {
  background: var(--grade-perfect);
}

.input__bars .bar--hot {
  background: var(--grade-good);
}

.input__bars .bar--clip {
  background: var(--grade-miss);
}

.input__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.input__text .caps-label {
  font-size: 11px;
}

.input__label {
  max-width: 220px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

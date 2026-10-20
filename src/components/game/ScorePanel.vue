<script setup lang="ts">
import { computed } from 'vue'
import { MULTIPLIER } from '@/game/config'
import { formatScore, multiplierProgress } from '@/game/score'

// Левая панель HUD: счёт, множитель с комбо, шкала множителя
const props = defineProps<{ score: number; combo: number; multiplier: number }>()

/** Сегменты: каждая достигнутая ступень ×2…×4 горит, следующая заполняется по серии */
const segments = computed(() =>
  Array.from({ length: MULTIPLIER.max }, (_, i) => {
    if (i < props.multiplier - 1) return 1
    if (i === props.multiplier - 1 && props.multiplier < MULTIPLIER.max) {
      return multiplierProgress(props.combo) / MULTIPLIER.step
    }
    return 0
  }),
)
</script>

<template>
  <section class="panel" aria-label="Счёт">
    <div class="panel__group">
      <span class="caps-label">Счёт</span>
      <span class="panel__score">{{ formatScore(score) }}</span>
    </div>
    <div class="panel__combo">
      <div class="multiplier" :class="`multiplier--x${multiplier}`">×{{ multiplier }}</div>
      <div class="panel__group">
        <span class="caps-label">Комбо</span>
        <span class="panel__combo-value">{{ combo }}</span>
      </div>
    </div>
    <div class="panel__group panel__group--wide">
      <span class="caps-label">Множитель</span>
      <div class="segments">
        <span v-for="(fill, i) in segments" :key="i" class="segment">
          <i :style="{ width: `${fill * 100}%` }" />
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 36px;
  width: 230px;
}

.panel__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel__group--wide {
  gap: 8px;
}

.panel .caps-label {
  letter-spacing: 0.18em;
}

.panel__score {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 40px;
  line-height: 1.1;
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.panel__combo {
  display: flex;
  align-items: center;
  gap: 20px;
}

.panel__combo-value {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 34px;
  line-height: 1.1;
  color: var(--color-text-strong);
}

.multiplier {
  --m-color: var(--color-text-dim);
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 4px solid var(--m-color);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 28px;
  color: var(--m-color);
  transition:
    border-color var(--dur-page) ease,
    box-shadow var(--dur-page) ease;
}

.multiplier--x2 {
  --m-color: var(--string-4);
}

.multiplier--x3 {
  --m-color: var(--string-2);
}

.multiplier--x4 {
  --m-color: var(--grade-good);
  box-shadow:
    0 0 28px rgba(255, 176, 32, 0.55),
    inset 0 0 18px rgba(255, 176, 32, 0.3);
  color: var(--grade-good-text);
}

.segments {
  display: flex;
  gap: 6px;
}

.segment {
  width: 50px;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 176, 32, 0.2);
  overflow: hidden;
}

.segment i {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--grade-good);
  box-shadow: 0 0 10px rgba(255, 176, 32, 0.6);
  transition: width var(--dur-fast) linear;
}
</style>

<script setup lang="ts">
import type { LetterGrade } from '@/game/config'

// Оценка за трек: буква в светящемся кольце, звёзды и отметка рекорда
defineProps<{ grade: LetterGrade; stars: number; newRecord: boolean }>()
</script>

<template>
  <div class="badge">
    <div class="badge__ring" :class="`badge__ring--${grade}`" :aria-label="`Оценка ${grade}`">
      {{ grade }}
    </div>
    <div class="badge__side">
      <div class="badge__stars" role="img" :aria-label="`${stars} из 5 звёзд`">
        <svg
          v-for="i in 5"
          :key="i"
          width="30"
          height="30"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke-linejoin="round"
          :class="{ 'star--on': i <= stars }"
          aria-hidden="true"
        >
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
        </svg>
      </div>
      <span v-if="newRecord" class="badge__record">Новый рекорд</span>
    </div>
  </div>
</template>

<style scoped>
.badge {
  display: flex;
  align-items: center;
  gap: 28px;
}

.badge__ring {
  --g-color: var(--grade-good);
  width: 168px;
  height: 168px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 6px solid var(--g-color);
  box-shadow:
    0 0 50px color-mix(in srgb, var(--g-color) 50%, transparent),
    inset 0 0 30px color-mix(in srgb, var(--g-color) 25%, transparent);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 96px;
  line-height: 1;
  color: color-mix(in srgb, var(--g-color) 60%, white);
}

.badge__ring--S {
  --g-color: var(--grade-perfect);
}

.badge__ring--A {
  --g-color: var(--grade-good);
}

.badge__ring--B {
  --g-color: var(--string-4);
}

.badge__ring--C {
  --g-color: var(--string-3);
}

.badge__ring--D {
  --g-color: var(--grade-miss);
}

.badge__side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.badge__stars {
  display: flex;
  gap: 8px;
}

.badge__stars svg {
  fill: none;
  stroke: #5c5873;
}

.badge__stars .star--on {
  fill: var(--grade-good);
  stroke: var(--grade-good);
}

.badge__record {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: var(--radius-chip);
  border: 1px solid rgba(52, 227, 154, 0.5);
  background: rgba(52, 227, 154, 0.14);
  font-size: 13px;
  font-weight: 700;
  color: var(--grade-perfect-text);
}
</style>

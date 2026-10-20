<script setup lang="ts" generic="T extends string | number">
import type { SelectOption } from './types'

// Переключатель из нескольких вариантов: «Ноты / Ступени / Интервалы»
defineProps<{
  options: readonly SelectOption<T>[]
  label?: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="segmented__item"
      :class="{ 'segmented__item--active': option.value === model }"
      :aria-checked="option.value === model"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  height: 44px;
  padding: 3px;
  gap: 3px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
}

.segmented__item {
  padding: 0 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-soft);
  transition:
    background-color var(--dur-fast) ease,
    color var(--dur-fast) ease;
}

.segmented__item:hover:not(.segmented__item--active) {
  background: var(--color-overlay-hover);
}

.segmented__item--active {
  background: var(--color-text);
  color: var(--color-text-inverse);
}
</style>

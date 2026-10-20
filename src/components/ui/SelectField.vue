<script setup lang="ts" generic="T extends string | number">
// Подписанный выпадающий список в стиле макетов
import type { SelectOption } from './types'

defineProps<{
  label: string
  options: readonly SelectOption<T>[]
  accent?: boolean
  disabled?: boolean
}>()

const model = defineModel<T>({ required: true })
const id = `select-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <div class="field">
    <label :for="id" class="caps-label">{{ label }}</label>
    <select
      :id="id"
      v-model="model"
      class="field__select"
      :class="{ 'field__select--accent': accent }"
      :disabled="disabled"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field__select {
  height: var(--control-height);
  padding: 0 40px 0 14px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-3)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1.5l5 5 5-5' stroke='%23EDEBF5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 16px center;
  appearance: none;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  text-overflow: ellipsis;
}

.field__select--accent {
  border-color: rgba(167, 139, 250, 0.5);
}

.field__select:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.28);
}

.field__select:disabled {
  opacity: 0.5;
  cursor: default;
}

.field__select option {
  background: var(--color-surface-3);
}
</style>

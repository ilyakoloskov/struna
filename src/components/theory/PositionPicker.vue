<script setup lang="ts">
import type { PositionSystem, ScalePosition } from '@/domain/theory/positions'

// Выбор позиции гаммы: система (боксы / CAGED) и номер позиции или весь гриф
defineProps<{
  positions: readonly ScalePosition[]
  /** CAGED доступен только для стандартных интервалов между струнами */
  cagedAvailable: boolean
}>()

const position = defineModel<number>('position', { required: true })
const system = defineModel<PositionSystem>('system', { required: true })

function setSystem(next: PositionSystem) {
  if (next === system.value) return
  system.value = next
  position.value = 0
}
</script>

<template>
  <div class="picker">
    <span class="caps-label">Позиции</span>
    <div class="picker__row">
      <div class="systems" role="radiogroup" aria-label="Система позиций">
        <button
          type="button"
          role="radio"
          :aria-checked="system === 'boxes'"
          :class="{ 'is-on': system === 'boxes' }"
          @click="setSystem('boxes')"
        >
          Боксы
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="system === 'caged'"
          :class="{ 'is-on': system === 'caged' }"
          :disabled="!cagedAvailable"
          :title="
            cagedAvailable
              ? ''
              : 'CAGED — для строев со стандартными интервалами (E, E♭, 7-струнный B)'
          "
          @click="setSystem('caged')"
        >
          CAGED
        </button>
      </div>
      <div class="positions" role="radiogroup" aria-label="Позиция">
        <button
          type="button"
          role="radio"
          :aria-checked="position === 0"
          :class="{ 'is-on': position === 0 }"
          @click="position = 0"
        >
          Весь гриф
        </button>
        <button
          v-for="p in positions"
          :key="p.number"
          type="button"
          role="radio"
          :aria-checked="position === p.number"
          :class="{ 'is-on': position === p.number }"
          :title="`${p.label} · лады ${p.minFret}–${p.maxFret}`"
          @click="position = p.number"
        >
          {{ system === 'caged' ? p.label.replace('Форма ', '') : p.number }}
        </button>
      </div>
    </div>
    <p v-if="system === 'caged' && !cagedAvailable" class="picker__hint">
      CAGED работает для строев со стандартными интервалами между струнами (E, E♭, 7-струнный B).
    </p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picker .caps-label {
  font-size: 11px;
}

.picker__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.systems,
.positions {
  display: flex;
  height: 44px;
  padding: 3px;
  gap: 3px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
}

button {
  min-width: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-soft);
}

button:hover:not(.is-on):not(:disabled) {
  background: var(--color-overlay-hover);
}

button.is-on {
  background: var(--color-text);
  color: var(--color-text-inverse);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.picker__hint {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>

<script setup lang="ts">
import type { TuningString } from '@/domain/music/tunings'

// Кнопки струн: подсветка звучащей струны, клик закрепляет струну как цель
defineProps<{
  strings: readonly TuningString[]
  activeIndex: number | null
  lockedIndex: number | null
}>()

const emit = defineEmits<{ toggle: [index: number] }>()
</script>

<template>
  <div class="strings" role="group" aria-label="Струны">
    <button
      v-for="(string, index) in strings"
      :key="string.number"
      type="button"
      class="string"
      :class="{
        'string--active': index === activeIndex,
        'string--locked': index === lockedIndex,
      }"
      :style="{ '--string-color': `var(--string-${string.number})` }"
      :aria-pressed="index === lockedIndex"
      :title="
        index === lockedIndex ? 'Вернуть автоопределение струны' : 'Закрепить струну как цель'
      "
      @click="emit('toggle', index)"
    >
      <span class="string__note">
        {{ string.name }}<span class="string__octave">{{ string.octave }}</span>
      </span>
      <span class="string__number">{{ string.number }} стр.</span>
      <svg
        v-if="index === lockedIndex"
        class="string__lock"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.strings {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.string {
  position: relative;
  width: 88px;
  height: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border-mid);
  background: var(--color-surface-2);
  transition:
    border-color var(--dur-fast) ease,
    background-color var(--dur-fast) ease,
    box-shadow var(--dur-fast) ease;
}

.string:hover {
  border-color: color-mix(in srgb, var(--string-color) 50%, transparent);
}

.string--active,
.string--locked {
  border: 2px solid var(--string-color);
  background: color-mix(in srgb, var(--string-color) 16%, transparent);
}

.string--active {
  box-shadow: 0 0 26px color-mix(in srgb, var(--string-color) 50%, transparent);
}

.string__note {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 20px;
  line-height: 1.2;
  color: var(--string-color);
}

.string__octave {
  font-size: 20px;
}

.string__number {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-dim);
}

.string__lock {
  position: absolute;
  top: 7px;
  right: 7px;
  color: var(--string-color);
}
</style>

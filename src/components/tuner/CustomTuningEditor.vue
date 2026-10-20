<script setup lang="ts">
import { computed } from 'vue'
import { formatNote } from '@/domain/music/pitch'
import { CUSTOM_NOTE_RANGE, STRING_COUNTS, type StringCount } from '@/domain/music/tunings'

// Свой строй: число струн и нота каждой струны (от низкой к высокой)
const midis = defineModel<number[]>({ required: true })

const NOTE_OPTIONS = Array.from(
  { length: CUSTOM_NOTE_RANGE.max - CUSTOM_NOTE_RANGE.min + 1 },
  (_, i) => CUSTOM_NOTE_RANGE.min + i,
)

const count = computed(() => midis.value.length as StringCount)

function setCount(next: StringCount) {
  if (next === count.value) return
  midis.value =
    next === 7
      ? // Добавляем низкую струну на кварту ниже текущей нижней
        [Math.max(CUSTOM_NOTE_RANGE.min, midis.value[0]! - 5), ...midis.value]
      : midis.value.slice(1)
}

function setString(index: number, midi: number) {
  const next = [...midis.value]
  next[index] = midi
  midis.value = next
}
</script>

<template>
  <div class="custom">
    <div class="custom__head">
      <span class="caps-label">Свой строй</span>
      <div class="segmented" role="radiogroup" aria-label="Число струн">
        <button
          v-for="option in STRING_COUNTS"
          :key="option"
          type="button"
          role="radio"
          class="segmented__item"
          :class="{ 'segmented__item--active': option === count }"
          :aria-checked="option === count"
          @click="setCount(option)"
        >
          {{ option }} стр.
        </button>
      </div>
    </div>

    <div class="custom__strings">
      <label
        v-for="(midi, index) in midis"
        :key="index"
        class="custom__string"
        :style="{ '--string-color': `var(--string-${midis.length - index})` }"
      >
        <span class="custom__number">{{ midis.length - index }}</span>
        <select
          class="custom__select"
          :value="midi"
          :aria-label="`Струна ${midis.length - index}`"
          @change="setString(index, Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="note in NOTE_OPTIONS" :key="note" :value="note">
            {{ formatNote(note) }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.custom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.custom__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.segmented {
  display: flex;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--color-border-mid);
}

.segmented__item {
  padding: 5px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-soft);
}

.segmented__item--active {
  background: var(--color-text);
  color: var(--color-text-inverse);
}

.custom__strings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 8px;
}

.custom__string {
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom__number {
  width: 14px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 13px;
  color: var(--string-color);
}

.custom__select {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 6px;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--string-color) 40%, transparent);
  background: var(--color-surface-3);
  font-weight: 700;
  font-size: 14px;
}
</style>

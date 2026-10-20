<script setup lang="ts">
import { computed } from 'vue'

// Крупная нота с октавой; цвет — цвет струны, если звучит открытая струна
const props = defineProps<{
  name: string | null
  octave: number | null
  stringNumber: number | null
  held: boolean
}>()

const color = computed(() =>
  props.stringNumber ? `var(--string-${props.stringNumber})` : 'var(--color-text-strong)',
)
</script>

<template>
  <div
    class="note"
    :class="{ 'note--held': held, 'note--empty': !name }"
    :style="{ '--note-color': color }"
  >
    <template v-if="name">
      <span class="note__name">{{ name }}</span>
      <span class="note__octave">{{ octave }}</span>
    </template>
    <span v-else class="note__name">—</span>
  </div>
</template>

<style scoped>
.note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: 200px;
  transition: opacity var(--dur-page) ease;
}

.note--held {
  opacity: 0.55;
}

.note__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(120px, 14vw, 200px);
  line-height: 1;
  color: var(--note-color);
  text-shadow:
    0 0 40px color-mix(in srgb, var(--note-color) 60%, transparent),
    0 0 120px color-mix(in srgb, var(--note-color) 30%, transparent);
}

.note--empty .note__name {
  color: var(--color-text-dim);
  text-shadow: none;
  opacity: 0.4;
}

.note__octave {
  margin-top: 18px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 48px;
  color: color-mix(in srgb, var(--note-color) 65%, white);
}
</style>

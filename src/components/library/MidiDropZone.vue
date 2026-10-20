<script setup lang="ts">
import { ref } from 'vue'

// Загрузка MIDI: кнопка выбора файла и перетаскивание
defineProps<{ compact?: boolean; error?: string | null }>()
const emit = defineEmits<{ files: [files: File[]]; demo: [] }>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function onDrop(event: DragEvent) {
  dragging.value = false
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) emit('files', files)
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = [...(target.files ?? [])]
  if (files.length) emit('files', files)
  target.value = ''
}
</script>

<template>
  <div
    class="drop"
    :class="{ 'drop--dragging': dragging, 'drop--compact': compact }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <input
      ref="input"
      type="file"
      accept=".mid,.midi,.gp,.gp3,.gp4,.gp5,.gpx,.gp7,audio/midi,audio/x-midi"
      multiple
      class="drop__input"
      @change="onChange"
    />
    <template v-if="!compact">
      <div class="drop__icon" aria-hidden="true">
        <span v-for="n in 7" :key="n" :style="{ background: `var(--string-${8 - n})` }" />
      </div>
      <p class="drop__title">Перетащи MIDI или Guitar Pro сюда</p>
      <p class="drop__hint">
        Гитарная партия определится сама. Из Guitar Pro возьмутся струны и лады из файла, из MIDI —
        разложатся под твой строй
      </p>
    </template>
    <div class="drop__actions">
      <button type="button" class="drop__button" @click="input?.click()">Выбрать файл</button>
      <button type="button" class="drop__ghost" @click="emit('demo')">Демо-трек</button>
    </div>
    <p v-if="error" class="drop__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 56px 24px;
  border-radius: var(--radius-card);
  border: 1.5px dashed var(--color-border-strong);
  background: var(--color-surface);
  text-align: center;
  transition:
    border-color var(--dur-fast) ease,
    background-color var(--dur-fast) ease;
}

.drop--dragging {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
}

.drop--compact {
  flex-direction: row;
  padding: 0;
  border: 0;
  background: transparent;
}

.drop__input {
  display: none;
}

.drop__icon {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 120px;
  margin-bottom: 8px;
}

.drop__icon span {
  height: 2px;
  border-radius: 2px;
}

.drop__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  color: var(--color-text-strong);
}

.drop__hint {
  max-width: 440px;
  color: var(--color-text-muted);
}

.drop__actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.drop--compact .drop__actions {
  margin: 0;
}

.drop__button,
.drop__ghost {
  height: 44px;
  padding: 0 20px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 700;
}

.drop__button {
  border: 0;
  background: var(--color-text);
  color: var(--color-text-inverse);
}

.drop__ghost {
  border: 1px solid var(--color-border-strong);
  background: transparent;
  color: var(--color-text);
}

.drop__ghost:hover {
  background: var(--color-overlay-hover);
}

.drop__error {
  color: var(--grade-miss);
  font-weight: 600;
}
</style>

<script setup lang="ts">
// Экран поверх игры: старт, пауза, конец трека, ошибка
defineProps<{
  title: string
  text?: string
  progress?: number | null
}>()
</script>

<template>
  <div class="overlay" role="dialog" aria-modal="true" :aria-label="title">
    <div class="overlay__panel">
      <h2 class="overlay__title">{{ title }}</h2>
      <p v-if="text" class="overlay__text">{{ text }}</p>
      <div
        v-if="progress != null"
        class="overlay__progress"
        role="progressbar"
        :aria-valuenow="progress"
      >
        <div :style="{ width: `${progress}%` }" />
      </div>
      <div class="overlay__actions">
        <slot />
      </div>
      <div v-if="$slots.options" class="overlay__options">
        <slot name="options" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(7, 7, 11, 0.72);
  backdrop-filter: blur(6px);
  z-index: 10;
}

.overlay__panel {
  width: min(440px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 36px 32px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border-mid);
  background: var(--color-surface);
  box-shadow: 0 0 80px rgba(120, 100, 255, 0.15);
  text-align: center;
}

.overlay__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 28px;
  color: var(--color-text-strong);
}

.overlay__text {
  color: var(--color-text-soft);
}

.overlay__progress {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.overlay__progress div {
  height: 100%;
  background: var(--color-accent);
  transition: width var(--dur-fast) linear;
}

.overlay__actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.overlay__actions :deep(.btn) {
  height: 50px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  display: grid;
  place-items: center;
}

.overlay__actions :deep(.btn--primary) {
  border: 0;
  background: var(--color-text);
  color: var(--color-text-inverse);
}

.overlay__actions :deep(.btn:disabled) {
  opacity: 0.45;
}

.overlay__options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.overlay__options :deep(.chip) {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--color-border-mid);
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-soft);
}

.overlay__options :deep(.chip--on) {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent-text);
}
</style>

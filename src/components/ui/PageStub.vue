<script setup lang="ts">
// Временная заглушка экрана: показывает, что раздел появится на следующих этапах
defineProps<{
  eyebrow: string
  title: string
  description: string
  stage: number
}>()
</script>

<template>
  <section class="stub">
    <div class="stub__eyebrow caps-label">{{ eyebrow }}</div>
    <h1 class="stub__title">{{ title }}</h1>
    <p class="stub__description">{{ description }}</p>
    <div class="stub__stage">Этап {{ stage }}</div>
    <slot />
  </section>
</template>

<style scoped>
.stub {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  max-width: 720px;
}

.stub__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(36px, 5vw, 56px);
  line-height: 1.05;
  color: var(--color-text-strong);
}

.stub__description {
  font-size: 17px;
  color: var(--color-text-soft);
}

.stub__stage {
  margin-top: 8px;
  padding: 6px 14px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--color-border-mid);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-dim);
}
</style>

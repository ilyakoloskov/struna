<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PageContainer from '@/components/layout/PageContainer.vue'
</script>

<template>
  <PageContainer>
    <section class="not-found">
      <div class="caps-label">Ошибка 404</div>
      <h1 class="not-found__title">Такой страницы нет</h1>
      <RouterLink :to="{ name: 'home' }" class="not-found__link">На главную</RouterLink>
    </section>
  </PageContainer>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.not-found__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(36px, 5vw, 56px);
  color: var(--color-text-strong);
}

.not-found__link {
  margin-top: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
  font-size: 14px;
  font-weight: 700;
}
</style>

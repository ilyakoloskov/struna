<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import PageContainer from '@/components/layout/PageContainer.vue'
import { useTheoryQuery } from '@/composables/useTheoryQuery'

const TABS = [
  { label: 'Квинтовый круг', name: 'theory-circle' },
  { label: 'Гриф и лады', name: 'theory-fretboard' },
] as const

// Тональность, лад и строй живут в URL — ссылкой можно поделиться
useTheoryQuery()
</script>

<template>
  <PageContainer>
    <nav class="tabs" aria-label="Разделы теории">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="{ name: tab.name, query: $route.query }"
        class="tab"
        active-class="tab--active"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>

    <div class="content">
      <RouterView />
    </div>
  </PageContainer>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tab {
  padding: 9px 16px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--color-border-mid);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-soft);
  transition:
    border-color var(--dur-fast) ease,
    background-color var(--dur-fast) ease;
}

.tab:hover {
  border-color: var(--color-border-strong);
  background: var(--color-overlay-hover);
}

.tab--active,
.tab--active:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent-text);
}

.content {
  margin-top: 28px;
}
</style>

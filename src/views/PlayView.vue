<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppLogo from '@/components/layout/AppLogo.vue'
import PageStub from '@/components/ui/PageStub.vue'

// Полноэкранный экран игры: общая навигация скрыта (meta.fullscreen)
defineProps<{ trackId: string }>()
</script>

<template>
  <div class="play">
    <header class="play__top">
      <AppLogo />
      <RouterLink :to="{ name: 'library' }" class="play__exit" aria-label="Выйти из игры">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </svg>
      </RouterLink>
    </header>

    <div class="play__body">
      <PageStub
        :eyebrow="`Трек ${trackId}`"
        title="Игровая дорожка"
        description="Перспективная дорожка на Three.js, ноты-«камни» по струнам, HUD со счётом и комбо."
        :stage="5"
      />
    </div>
  </div>
</template>

<style scoped>
.play {
  flex: 1;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at 50% 100%, rgba(167, 139, 250, 0.08), transparent 60%),
    var(--color-bg);
}

.play__top {
  height: var(--header-height);
  padding: 0 var(--page-gutter);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.play__exit {
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-2);
  color: var(--color-text);
}

.play__exit:hover {
  background: var(--color-surface-3);
}

.play__body {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px var(--page-gutter) 48px;
}
</style>

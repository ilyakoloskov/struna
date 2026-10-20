<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import AppLogo from './AppLogo.vue'
import { NAV_ITEMS, isSectionActive } from './navigation'
import { useInstallPrompt } from '@/composables/useInstallPrompt'

const route = useRoute()
const { canInstall, installed, install } = useInstallPrompt()
</script>

<template>
  <header class="header">
    <AppLogo />

    <div class="header__right">
      <button v-if="canInstall && !installed" type="button" class="install" @click="install">
        Установить
      </button>
      <nav class="nav" aria-label="Основная навигация">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.label"
          :to="item.to"
          class="nav__link"
          :class="{ 'nav__link--active': isSectionActive(route.path, item.sections) }"
          :aria-current="isSectionActive(route.path, item.sections) ? 'page' : undefined"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <RouterLink
        :to="{ name: 'settings' }"
        class="settings"
        :class="{ 'settings--active': route.name === 'settings' }"
        aria-label="Настройки"
        title="Настройки"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h10M18 7h2M4 17h4M12 17h8"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <circle cx="16" cy="7" r="2.25" stroke="currentColor" stroke-width="2" />
          <circle cx="10" cy="17" r="2.25" stroke="currentColor" stroke-width="2" />
        </svg>
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.header {
  height: var(--header-height);
  padding: 0 var(--page-gutter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-shrink: 0;
}

.header__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.install {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--color-accent);
  background: var(--color-accent-bg);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-accent-text);
}

.nav {
  display: flex;
  gap: 6px;
}

.nav__link {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  transition:
    color var(--dur-fast) ease,
    background-color var(--dur-fast) ease;
}

.nav__link:hover {
  color: var(--color-text);
  background: var(--color-overlay-hover);
}

.nav__link--active,
.nav__link--active:hover {
  color: var(--color-text-strong);
  background: var(--color-overlay-active);
}

.settings {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--color-text-muted);
  transition:
    color var(--dur-fast) ease,
    background-color var(--dur-fast) ease;
}

.settings:hover {
  color: var(--color-text);
  background: var(--color-overlay-hover);
}

.settings--active,
.settings--active:hover {
  color: var(--color-text-strong);
  background: var(--color-overlay-active);
}

@media (max-width: 560px) {
  .nav__link {
    padding: 8px 10px;
  }
}
</style>

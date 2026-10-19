<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <RouterLink :to="{ name: 'home' }" class="logo" aria-label="STRUNA — на главную">
    <span class="logo__dot" aria-hidden="true" />
    <span class="logo__text">STRUNA</span>
  </RouterLink>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
}

.logo__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-brand);
  box-shadow: var(--glow-brand);
}

.logo__text {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.22em;
  color: var(--color-text-strong);
}
</style>

<script setup lang="ts">
import { isMobileDevice } from '@/composables/useDeviceKind'

// Честное предупреждение на телефоне/планшете: микрофон даёт большую задержку
const mobile = isMobileDevice()
</script>

<template>
  <p v-if="mobile" class="notice" role="note">
    На телефоне звук идёт через микрофон: задержка больше, а распознавание менее точное. Лучше всего
    STRUNA работает на компьютере с гитарой через звуковую карту.
  </p>
</template>

<style scoped>
.notice {
  padding: 10px 14px;
  border-radius: var(--radius-btn);
  border: 1px solid rgba(255, 176, 32, 0.4);
  background: rgba(255, 176, 32, 0.08);
  font-size: 13px;
  color: var(--grade-good-text);
  text-align: left;
}
</style>

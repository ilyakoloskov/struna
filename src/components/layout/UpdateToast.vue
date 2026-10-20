<script setup lang="ts">
import { watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

// Service worker: «готово к офлайну» и «доступна новая версия».
// Обновление — только по кнопке, чтобы не перезагрузить страницу посреди игры.
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({ immediate: true })

watch(offlineReady, (ready) => {
  if (ready) setTimeout(() => (offlineReady.value = false), 5000)
})
</script>

<template>
  <Transition name="toast">
    <div v-if="needRefresh || offlineReady" class="toast" role="status">
      <template v-if="needRefresh">
        <span>Доступна новая версия STRUNA</span>
        <button type="button" class="toast__primary" @click="updateServiceWorker()">
          Обновить
        </button>
        <button type="button" class="toast__ghost" @click="needRefresh = false">Позже</button>
      </template>
      <template v-else>
        <span>Приложение сохранено и будет работать без сети</span>
        <button type="button" class="toast__ghost" @click="offlineReady = false">Ок</button>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 12px 18px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-3);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.toast button {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
}

.toast__primary {
  border: 0;
  background: var(--color-text);
  color: var(--color-text-inverse);
}

.toast__ghost {
  border: 1px solid var(--color-border-strong);
  background: transparent;
  color: var(--color-text-soft);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur-page) var(--ease-out),
    transform var(--dur-page) var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

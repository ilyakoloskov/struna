<script setup lang="ts">
import { computed } from 'vue'
import type { InputStatus } from '@/composables/useAudioInput'

// Кнопка «Живой гриф»: включает распознавание с аудиовхода
const props = defineProps<{ status: InputStatus }>()
const emit = defineEmits<{ toggle: [] }>()

const text = computed(() => {
  switch (props.status) {
    case 'running':
      return 'Живой гриф: слушаю вход'
    case 'starting':
      return 'Живой гриф: подключаю…'
    case 'needs-gesture':
      return 'Живой гриф: нажми, чтобы продолжить'
    case 'error':
      return 'Живой гриф: нет доступа ко входу'
    default:
      return 'Живой гриф: выключен'
  }
})
</script>

<template>
  <button
    type="button"
    class="live"
    :class="`live--${status}`"
    :aria-pressed="status === 'running'"
    @click="emit('toggle')"
  >
    <span class="live__dot" aria-hidden="true" />
    {{ text }}
  </button>
</template>

<style scoped>
.live {
  --live-color: var(--color-text-dim);
  height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-soft);
  white-space: nowrap;
}

.live:hover {
  background: var(--color-overlay-hover);
}

.live--running {
  --live-color: var(--grade-perfect);
  border-color: rgba(52, 227, 154, 0.45);
  background: rgba(52, 227, 154, 0.1);
  color: var(--grade-perfect-text);
}

.live--running:hover {
  background: rgba(52, 227, 154, 0.16);
}

.live--starting,
.live--needs-gesture {
  --live-color: var(--grade-good);
  color: var(--grade-good-text);
}

.live--error {
  --live-color: var(--grade-miss);
  color: var(--grade-miss);
}

.live__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--live-color);
}

.live--running .live__dot {
  box-shadow: 0 0 10px var(--live-color);
}
</style>

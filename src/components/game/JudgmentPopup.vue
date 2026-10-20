<script setup lang="ts">
import type { Grade } from '@/game/judge'

// Всплывающая оценка над линией удара. key в родителе перезапускает анимацию на каждую оценку
defineProps<{ grade: Grade; x: number; y: number }>()

const LABEL: Record<Grade, string> = { perfect: 'Perfect', good: 'Good', miss: 'Miss' }
</script>

<template>
  <div
    class="popup"
    :class="`popup--${grade}`"
    :style="{ left: `${x}px`, top: `${y}px` }"
    aria-hidden="true"
  >
    {{ LABEL[grade] }}
  </div>
</template>

<style scoped>
.popup {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 30px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  animation: pop 650ms var(--ease-out) forwards;
}

.popup--perfect {
  color: var(--grade-perfect-text);
  text-shadow: 0 0 18px rgba(52, 227, 154, 0.8);
}

.popup--good {
  color: var(--grade-good-text);
  text-shadow: 0 0 18px rgba(255, 176, 32, 0.7);
}

.popup--miss {
  font-size: 24px;
  color: var(--grade-miss);
  text-shadow: 0 0 14px rgba(255, 92, 122, 0.6);
}

@keyframes pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -30%) scale(0.85);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -80%) scale(1);
  }
}

/* Без движения: просто появляется и гаснет */
@media (prefers-reduced-motion: reduce) {
  .popup {
    animation: fade 650ms linear forwards;
  }

  @keyframes fade {
    0%,
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
}
</style>

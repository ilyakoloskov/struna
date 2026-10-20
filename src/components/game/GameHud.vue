<script setup lang="ts">
import { computed } from 'vue'
import AppLogo from '@/components/layout/AppLogo.vue'
import type { Tuning } from '@/domain/music/tunings'
import { formatClock } from '@/domain/time'

// HUD поверх дорожки: трек, строй, прогресс, пауза, подписи струн.
// Счёт, комбо и точность появятся на этапе 6.
const props = defineProps<{
  title: string
  subtitle: string
  tuning: Tuning
  position: number
  duration: number
  /** Экранные x струн на линии удара (от самой низкой) */
  labelX: readonly number[]
}>()

const emit = defineEmits<{ pause: [] }>()

const progress = computed(() =>
  props.duration ? Math.min(100, (Math.max(0, props.position) / props.duration) * 100) : 0,
)
</script>

<template>
  <div class="hud">
    <header class="hud__top">
      <div class="hud__track">
        <AppLogo />
        <span class="hud__divider" aria-hidden="true" />
        <div class="hud__title">
          <span class="hud__name">{{ title }}</span>
          <span class="hud__subtitle">{{ subtitle }}</span>
        </div>
        <span class="hud__tuning">{{ tuning.label }}</span>
      </div>

      <div class="hud__progress" aria-label="Прогресс трека">
        <span>{{ formatClock(Math.max(0, position)) }}</span>
        <div class="hud__bar"><div :style="{ width: `${progress}%` }" /></div>
        <span>{{ formatClock(duration) }}</span>
      </div>

      <button
        type="button"
        class="hud__pause"
        aria-label="Пауза (Esc)"
        title="Пауза (Esc)"
        @click="emit('pause')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
        </svg>
      </button>
    </header>

    <div class="hud__strings" aria-hidden="true">
      <div
        v-for="(string, i) in tuning.strings"
        :key="string.number"
        class="hud__string"
        :style="{ left: `${labelX[i] ?? 0}px`, '--string-color': `var(--string-${string.number})` }"
      >
        <span class="hud__string-name">{{ string.name }}</span>
        <span class="hud__string-number">{{ string.number }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hud__top {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: var(--header-height);
  padding: 0 var(--page-gutter);
  display: flex;
  align-items: center;
  gap: 24px;
  /* Затемнение сверху: дорожка уходит под панель */
  background: linear-gradient(var(--color-bg) 40%, transparent);
}

.hud__top > * {
  pointer-events: auto;
}

.hud__track {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: 0;
}

.hud__divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.14);
}

.hud__title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hud__name {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud__subtitle {
  font-size: 13px;
  color: var(--color-text-muted);
}

.hud__tuning {
  padding: 6px 12px;
  border-radius: var(--radius-chip);
  border: 1px solid rgba(167, 139, 250, 0.5);
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent-text);
  white-space: nowrap;
}

.hud__progress {
  flex: 1;
  max-width: 620px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}

.hud__bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.hud__bar div {
  height: 100%;
  border-radius: 3px;
  background: var(--color-text-strong);
}

.hud__pause {
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-2);
  color: var(--color-text);
}

.hud__strings {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 28px;
  height: 48px;
}

.hud__string {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hud__string-name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 20px;
  color: var(--string-color);
  text-shadow: 0 0 12px color-mix(in srgb, var(--string-color) 60%, transparent);
}

.hud__string-number {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-dim);
}

@media (max-width: 900px) {
  .hud__tuning,
  .hud__divider {
    display: none;
  }
}
</style>

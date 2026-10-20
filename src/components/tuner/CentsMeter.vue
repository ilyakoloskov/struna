<script setup lang="ts">
import { computed } from 'vue'
import type { TuneStatus } from '@/domain/tuner/reading'

// Шкала ±50 центов с зелёной зоной и стрелкой
const props = defineProps<{
  cents: number | null
  status: TuneStatus | null
  dimmed?: boolean
}>()

const RANGE = 50
const TICK_STEP = 5
const TICKS = Array.from({ length: (RANGE * 2) / TICK_STEP + 1 }, (_, i) => -RANGE + i * TICK_STEP)
const LABELS = [-50, -25, 0, 25, 50]
/** Зелёная зона «в строе» на шкале, ±центы */
const ZONE_CENTS = 5

const position = (cents: number) => `${((cents + RANGE) / (RANGE * 2)) * 100}%`

const needleLeft = computed(() =>
  props.cents === null ? '50%' : position(Math.max(-RANGE, Math.min(RANGE, props.cents))),
)
const outOfRange = computed(() => props.cents !== null && Math.abs(props.cents) > RANGE)

function formatLabel(value: number) {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0'
}
</script>

<template>
  <div class="meter" :class="{ 'meter--dimmed': dimmed }">
    <div class="meter__scale">
      <div
        class="meter__zone"
        :style="{ left: position(-ZONE_CENTS), right: position(-ZONE_CENTS) }"
      />
      <div
        v-for="tick in TICKS"
        :key="tick"
        class="meter__tick"
        :class="{ 'meter__tick--major': tick % 25 === 0, 'meter__tick--zero': tick === 0 }"
        :style="{ left: position(tick) }"
      />
      <div
        v-if="cents !== null"
        class="meter__needle"
        :class="[`meter__needle--${status}`, { 'meter__needle--out': outOfRange }]"
        :style="{ left: needleLeft }"
      />
    </div>
    <div class="meter__labels">
      <span
        v-for="label in LABELS"
        :key="label"
        :class="{ 'meter__label--zero': label === 0 }"
        :style="{ left: position(label) }"
      >
        {{ formatLabel(label) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.meter {
  width: 100%;
  max-width: 780px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: opacity var(--dur-page) ease;
}

.meter--dimmed {
  opacity: 0.45;
}

.meter__scale {
  position: relative;
  height: 90px;
}

.meter__zone {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 10px;
  background: rgba(52, 227, 154, 0.1);
  border: 1px solid rgba(52, 227, 154, 0.35);
}

.meter__tick {
  position: absolute;
  top: 30px;
  width: 2px;
  height: 30px;
  margin-left: -1px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.16);
}

.meter__tick--major {
  top: 17px;
  height: 56px;
  background: rgba(255, 255, 255, 0.35);
}

.meter__tick--zero {
  top: 0;
  width: 4px;
  height: 90px;
  margin-left: -2px;
  background: var(--grade-perfect-text);
}

.meter__needle {
  --needle-glow: var(--grade-perfect);
  position: absolute;
  top: -10px;
  width: 6px;
  height: 110px;
  margin-left: -3px;
  border-radius: 3px;
  background: #f4fff9;
  box-shadow:
    0 0 16px var(--needle-glow),
    0 0 40px color-mix(in srgb, var(--needle-glow) 70%, transparent);
  transition:
    left 90ms linear,
    box-shadow var(--dur-fast) ease;
}

.meter__needle--flat,
.meter__needle--sharp {
  --needle-glow: var(--grade-good);
}

.meter__needle--out {
  --needle-glow: var(--grade-miss);
}

.meter__labels {
  position: relative;
  height: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-dim);
}

.meter__labels span {
  position: absolute;
  transform: translateX(-50%);
}

.meter__labels span:first-child {
  transform: none;
}

.meter__labels span:last-child {
  transform: translateX(-100%);
}

.meter__label--zero {
  color: var(--grade-perfect-text);
}

@media (prefers-reduced-motion: reduce) {
  .meter__needle {
    transition: none;
  }
}
</style>

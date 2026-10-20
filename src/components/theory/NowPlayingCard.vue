<script setup lang="ts">
import { computed } from 'vue'
import { formatDegree } from '@/domain/theory/intervals'
import { formatNote, octaveOf } from '@/domain/theory/notes'
import type { PitchInScale } from '@/domain/theory/scales'
import { pluralRu } from '@/domain/ru'

// «Сейчас звучит»: распознанная нота, её ступень и входит ли она в гамму
const props = defineProps<{
  pitch: (PitchInScale & { midi: number }) | null
  positions: number
  held: boolean
}>()

const name = computed(() => (props.pitch ? formatNote(props.pitch.note) : '—'))
const detail = computed(() => {
  if (!props.pitch) return 'Сыграй ноту на гитаре'
  const { note, midi, degree } = props.pitch
  return `${formatNote(note)}${octaveOf(note, midi)} · ${formatDegree(degree)}`
})
const status = computed(() => {
  if (!props.pitch) return null
  const where = `${props.positions} ${pluralRu(props.positions, 'позиция', 'позиции', 'позиций')} на грифе`
  return props.pitch.role
    ? { inScale: true, text: `Входит в гамму · ${where}` }
    : { inScale: false, text: `Не входит в гамму · ${where}` }
})
</script>

<template>
  <section class="now" :class="{ 'now--held': held }" aria-live="polite">
    <div class="now__dot" :class="pitch?.role ? `now__dot--${pitch.role}` : 'now__dot--outside'">
      {{ name }}
    </div>
    <div class="now__text">
      <div class="caps-label">Сейчас звучит</div>
      <div class="now__detail">{{ detail }}</div>
      <div v-if="status" class="now__status" :class="{ 'now__status--out': !status.inScale }">
        {{ status.text }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.now {
  width: 440px;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 24px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--color-surface);
  transition: opacity var(--dur-page) ease;
}

.now--held {
  opacity: 0.6;
}

.now__dot {
  --dot-color: var(--role-other-bg);
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 0 26px rgba(255, 255, 255, 0.55);
  background: var(--dot-color);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  color: var(--color-text-inverse);
}

.now__dot--tonic {
  --dot-color: var(--role-tonic);
}

.now__dot--third {
  --dot-color: var(--role-third);
}

.now__dot--fifth {
  --dot-color: var(--role-fifth);
}

.now__dot--other {
  color: var(--color-text-strong);
}

.now__dot--outside {
  --dot-color: transparent;
  border-style: dashed;
  box-shadow: none;
  color: var(--color-text-strong);
}

.now__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.now__detail {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  color: var(--color-text-strong);
}

.now__status {
  font-size: 14px;
  font-weight: 600;
  color: var(--grade-perfect-text);
}

.now__status--out {
  color: var(--grade-good-text);
}
</style>

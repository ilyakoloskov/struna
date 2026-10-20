<script setup lang="ts">
import { computed } from 'vue'
import type { Triad } from '@/domain/theory/chords'
import { formatDegree } from '@/domain/theory/intervals'
import { relativeKey, signatureCount } from '@/domain/theory/keys'
import { formatSignatureCount } from '@/domain/theory/names'
import { formatNote, type SpelledNote } from '@/domain/theory/notes'
import type { Scale } from '@/domain/theory/scales'

// Сводка гаммы под грифом: название, параллельная тональность, ступени и аккорды
const props = defineProps<{ scale: Scale; triads: readonly Triad[] }>()

const emit = defineEmits<{
  playNote: [note: SpelledNote]
  playChord: [chord: Triad]
}>()

const title = computed(() => `${formatNote(props.scale.tonic)} ${props.scale.type.title}`)

// Параллельная тональность имеет смысл для мажора и натурального минора
const relative = computed(() => {
  const { id, quality } = props.scale.type
  if (id !== 'ionian' && id !== 'aeolian') return null
  const key = relativeKey({ tonic: props.scale.tonic, quality })
  const name = `${formatNote(key.tonic)}${key.quality === 'minor' ? 'm' : ''}`
  const label = key.quality === 'major' ? 'параллельный мажор' : 'параллельный минор'
  return `${label} — ${name} · ${formatSignatureCount(signatureCount(key))}`
})
</script>

<template>
  <section class="summary">
    <header class="summary__head">
      <h2 class="summary__title">{{ title }}</h2>
      <span v-if="relative" class="summary__relative">{{ relative }}</span>
    </header>

    <div class="degrees">
      <button
        v-for="item in scale.notes"
        :key="formatDegree(item.degree)"
        type="button"
        class="degree"
        :class="`degree--${item.role}`"
        :title="`Сыграть ${formatNote(item.note)}`"
        @click="emit('playNote', item.note)"
      >
        <span class="degree__note">{{ formatNote(item.note) }}</span>
        <span class="degree__number">{{ formatDegree(item.degree) }}</span>
      </button>
    </div>

    <div v-if="triads.length" class="chords">
      <span class="caps-label">Аккорды</span>
      <button
        v-for="chord in triads"
        :key="chord.roman"
        type="button"
        class="chord"
        :title="`${chord.roman} — сыграть ${chord.symbol}`"
        @click="emit('playChord', chord)"
      >
        {{ chord.symbol }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.summary__head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.summary__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  color: var(--color-text-strong);
}

.summary__relative {
  font-size: 14px;
  color: var(--color-text-dim);
}

.degrees {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.degree {
  --chip-color: var(--color-surface-2);
  width: 64px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border-mid);
  background: var(--chip-color);
  color: var(--color-text-strong);
  transition: transform var(--dur-fast) var(--ease-out);
}

.degree:hover {
  transform: translateY(-2px);
}

.degree--tonic,
.degree--third,
.degree--fifth {
  border-color: transparent;
  color: var(--color-text-inverse);
}

.degree--tonic {
  --chip-color: var(--role-tonic);
}

.degree--third {
  --chip-color: var(--role-third);
}

.degree--fifth {
  --chip-color: var(--role-fifth);
}

.degree__note {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
}

.degree__number {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.75;
}

.chords {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chords .caps-label {
  margin-right: 8px;
}

.chord {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--color-border-mid);
  background: var(--color-surface-2);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  color: var(--color-text-strong);
}

.chord:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-3);
}

@media (prefers-reduced-motion: reduce) {
  .degree:hover {
    transform: none;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import type { SelectOption } from '@/components/ui/types'
import type { Triad } from '@/domain/theory/chords'
import {
  neighborKeys,
  parallelKey,
  relativeKey,
  signatureNotes,
  type Key,
  type KeyQuality,
} from '@/domain/theory/keys'
import { capitalize, keyNameRu } from '@/domain/theory/names'
import { formatNote } from '@/domain/theory/notes'

// Панель выбранной тональности: знаки, параллельная, аккорды с функциями, соседи
const props = defineProps<{ selected: Key; triads: readonly Triad[] }>()
const emit = defineEmits<{
  select: [key: Key]
  playChord: [chord: Triad]
  showFretboard: []
}>()

const QUALITY_OPTIONS: SelectOption<KeyQuality>[] = [
  { value: 'major', label: 'Мажор' },
  { value: 'minor', label: 'Минор' },
]

const quality = computed({
  get: () => props.selected.quality,
  // Переключатель — одноимённая тональность: E мажор ↔ E минор
  set: (value: KeyQuality) => {
    if (value !== props.selected.quality) emit('select', parallelKey(props.selected))
  },
})

const keyName = (key: Key) => `${formatNote(key.tonic)}${key.quality === 'minor' ? 'm' : ''}`

const title = computed(() => capitalize(keyNameRu(props.selected.tonic, props.selected.quality)))
const signature = computed(() => {
  const notes = signatureNotes(props.selected)
  return notes.length ? notes.map(formatNote).join(' ') : 'без знаков'
})
const relative = computed(() => relativeKey(props.selected))
const relativeLabel = computed(() =>
  relative.value.quality === 'minor' ? 'Параллельный минор' : 'Параллельный мажор',
)

const neighbors = computed(() => {
  const { subdominant, dominant } = neighborKeys(props.selected)
  const isMajor = props.selected.quality === 'major'
  const q = isMajor ? 'мажор' : 'минор'
  return {
    subdominant,
    dominant,
    text: `${formatNote(subdominant.tonic)} ${q} (${isMajor ? 'IV' : 'iv'}) и ${formatNote(dominant.tonic)} ${q} (${isMajor ? 'V' : 'v'}) — отличаются одним знаком, в них проще всего модулировать.`,
  }
})
</script>

<template>
  <section class="panel">
    <div class="caps-label">Тональность</div>
    <h1 class="panel__title">{{ title }}</h1>
    <SegmentedControl v-model="quality" :options="QUALITY_OPTIONS" label="Наклонение" />

    <div class="cards">
      <div class="card">
        <div class="caps-label">Знаки</div>
        <div class="card__value">{{ signature }}</div>
      </div>
      <button type="button" class="card card--link" @click="emit('select', relative)">
        <span class="caps-label">{{ relativeLabel }}</span>
        <span class="card__value card__value--relative">{{ keyName(relative) }}</span>
      </button>
    </div>

    <div class="section">
      <div class="caps-label">Аккорды тональности</div>
      <div class="chords">
        <button
          v-for="chord in triads"
          :key="chord.roman"
          type="button"
          class="chord"
          :title="`Сыграть ${chord.symbol}`"
          @click="emit('playChord', chord)"
        >
          <span class="chord__roman">{{ chord.roman }}</span>
          <span class="chord__symbol">{{ chord.symbol }}</span>
          <span class="chord__function" :class="`chord__function--${chord.function}`">
            {{ chord.function }}
          </span>
        </button>
      </div>
      <div class="functions">
        <span>T — тоника</span>
        <span>S — субдоминанта</span>
        <span>D — доминанта</span>
      </div>
    </div>

    <div class="section">
      <div class="caps-label">Соседние тональности</div>
      <p class="neighbors">{{ neighbors.text }}</p>
    </div>

    <button type="button" class="show" @click="emit('showFretboard')">Показать на грифе</button>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}

.panel__title {
  margin-top: -6px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(36px, 4vw, 56px);
  line-height: 1.1;
  color: var(--color-text-strong);
}

.cards {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 10px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 18px 20px;
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  text-align: left;
}

.card--link:hover {
  border-color: rgba(232, 121, 249, 0.4);
}

.card__value {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  color: var(--color-text-strong);
}

.card__value--relative {
  color: var(--role-tonic);
}

.section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 14px;
}

.chords {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.chord {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 4px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-mid);
  background: var(--color-surface-2);
}

.chord:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-3);
}

.chord__roman {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.chord__symbol {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 16px;
  color: var(--color-text-strong);
  white-space: nowrap;
}

.chord__function {
  font-size: 12px;
  font-weight: 800;
}

.chord__function--T {
  color: var(--function-t);
}

.chord__function--S {
  color: var(--function-s);
}

.chord__function--D {
  color: var(--function-d);
}

.functions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.neighbors {
  font-size: 17px;
  color: var(--color-text-soft);
}

.show {
  margin-top: 16px;
  height: 52px;
  padding: 0 28px;
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--color-text);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text-inverse);
}

.show:hover {
  background: var(--color-text-strong);
}
</style>

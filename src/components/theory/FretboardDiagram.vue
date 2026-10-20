<script setup lang="ts">
import { computed } from 'vue'
import type { Tuning } from '@/domain/music/tunings'
import { fretMarker, type FretRange } from '@/domain/theory/fretboard'
import { formatNote, octaveOf } from '@/domain/theory/notes'
import { cellKey, type ScalePosition } from '@/domain/theory/positions'
import { describePitch, pitchLabel, type LabelKind, type Scale } from '@/domain/theory/scales'

// Гриф: ноты гаммы под текущий строй, цвет по роли, живая подсветка звучащей ноты.
// Сверху — 1-я (самая высокая) струна, как в табулатуре.
const props = defineProps<{
  tuning: Tuning
  scale: Scale
  range: FretRange
  labels: LabelKind
  /** Звучащая нота (целый MIDI) — подсвечивается во всех позициях */
  liveMidi: number | null
  liveHeld?: boolean
  /** Выбранная позиция гаммы: остальные ноты приглушаются, ноты формы CAGED выделяются */
  position?: ScalePosition | null
}>()

const inPosition = computed(() =>
  props.position ? new Set(props.position.cells.map(cellKey)) : null,
)
const inShape = computed(() => new Set((props.position?.shape ?? []).map(cellKey)))

const emit = defineEmits<{ play: [midi: number] }>()

const frets = computed(() =>
  Array.from({ length: props.range.to - props.range.from + 1 }, (_, i) => props.range.from + i),
)
const hasNut = computed(() => props.range.from === 0)

const rows = computed(() =>
  [...props.tuning.strings].reverse().map((string) => ({
    string,
    cells: frets.value.map((fret) => {
      const midi = string.midi + fret
      const pitch = describePitch(props.scale, midi)
      const key = cellKey({ stringIndex: props.tuning.strings.length - string.number, fret })
      return {
        fret,
        midi,
        dim: inPosition.value !== null && !inPosition.value.has(key),
        shape: inShape.value.has(key),
        role: pitch.role,
        label: pitchLabel(pitch, props.labels),
        name: `${formatNote(pitch.note)}${octaveOf(pitch.note, midi)}`,
      }
    }),
  })),
)

function cellTitle(cell: { name: string; fret: number }, stringNumber: number) {
  return `${cell.name} · ${stringNumber}-я струна, ${cell.fret === 0 ? 'открытая' : `${cell.fret} лад`}`
}

const openNames = computed(() => props.tuning.strings.map((s) => `${s.name}${s.octave}`))
</script>

<template>
  <div class="fretboard-scroll">
    <div
      class="fretboard"
      :class="{ 'fretboard--nut': hasNut }"
      :style="{ '--fret-count': frets.length }"
      :aria-label="`Гриф, строй ${tuning.label}, открытые струны ${openNames.join(' ')}`"
      role="group"
    >
      <div class="board">
        <div
          v-for="row in rows"
          :key="row.string.number"
          class="row"
          :style="{
            '--string-color': `var(--string-${row.string.number})`,
            '--string-width': `${1 + (tuning.strings.length - row.string.number) * 0.35}px`,
          }"
        >
          <span class="row__label">{{ row.string.name }}</span>
          <div class="row__cells">
            <button
              v-for="cell in row.cells"
              :key="cell.fret"
              type="button"
              class="cell"
              :class="{ 'cell--open': cell.fret === 0 }"
              :title="cellTitle(cell, row.string.number)"
              :aria-label="cellTitle(cell, row.string.number)"
              @click="emit('play', cell.midi)"
            >
              <span
                v-if="cell.role || cell.midi === liveMidi"
                class="dot"
                :class="[
                  cell.role ? `dot--${cell.role}` : 'dot--outside',
                  {
                    'dot--live': cell.midi === liveMidi,
                    'dot--held': liveHeld,
                    'dot--text': labels === 'intervals',
                    'dot--dim': cell.dim && cell.midi !== liveMidi,
                    'dot--shape': cell.shape,
                  },
                ]"
              >
                {{ cell.label }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div class="axis" aria-hidden="true">
        <span class="row__label" />
        <div class="row__cells">
          <span v-for="fret in frets" :key="fret" class="axis__cell">
            <span class="axis__marker">
              <i v-for="i in fretMarker(fret)" :key="i" />
            </span>
            <span class="axis__number">{{ fret }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fretboard-scroll {
  overflow-x: auto;
  padding: 4px 0 8px;
}

.fretboard {
  --label-width: 36px;
  --open-width: 62px;
  --fret-width: minmax(52px, 1fr);
  --row-height: 46px;
  min-width: calc(var(--label-width) + var(--fret-count) * 52px);
}

.row__cells {
  display: grid;
  grid-template-columns: repeat(var(--fret-count), var(--fret-width));
  flex: 1;
}

.fretboard--nut .row__cells {
  grid-template-columns: var(--open-width) repeat(calc(var(--fret-count) - 1), var(--fret-width));
}

.board {
  position: relative;
}

/* Подложка грифа — только под ладами, без колонки подписей струн */
.board::before {
  content: '';
  position: absolute;
  inset: 0 0 0 var(--label-width);
  border-radius: 10px;
  background: var(--color-surface);
  box-shadow:
    0 0 0 1px var(--color-border),
    0 0 60px rgba(120, 100, 255, 0.12);
}

.row {
  position: relative;
  display: flex;
  height: var(--row-height);
}

.row__label {
  width: var(--label-width);
  flex-shrink: 0;
  display: grid;
  place-items: center start;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 15px;
  color: var(--string-color);
}

.cell {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  border-right: 2px solid rgba(255, 255, 255, 0.16);
}

/* Струна */
.cell::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: var(--string-width);
  transform: translateY(-50%);
  background: rgba(220, 216, 240, 0.32);
}

.fretboard--nut .cell--open {
  border-right: 6px solid #d8d4ea;
}

.fretboard--nut .cell--open::before {
  background: rgba(220, 216, 240, 0.18);
}

.cell:hover::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}

.dot {
  position: relative;
  z-index: 1;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 12px;
  color: var(--color-text-inverse);
  --dot-color: var(--role-other-bg);
  background: var(--dot-color);
  transition:
    transform var(--dur-fast) var(--ease-out),
    box-shadow var(--dur-fast) ease;
}

.dot--tonic,
.dot--third,
.dot--fifth {
  box-shadow: 0 0 14px color-mix(in srgb, var(--dot-color) 60%, transparent);
}

.dot--tonic {
  --dot-color: var(--role-tonic);
}

.dot--third {
  --dot-color: var(--role-third);
}

.dot--fifth {
  --dot-color: var(--role-fifth);
}

.dot--other {
  color: var(--color-text);
  border: 1px solid var(--role-other-border);
}

/* Интервалы — заглавными («Б2», «М3»): строчная «б» в мелком жирном начертании похожа на «6» */
.dot--text {
  font-size: 10.5px;
  text-transform: uppercase;
}

/* Ноты вне выбранной позиции */
.dot--dim {
  opacity: 0.16;
  box-shadow: none;
}

/* Ноты формы аккорда CAGED */
.dot--shape {
  outline: 2px solid color-mix(in srgb, var(--dot-color) 70%, white);
  outline-offset: 3px;
}

/* Звучащая нота вне гаммы */
.dot--outside {
  background: transparent;
  color: var(--color-text-strong);
  border: 2px dashed rgba(255, 255, 255, 0.7);
}

.dot--live {
  border: 3px solid #fff;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.15),
    0 0 26px rgba(255, 255, 255, 0.55);
  transform: scale(1.12);
}

.dot--live.dot--held {
  box-shadow: none;
  transform: none;
  opacity: 0.7;
}

.cell:hover .dot {
  transform: scale(1.08);
}

.axis {
  display: flex;
  margin-top: 14px;
}

.axis__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.axis__marker {
  display: flex;
  gap: 8px;
  height: 12px;
}

.axis__marker i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.axis__number {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-dim);
}

@media (prefers-reduced-motion: reduce) {
  .dot,
  .dot--live,
  .cell:hover .dot {
    transition: none;
    transform: none;
  }
}
</style>

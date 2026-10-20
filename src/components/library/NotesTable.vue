<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatNote } from '@/domain/music/pitch'
import type { Tuning } from '@/domain/music/tunings'
import { formatPrecise } from '@/domain/time'
import type { FrettedNote } from '@/domain/tracks/types'
import { lowerBound } from '@/audio/playback/timeline'

// Список нот гитарной партии: время, нота, струна, лад.
// Виртуализация: в DOM только видимые строки — в треке их могут быть тысячи.
const props = defineProps<{
  notes: readonly FrettedNote[]
  tuning: Tuning
  /** Позиция воспроизведения, с */
  position: number
  /** Прокручивать за звучащей нотой */
  follow: boolean
}>()

const ROW_HEIGHT = 40
const VIEW_HEIGHT = 440
const OVERSCAN = 6

const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

const range = computed(() => {
  const first = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const count = Math.ceil(VIEW_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2
  return { first, last: Math.min(props.notes.length, first + count) }
})

const rows = computed(() =>
  props.notes.slice(range.value.first, range.value.last).map((note, i) => {
    const index = range.value.first + i
    const string = note.stringIndex >= 0 ? props.tuning.strings[note.stringIndex] : undefined
    return {
      index,
      note,
      name: formatNote(note.midi, props.tuning.accidental),
      string,
    }
  }),
)

/** Последняя начавшаяся нота */
const activeIndex = computed(() =>
  props.position <= 0 ? -1 : lowerBound(props.notes, props.position + 0.0001) - 1,
)

watch(activeIndex, (index) => {
  const el = scroller.value
  if (!props.follow || !el || index < 0) return
  const top = index * ROW_HEIGHT
  if (top < el.scrollTop || top > el.scrollTop + VIEW_HEIGHT - ROW_HEIGHT * 3) {
    el.scrollTop = Math.max(0, top - ROW_HEIGHT * 3)
  }
})
</script>

<template>
  <div class="table" role="table" :aria-rowcount="notes.length">
    <div class="table__head" role="row">
      <span role="columnheader">#</span>
      <span role="columnheader">Время</span>
      <span role="columnheader">Нота</span>
      <span role="columnheader">Струна</span>
      <span role="columnheader">Лад</span>
    </div>
    <div
      ref="scroller"
      class="table__body"
      :style="{ height: `${VIEW_HEIGHT}px` }"
      @scroll="scrollTop = ($event.target as HTMLElement).scrollTop"
    >
      <div :style="{ height: `${notes.length * ROW_HEIGHT}px`, position: 'relative' }">
        <div
          v-for="row in rows"
          :key="row.index"
          class="row"
          :class="{ 'row--active': row.index === activeIndex, 'row--bad': !row.string }"
          role="row"
          :aria-rowindex="row.index + 1"
          :style="{ transform: `translateY(${row.index * ROW_HEIGHT}px)` }"
        >
          <span class="row__index">{{ row.index + 1 }}</span>
          <span class="row__time">{{ formatPrecise(row.note.time) }}</span>
          <span class="row__note">{{ row.name }}</span>
          <span v-if="row.string" class="row__string">
            <i :style="{ background: `var(--string-${row.string.number})` }" />
            {{ row.string.number }} · {{ row.string.name }}
          </span>
          <span v-else class="row__string row__string--bad">нельзя сыграть в этом строе</span>
          <span class="row__fret">{{ row.string ? row.note.fret : '—' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table {
  border-radius: var(--radius-tile);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
}

.table__head,
.row {
  display: grid;
  grid-template-columns: 56px 110px 80px 1fr 56px;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
}

.table__head {
  height: 40px;
  border-bottom: 1px solid var(--color-border);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: var(--caps-tracking);
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.table__body {
  overflow-y: auto;
}

.row {
  position: absolute;
  left: 0;
  right: 0;
  height: 40px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-soft);
}

.row:nth-child(even) {
  background: rgba(255, 255, 255, 0.015);
}

.row--active {
  background: var(--color-accent-bg) !important;
  color: var(--color-text-strong);
}

.row__index {
  color: var(--color-text-dim);
}

.row__note {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--color-text-strong);
}

.row__string {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.row__string i {
  width: 18px;
  height: 3px;
  border-radius: 2px;
}

.row__string--bad {
  color: var(--grade-miss);
}

.row__fret {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 16px;
  color: var(--color-text-strong);
  text-align: right;
}
</style>

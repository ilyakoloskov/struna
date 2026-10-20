<script setup lang="ts">
import { computed } from 'vue'
import {
  CIRCLE_OF_FIFTHS,
  circleIndex,
  signatureCount,
  type Key,
  type KeyQuality,
} from '@/domain/theory/keys'
import { capitalize, formatSignatureCount, keyNameRu } from '@/domain/theory/names'
import { formatNote, isSameNote, mod, type SpelledNote } from '@/domain/theory/notes'

// Квинтовый круг: внешнее кольцо — мажорные тональности, внутреннее — параллельные миноры.
// Выбранная пара подсвечена ярко, соседние (IV и V) — приглушённо.
const props = defineProps<{ selected: Key }>()
const emit = defineEmits<{ select: [key: Key] }>()

const R_OUTER = 300
const R_MIDDLE = 198
const R_INNER = 110
const SECTOR = 30

function point(radius: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: radius * Math.sin(a), y: -radius * Math.cos(a) }
}

/** Кольцевой сектор между радиусами r1 < r2, по центру — угол index·30° */
function sectorPath(index: number, r1: number, r2: number): string {
  const a1 = index * SECTOR - SECTOR / 2
  const a2 = a1 + SECTOR
  const p1 = point(r2, a1)
  const p2 = point(r2, a2)
  const p3 = point(r1, a2)
  const p4 = point(r1, a1)
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r2} ${r2} 0 0 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${r1} ${r1} 0 0 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ')
}

const sectors = CIRCLE_OF_FIFTHS.map((sector) => ({
  ...sector,
  outerPath: sectorPath(sector.index, R_MIDDLE, R_OUTER),
  innerPath: sectorPath(sector.index, R_INNER, R_MIDDLE),
  majorLabel: point(252, sector.index * SECTOR),
  minorLabel: point(155, sector.index * SECTOR),
  majorName: sector.major.map(formatNote).join('/'),
  minorName: sector.minor.map((n) => `${formatNote(n)}m`).join('/'),
  signature: sector.major
    .map((tonic) => formatSignatureCount(signatureCount({ tonic, quality: 'major' })))
    .join('/'),
}))

const selectedIndex = computed(() => circleIndex(props.selected))

type Highlight = 'selected' | 'neighbor' | null
function highlight(index: number): Highlight {
  const distance = mod(index - selectedIndex.value, 12)
  if (distance === 0) return 'selected'
  if (distance === 1 || distance === 11) return 'neighbor'
  return null
}

/** У энгармонических секторов сохраняем текущее написание, иначе — основное */
function pickTonic(options: readonly SpelledNote[], quality: KeyQuality): SpelledNote {
  const current =
    props.selected.quality === quality
      ? options.find((n) => isSameNote(n, props.selected.tonic))
      : undefined
  return current ?? options[0]!
}

function select(index: number, quality: KeyQuality) {
  const sector = CIRCLE_OF_FIFTHS[index]!
  emit('select', {
    tonic: pickTonic(quality === 'major' ? sector.major : sector.minor, quality),
    quality,
  })
}

function onKey(event: KeyboardEvent, index: number, quality: KeyQuality) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    select(index, quality)
  }
}

const centerName = computed(() => {
  const { tonic, quality } = props.selected
  return `${formatNote(tonic)}${quality === 'minor' ? 'm' : ''}`
})
const centerCaption = computed(
  () =>
    `${keyNameRu(props.selected.tonic, props.selected.quality)} · ${formatSignatureCount(signatureCount(props.selected))}`,
)
</script>

<template>
  <svg
    class="circle"
    viewBox="-330 -330 660 660"
    role="group"
    :aria-label="`Квинтовый круг, выбрано: ${capitalize(centerCaption)}`"
  >
    <defs>
      <radialGradient id="circle-glow">
        <stop offset="55%" stop-color="rgba(167,139,250,0.16)" />
        <stop offset="100%" stop-color="rgba(167,139,250,0)" />
      </radialGradient>
    </defs>
    <circle r="330" fill="url(#circle-glow)" />

    <g v-for="sector in sectors" :key="sector.index">
      <path
        class="sector sector--major"
        :class="highlight(sector.index) && `sector--${highlight(sector.index)}`"
        :d="sector.outerPath"
        role="button"
        tabindex="0"
        :aria-label="`${sector.majorName} мажор, ${sector.signature}`"
        :aria-pressed="highlight(sector.index) === 'selected' && selected.quality === 'major'"
        @click="select(sector.index, 'major')"
        @keydown="onKey($event, sector.index, 'major')"
      />
      <path
        class="sector sector--minor"
        :class="highlight(sector.index) && `sector--${highlight(sector.index)}`"
        :d="sector.innerPath"
        role="button"
        tabindex="0"
        :aria-label="`${sector.minorName} минор`"
        :aria-pressed="highlight(sector.index) === 'selected' && selected.quality === 'minor'"
        @click="select(sector.index, 'minor')"
        @keydown="onKey($event, sector.index, 'minor')"
      />

      <g
        class="label"
        :class="highlight(sector.index) === 'selected' && 'label--major-selected'"
        :transform="`translate(${sector.majorLabel.x} ${sector.majorLabel.y})`"
      >
        <text class="label__major" :class="{ 'label__major--pair': sector.major.length > 1 }" y="0">
          {{ sector.majorName }}
        </text>
        <text class="label__signature" y="22">{{ sector.signature }}</text>
      </g>
      <text
        class="label label__minor"
        :class="[
          highlight(sector.index) === 'selected' && 'label--minor-selected',
          { 'label__minor--pair': sector.minor.length > 1 },
        ]"
        :x="sector.minorLabel.x"
        :y="sector.minorLabel.y + 6"
      >
        {{ sector.minorName }}
      </text>
    </g>

    <circle class="ring" :r="R_MIDDLE" />
    <circle class="center" :r="R_INNER - 3" />
    <text class="center__name" y="8">{{ centerName }}</text>
    <text class="center__caption" y="46">{{ centerCaption }}</text>
  </svg>
</template>

<style scoped>
.circle {
  width: 100%;
  max-width: 640px;
  height: auto;
  overflow: visible;
  user-select: none;
}

.sector {
  stroke: var(--color-bg);
  stroke-width: 4;
  cursor: pointer;
  outline: none;
  transition: fill var(--dur-fast) ease;
}

.sector--major {
  fill: #13131c;
}

.sector--minor {
  fill: #101018;
}

.sector:hover {
  fill: #1c1c2a;
}

.sector:focus-visible {
  stroke: var(--color-accent);
  stroke-width: 3;
}

.sector--major.sector--neighbor {
  fill: #3a3166;
}

.sector--minor.sector--neighbor {
  fill: #5e3f8c;
}

.sector--major.sector--selected {
  fill: var(--color-accent);
  filter: drop-shadow(0 0 18px rgba(167, 139, 250, 0.55));
}

.sector--minor.sector--selected {
  fill: var(--role-tonic);
  filter: drop-shadow(0 0 18px rgba(232, 121, 249, 0.55));
}

.label {
  pointer-events: none;
}

.label text,
.label__minor,
.center__name,
.center__caption {
  text-anchor: middle;
}

.label__major {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  fill: var(--color-text-strong);
}

.label__major--pair {
  font-size: 18px;
}

.label__signature {
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: 13px;
  fill: var(--color-text-dim);
}

.label--major-selected .label__major {
  fill: var(--color-text-inverse);
}

.label--major-selected .label__signature {
  fill: #2a1f55;
}

.label__minor {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
  fill: var(--color-text);
}

.label__minor--pair {
  font-size: 13px;
}

.label--minor-selected {
  fill: var(--color-text-inverse);
}

.ring {
  fill: none;
  stroke: var(--color-bg);
  stroke-width: 6;
  pointer-events: none;
}

.center {
  fill: #0a0a10;
  stroke: rgba(255, 255, 255, 0.06);
}

.center__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 64px;
  fill: var(--color-text-strong);
}

.center__caption {
  font-family: var(--font-ui);
  font-weight: 700;
  font-size: 15px;
  fill: #c9b8ff;
}

@media (prefers-reduced-motion: reduce) {
  .sector {
    transition: none;
  }
}
</style>

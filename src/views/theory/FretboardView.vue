<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import FretboardDiagram from '@/components/theory/FretboardDiagram.vue'
import LiveToggle from '@/components/theory/LiveToggle.vue'
import NowPlayingCard from '@/components/theory/NowPlayingCard.vue'
import PositionPicker from '@/components/theory/PositionPicker.vue'
import ScaleExercise from '@/components/theory/ScaleExercise.vue'
import ScaleSummary from '@/components/theory/ScaleSummary.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import SelectField from '@/components/ui/SelectField.vue'
import { TUNING_OPTIONS } from '@/components/ui/tuningOptions'
import type { SelectOption } from '@/components/ui/types'
import { useAudioInput } from '@/composables/useAudioInput'
import { useNotePlayer } from '@/composables/useNotePlayer'
import { usePitchDetector } from '@/composables/usePitchDetector'
import { MAX_FRETS, clampFretRange, positionsOf } from '@/domain/theory/fretboard'
import { formatNote, parseSpelledNote, toAscii } from '@/domain/theory/notes'
import { SCALES, TONIC_CHOICES, describePitch, type ScaleId } from '@/domain/theory/scales'
import { scalePositions, supportsCaged } from '@/domain/theory/positions'
import type { LabelMode } from '@/domain/theory/selection'
import { useSettingsStore } from '@/stores/settings'
import { useTheoryStore } from '@/stores/theory'

const theory = useTheoryStore()
const settings = useSettingsStore()
const { scale, triads, scaleId, labels, fretRange, position, positionSystem } = storeToRefs(theory)
const { tuning, tuningId } = storeToRefs(settings)

// --- Управление ---

const tonicOptions: SelectOption<string>[] = TONIC_CHOICES.map((n) => ({
  value: toAscii(n),
  label: formatNote(n),
}))
const tonicValue = computed({
  get: () => toAscii(theory.tonic),
  set: (value: string) => {
    const parsed = parseSpelledNote(value)
    if (parsed) theory.tonic = parsed
  },
})

const scaleOptions: SelectOption<ScaleId>[] = SCALES.map((s) => ({ value: s.id, label: s.label }))

const labelOptions: SelectOption<LabelMode>[] = [
  { value: 'notes', label: 'Ноты' },
  { value: 'degrees', label: 'Ступени' },
  { value: 'intervals', label: 'Интервалы' },
]

const fretOptions = (from: number, to: number): SelectOption<number>[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: String(from + i) }))
const fromOptions = fretOptions(0, MAX_FRETS - 1)
const toOptions = fretOptions(1, MAX_FRETS)

const fretFrom = computed({
  get: () => fretRange.value.from,
  set: (from: number) => (fretRange.value = clampFretRange({ from, to: fretRange.value.to })),
})
const fretTo = computed({
  get: () => fretRange.value.to,
  set: (to: number) =>
    (fretRange.value = clampFretRange({ from: Math.min(fretRange.value.from, to - 1), to })),
})

// --- Позиции гаммы ---

const cagedAvailable = computed(() => supportsCaged(tuning.value))
const positions = computed(() => scalePositions(tuning.value, scale.value, positionSystem.value))
const selectedPosition = computed(() =>
  position.value ? (positions.value[position.value - 1] ?? null) : null,
)

// Позиция не должна обрезаться диапазоном ладов
watch(selectedPosition, (p) => {
  if (!p) return
  const { from, to } = fretRange.value
  if (p.minFret < from || p.maxFret > to) {
    fretRange.value = clampFretRange({
      from: Math.min(from, Math.max(0, p.minFret - 1)),
      to: Math.max(to, Math.min(MAX_FRETS, p.maxFret + 1)),
    })
  }
})

// --- Звук по клику ---

const { playMidi, playSpelled, playChord } = useNotePlayer()

// --- Живой гриф ---

const input = useAudioInput({ autoStart: false })
const { pitch } = usePitchDetector()
const isLive = computed(() => input.status.value === 'running')

function toggleLive() {
  if (input.status.value === 'needs-gesture') void input.resume()
  else if (isLive.value || input.status.value === 'starting') void input.stop()
  else void input.start()
}

const liveMidi = computed(() => (isLive.value && pitch.value ? pitch.value.note : null))
const livePitch = computed(() =>
  liveMidi.value === null
    ? null
    : { ...describePitch(scale.value, liveMidi.value), midi: liveMidi.value },
)
const livePositions = computed(() =>
  liveMidi.value === null ? 0 : positionsOf(tuning.value, liveMidi.value, fretRange.value).length,
)
</script>

<template>
  <div class="fretboard-page">
    <div class="controls">
      <SelectField
        v-model="tonicValue"
        class="controls__tonic"
        label="Тоника"
        :options="tonicOptions"
      />
      <SelectField
        v-model="scaleId"
        class="controls__scale"
        label="Лад / гамма"
        :options="scaleOptions"
        accent
      />
      <SelectField
        v-model="tuningId"
        class="controls__tuning"
        label="Строй"
        :options="TUNING_OPTIONS"
      />
      <div class="controls__group">
        <span class="caps-label">Подписи</span>
        <SegmentedControl v-model="labels" :options="labelOptions" label="Подписи на грифе" />
      </div>
      <div class="controls__group">
        <span class="caps-label">Лады</span>
        <div class="controls__frets">
          <SelectField v-model="fretFrom" class="controls__fret" label="" :options="fromOptions" />
          <span class="controls__dash">—</span>
          <SelectField v-model="fretTo" class="controls__fret" label="" :options="toOptions" />
        </div>
      </div>
      <LiveToggle class="controls__live" :status="input.status.value" @toggle="toggleLive" />
    </div>

    <FretboardDiagram
      :tuning="tuning"
      :scale="scale"
      :range="fretRange"
      :labels="labels"
      :live-midi="liveMidi"
      :live-held="pitch?.held ?? false"
      :position="selectedPosition"
      @play="playMidi"
    />

    <ul class="legend" aria-label="Обозначения">
      <li><i class="legend__dot legend__dot--tonic" />Тоника</li>
      <li><i class="legend__dot legend__dot--third" />Терция</li>
      <li><i class="legend__dot legend__dot--fifth" />Квинта</li>
      <li><i class="legend__dot legend__dot--other" />Ступень гаммы</li>
      <li><i class="legend__dot legend__dot--live" />Звучит сейчас</li>
    </ul>

    <PositionPicker
      v-model:position="position"
      v-model:system="positionSystem"
      :positions="positions"
      :caged-available="cagedAvailable"
    />

    <ScaleExercise
      :tonic="theory.tonic"
      :scale-id="scaleId"
      :range="fretRange"
      :position="selectedPosition"
      :system="positionSystem"
    />

    <div class="bottom">
      <ScaleSummary
        :scale="scale"
        :triads="triads"
        @play-note="playSpelled"
        @play-chord="playChord"
      />
      <NowPlayingCard
        v-if="isLive"
        :pitch="livePitch"
        :positions="livePositions"
        :held="pitch?.held ?? false"
      />
    </div>
  </div>
</template>

<style scoped>
.fretboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 16px;
}

.controls :deep(.field) {
  gap: 6px;
}

.controls :deep(.field__select) {
  height: 44px;
  font-weight: 700;
}

.controls__tonic {
  width: 110px;
}

.controls__scale {
  width: 300px;
}

.controls__tuning {
  width: 220px;
}

.controls__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.controls__group .caps-label,
.controls :deep(.caps-label) {
  font-size: 11px;
}

.controls__frets {
  display: flex;
  align-items: center;
  gap: 6px;
}

.controls__fret {
  width: 76px;
}

.controls__fret :deep(label) {
  display: none;
}

.controls__dash {
  color: var(--color-text-dim);
}

.controls__live {
  margin-left: auto;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 22px;
  margin: -8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--color-text-soft);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend__dot--tonic {
  background: var(--role-tonic);
}

.legend__dot--third {
  background: var(--role-third);
}

.legend__dot--fifth {
  background: var(--role-fifth);
}

.legend__dot--other {
  background: var(--role-other-bg);
  border: 1px solid var(--role-other-border);
}

.legend__dot--live {
  border: 3px solid #fff;
}

.bottom {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 24px;
}
</style>

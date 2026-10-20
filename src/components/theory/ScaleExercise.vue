<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { FretRange } from '@/domain/theory/fretboard'
import { toAscii, type SpelledNote } from '@/domain/theory/notes'
import type { ScalePosition, PositionSystem } from '@/domain/theory/positions'
import type { ScaleId } from '@/domain/theory/scales'
import { EXERCISE_DEFAULT_BPM } from '@/game/exercise'

// Связь теории с тренажёром: сыграть выбранную гамму вверх-вниз в диапазоне ладов с проверкой
const props = defineProps<{
  tonic: SpelledNote
  scaleId: ScaleId
  range: FretRange
  /** Выбранная позиция — упражнение играет ровно её */
  position: ScalePosition | null
  system: PositionSystem
}>()

const BPM_STEPS = [60, 80, 100, 120, 140]
const bpm = ref(EXERCISE_DEFAULT_BPM)

const to = computed(() => ({
  name: 'play',
  params: { trackId: 'exercise' },
  query: {
    key: toAscii(props.tonic),
    mode: props.scaleId,
    ...(props.position
      ? { pos: String(props.position.number), sys: props.system }
      : { frets: `${props.range.from}-${props.range.to}` }),
    bpm: String(bpm.value),
  },
}))

/** Широкий диапазон — гамма растягивается по всему грифу; подсказываем позицию */
const wide = computed(() => !props.position && props.range.to - props.range.from > 5)

const where = computed(() =>
  props.position
    ? `в позиции «${props.position.label}»`
    : `в ладах ${props.range.from}–${props.range.to}`,
)
</script>

<template>
  <section class="exercise">
    <div class="exercise__text">
      <span class="caps-label">Упражнение</span>
      <p>
        Сыграй гамму вверх и вниз восьмыми под метроном {{ where }} — распознавание проверит каждую
        ноту.
      </p>
      <p v-if="wide" class="exercise__hint">
        Совет: выбери позицию выше или сузь диапазон ладов (например, 5–9), чтобы играть без
        переездов.
      </p>
    </div>
    <div class="exercise__controls">
      <div class="bpm" role="radiogroup" aria-label="Темп">
        <button
          v-for="step in BPM_STEPS"
          :key="step"
          type="button"
          role="radio"
          :aria-checked="bpm === step"
          :class="{ 'bpm--on': bpm === step }"
          @click="bpm = step"
        >
          {{ step }}
        </button>
        <span>bpm</span>
      </div>
      <RouterLink class="exercise__start" :to="to">Играть гамму</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.exercise {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px 32px;
  padding: 20px 24px;
  border-radius: var(--radius-tile);
  border: 1px solid rgba(52, 227, 154, 0.3);
  background: rgba(52, 227, 154, 0.05);
}

.exercise__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 560px;
  color: var(--color-text-soft);
  font-size: 14px;
}

.exercise__hint {
  color: var(--color-text-muted);
  font-size: 13px;
}

.exercise__controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.bpm {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.bpm button {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--color-border-mid);
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-soft);
}

.bpm .bpm--on {
  border-color: var(--grade-perfect);
  background: rgba(52, 227, 154, 0.14);
  color: var(--grade-perfect-text);
}

.exercise__start {
  height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 20px;
  border-radius: var(--radius-btn);
  background: var(--color-text);
  font-weight: 700;
  color: var(--color-text-inverse);
}
</style>

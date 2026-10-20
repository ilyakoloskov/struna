import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { diatonicTriads } from '@/domain/theory/chords'
import type { FretRange } from '@/domain/theory/fretboard'
import type { Key } from '@/domain/theory/keys'
import type { SpelledNote } from '@/domain/theory/notes'
import { buildScale, findScale, type ScaleId } from '@/domain/theory/scales'
import { DEFAULT_SELECTION, type LabelMode, type TheorySelection } from '@/domain/theory/selection'

// Выбор на страницах теории. Строй здесь не хранится — он общий, в настройках.
export const useTheoryStore = defineStore('theory', () => {
  const tonic = ref<SpelledNote>({ ...DEFAULT_SELECTION.tonic })
  const scaleId = ref<ScaleId>(DEFAULT_SELECTION.scaleId)
  const labels = ref<LabelMode>(DEFAULT_SELECTION.labels)
  const fretRange = ref<FretRange>({ ...DEFAULT_SELECTION.fretRange })

  const scaleType = computed(() => findScale(scaleId.value)!)
  const scale = computed(() => buildScale(tonic.value, scaleType.value))
  const key = computed<Key>(() => ({ tonic: tonic.value, quality: scaleType.value.quality }))
  const triads = computed(() => diatonicTriads(scale.value))

  const selection = computed<TheorySelection>(() => ({
    tonic: tonic.value,
    scaleId: scaleId.value,
    labels: labels.value,
    fretRange: fretRange.value,
  }))

  function apply(partial: Partial<TheorySelection>) {
    if (partial.tonic) tonic.value = partial.tonic
    if (partial.scaleId) scaleId.value = partial.scaleId
    if (partial.labels) labels.value = partial.labels
    if (partial.fretRange) fretRange.value = partial.fretRange
  }

  /** Выбор тональности на квинтовом круге: мажор → ионийский, минор → эолийский */
  function selectKey(next: Key) {
    tonic.value = next.tonic
    scaleId.value = next.quality === 'major' ? 'ionian' : 'aeolian'
  }

  return {
    tonic,
    scaleId,
    labels,
    fretRange,
    scaleType,
    scale,
    key,
    triads,
    selection,
    apply,
    selectKey,
  }
})

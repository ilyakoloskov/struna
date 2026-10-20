<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CircleOfFifths from '@/components/theory/CircleOfFifths.vue'
import KeyInfoPanel from '@/components/theory/KeyInfoPanel.vue'
import { useNotePlayer } from '@/composables/useNotePlayer'
import { diatonicTriads } from '@/domain/theory/chords'
import { buildScale, findScale } from '@/domain/theory/scales'
import { useTheoryStore } from '@/stores/theory'

const theory = useTheoryStore()
const { key } = storeToRefs(theory)
const route = useRoute()
const router = useRouter()
const { playChord } = useNotePlayer()

// На круге — аккорды тональности (мажор или натуральный минор), даже если на грифе выбран другой лад
const triads = computed(() =>
  diatonicTriads(
    buildScale(key.value.tonic, findScale(key.value.quality === 'major' ? 'ionian' : 'aeolian')!),
  ),
)

function showFretboard() {
  void router.push({ name: 'theory-fretboard', query: route.query })
}
</script>

<template>
  <div class="circle-page">
    <div class="circle-page__circle">
      <CircleOfFifths :selected="key" @select="theory.selectKey" />
    </div>
    <KeyInfoPanel
      class="circle-page__panel"
      :selected="key"
      :triads="triads"
      @select="theory.selectKey"
      @play-chord="playChord"
      @show-fretboard="showFretboard"
    />
  </div>
</template>

<style scoped>
.circle-page {
  display: flex;
  align-items: center;
  gap: 64px;
}

.circle-page__circle {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.circle-page__panel {
  width: 520px;
  flex-shrink: 0;
}

@media (max-width: 1100px) {
  .circle-page {
    flex-direction: column;
    align-items: stretch;
  }

  .circle-page__panel {
    width: 100%;
  }
}
</style>

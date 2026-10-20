<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import PageContainer from '@/components/layout/PageContainer.vue'
import MidiDropZone from '@/components/library/MidiDropZone.vue'
import NotesTable from '@/components/library/NotesTable.vue'
import TrackCard from '@/components/library/TrackCard.vue'
import TransportBar from '@/components/library/TransportBar.vue'
import SelectField from '@/components/ui/SelectField.vue'
import { TUNING_OPTIONS } from '@/components/ui/tuningOptions'
import type { SelectOption } from '@/components/ui/types'
import { useTransport } from '@/composables/useTransport'
import { pluralRu } from '@/domain/ru'
import { assignFingering, countUnplayable } from '@/domain/tracks/fingering'
import { MidiImportError } from '@/domain/tracks/midiImport'
import { guitarTrackOf, useLibraryStore } from '@/stores/library'
import { useResultsStore } from '@/stores/results'
import { useSettingsStore } from '@/stores/settings'

const library = useLibraryStore()
const { tracks, selected, selectedId, loaded } = storeToRefs(library)
const results = useResultsStore()

async function removeTrack(id: string) {
  await library.remove(id)
  results.forgetTrack(id)
}
const settings = useSettingsStore()
const { tuning, tuningId } = storeToRefs(settings)

const transport = useTransport()
const importError = ref<string | null>(null)
const follow = ref(true)

async function onFiles(files: File[]) {
  importError.value = null
  for (const file of files) {
    try {
      await library.importFile(file)
    } catch (error) {
      importError.value =
        error instanceof MidiImportError
          ? `${file.name}: ${error.message}`
          : `${file.name}: не удалось прочитать файл`
    }
  }
}

// Новый выбранный трек — загружаем сэмплы его инструментов
watch(
  () => selected.value?.id,
  () => {
    const track = selected.value
    if (!track) return
    transport.setOptions({ guitarTrackIndex: track.guitarTrackIndex })
    void transport.load(track.song)
  },
  { immediate: true },
)

const guitarOptions = computed<SelectOption<number>[]>(() =>
  (selected.value?.song.tracks ?? [])
    .filter((t) => !t.instrument.percussion)
    .map((t) => ({
      value: t.index,
      label: `${t.name} · ${t.instrument.name} · ${t.notes.length} ${pluralRu(t.notes.length, 'нота', 'ноты', 'нот')}`,
    })),
)

const guitarIndex = computed({
  get: () => selected.value?.guitarTrackIndex ?? -1,
  set: (index: number) => {
    if (!selected.value) return
    library.setGuitarTrack(selected.value.id, index)
    transport.setOptions({ guitarTrackIndex: index })
  },
})

// Позиции на грифе пересчитываются при смене строя или дорожки
const frettedNotes = computed(() => {
  const guitar = selected.value ? guitarTrackOf(selected.value) : undefined
  return guitar ? assignFingering(guitar.notes, tuning.value) : []
})
const unplayable = computed(() => countUnplayable(frettedNotes.value))
</script>

<template>
  <PageContainer>
    <header class="head">
      <div>
        <div class="caps-label">Библиотека</div>
        <h1 class="head__title">Треки</h1>
      </div>
      <MidiDropZone
        v-if="tracks.length"
        compact
        :error="importError"
        @files="onFiles"
        @demo="library.addDemo()"
      />
    </header>

    <p v-if="!loaded" class="loading" role="status">Загружаю библиотеку…</p>

    <MidiDropZone
      v-else-if="!tracks.length"
      :error="importError"
      @files="onFiles"
      @demo="library.addDemo()"
    />

    <div v-else class="layout">
      <aside class="list" aria-label="Треки">
        <TrackCard
          v-for="track in tracks"
          :key="track.id"
          :track="track"
          :selected="track.id === selectedId"
          :tuning-label="tuning.label"
          @select="selectedId = track.id"
          :best="results.bestScore(track.id)"
          @remove="removeTrack(track.id)"
        />
      </aside>

      <section v-if="selected" class="detail">
        <div class="detail__head">
          <div>
            <h2 class="detail__title">{{ selected.song.name }}</h2>
            <p class="detail__meta">
              {{ selected.song.bpm }} bpm · {{ selected.song.timeSignature.join('/') }} ·
              {{ selected.song.tracks.length }}
              {{ pluralRu(selected.song.tracks.length, 'дорожка', 'дорожки', 'дорожек') }}
            </p>
          </div>
          <RouterLink
            class="detail__play"
            :to="{ name: 'play', params: { trackId: selected.id } }"
            :class="{ 'detail__play--disabled': !frettedNotes.length }"
          >
            Играть
          </RouterLink>
        </div>

        <div class="setup">
          <SelectField
            v-model="guitarIndex"
            class="setup__track"
            label="Гитарная дорожка"
            :options="guitarOptions"
            accent
          />
          <SelectField
            v-model="tuningId"
            class="setup__tuning"
            label="Строй"
            :options="TUNING_OPTIONS"
          />
        </div>
        <p v-if="unplayable" class="detail__warning" role="status">
          {{ unplayable }} {{ pluralRu(unplayable, 'нота', 'ноты', 'нот') }} не
          {{ unplayable === 1 ? 'помещается' : 'помещаются' }} в строй {{ tuning.label }} — выбери
          другой строй или дорожку
        </p>

        <TransportBar
          :state="transport.state.value"
          :position="transport.position.value"
          :duration="transport.duration.value"
          :progress="transport.progress.value"
          :options="transport.options.value"
          :failed-instruments="transport.failedInstruments.value"
          @toggle="transport.toggle()"
          @stop="transport.stop()"
          @seek="transport.seek"
          @options="transport.setOptions"
        />

        <div class="notes-head">
          <span class="caps-label"> Ноты гитарной партии · {{ frettedNotes.length }} </span>
          <label class="follow">
            <input v-model="follow" type="checkbox" />
            Следить за воспроизведением
          </label>
        </div>
        <NotesTable
          :notes="frettedNotes"
          :tuning="tuning"
          :position="transport.position.value"
          :follow="follow"
        />
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 28px;
}

.head__title {
  margin-top: 6px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(32px, 4vw, 48px);
  color: var(--color-text-strong);
}

.loading {
  color: var(--color-text-muted);
}

.layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  color: var(--color-text-strong);
}

.detail__meta {
  margin-top: 4px;
  color: var(--color-text-muted);
}

.detail__play {
  height: 48px;
  display: inline-flex;
  align-items: center;
  padding: 0 28px;
  border-radius: var(--radius-btn);
  background: var(--color-text);
  font-weight: 700;
  color: var(--color-text-inverse);
}

.detail__play--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.setup {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.setup__track {
  flex: 1;
  min-width: 260px;
}

.setup__tuning {
  width: 240px;
}

.detail__warning {
  color: var(--grade-good-text);
  font-weight: 600;
}

.notes-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.follow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.follow input {
  accent-color: var(--color-accent);
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>

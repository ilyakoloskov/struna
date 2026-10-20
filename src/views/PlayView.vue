<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AccuracyPanel from '@/components/game/AccuracyPanel.vue'
import FpsMeter from '@/components/game/FpsMeter.vue'
import GameHud from '@/components/game/GameHud.vue'
import GameOverlay from '@/components/game/GameOverlay.vue'
import InputPanel from '@/components/game/InputPanel.vue'
import JudgmentPopup from '@/components/game/JudgmentPopup.vue'
import ScorePanel from '@/components/game/ScorePanel.vue'
import { audioInput } from '@/audio/audioInput'
import { getAudioContext } from '@/audio/context'
import { useAnimationFrame } from '@/composables/useAnimationFrame'
import { useAudioInput } from '@/composables/useAudioInput'
import { useGameSession } from '@/composables/useGameSession'
import { useLaneRenderer, type LaneSource } from '@/composables/useLaneRenderer'
import { useTransport } from '@/composables/useTransport'
import { createDemoSong } from '@/domain/tracks/demoSong'
import { assignFingering } from '@/domain/tracks/fingering'
import type { Beat, Song } from '@/domain/tracks/types'
import { FreeClock, outputLatencyOf } from '@/game/clock'
import { TEST_BPM, createTestPattern, testPatternDuration } from '@/game/lane/testPattern'
import { accuracyOf } from '@/game/score'
import { guitarTrackOf, useLibraryStore } from '@/stores/library'
import { useResultsStore } from '@/stores/results'
import { useSettingsStore } from '@/stores/settings'

// Экран игры (полноэкранный). /play/test — тестовые ноты без звука,
// /play/demo — демо-трек, /play/:id — трек из библиотеки.
// ?autoplay — бот играет сам (проверка без гитары), ?fps — счётчик кадров.
const props = defineProps<{ trackId: string }>()

const route = useRoute()
const router = useRouter()
const { tuning } = storeToRefs(useSettingsStore())
const library = useLibraryStore()
const results = useResultsStore()
const showFps = computed(() => 'fps' in route.query)
const autoplay = 'autoplay' in route.query

const isTest = computed(() => props.trackId === 'test')

const song = computed<Song | null>(() => {
  if (isTest.value) return null
  if (props.trackId === 'demo') return createDemoSong()
  return library.find(props.trackId)?.song ?? null
})

const guitarNotes = computed(() => {
  if (!song.value) return []
  const libraryTrack = library.find(props.trackId)
  const guitar = libraryTrack
    ? guitarTrackOf(libraryTrack)
    : song.value.tracks.find((t) => t.instrument.family === 'guitar')
  return guitar ? guitar.notes : []
})

const testBeats: Beat[] = Array.from(
  { length: (testPatternDuration() * TEST_BPM) / 60 },
  (_, i) => ({ time: (i * 60) / TEST_BPM, downbeat: i % 4 === 0 }),
)

const source = computed<LaneSource | null>(() => {
  const stringCount = tuning.value.strings.length
  if (isTest.value) {
    return { stringCount, notes: createTestPattern(stringCount), beats: testBeats }
  }
  if (!song.value) return null
  return {
    stringCount,
    notes: assignFingering(guitarNotes.value, tuning.value),
    beats: song.value.beats,
  }
})
const chartNotes = computed(() => source.value?.notes ?? [])

const notFound = computed(() => !isTest.value && !song.value)

// --- Часы: тестовый режим — свои, трек — по транспорту (часы AudioContext) ---

const transport = useTransport()
const freeClock = new FreeClock(testPatternDuration())
const clock = { now: () => (isTest.value ? freeClock.now() : transport.clock.now()) }

const canvas = ref<HTMLCanvasElement | null>(null)
const lane = useLaneRenderer(canvas, source, clock)

// --- Вход с гитары и сессия ---

const input = useAudioInput()
const testRunning = ref(false)

const session = useGameSession({
  notes: chartNotes,
  tuning,
  clock,
  isRunning: () => (isTest.value ? testRunning.value : transport.state.value === 'playing'),
  songTimeAt: (contextTime) => (isTest.value ? freeClock.now() : transport.songTimeAt(contextTime)),
  lane,
  autoplay,
})

const score = session.score
const accuracy = computed(() => accuracyOf(score.value))
const best = computed(() => results.bestScore(props.trackId))
const deviceLabel = computed(() => {
  const id = audioInput.activeDeviceId
  return input.devices.value.find((d) => d.id === id)?.label ?? 'Вход по умолчанию'
})
const latencyMs = computed(() => {
  // Пересчитывается при смене статуса входа
  void input.status.value
  return Math.round((outputLatencyOf(getAudioContext()) + audioInput.inputLatency) * 1000)
})

// Всплывающая оценка — над линией удара у своей струны
const popup = computed(() => {
  const judgment = session.lastJudgment.value
  if (!judgment) return null
  return {
    ...judgment,
    x: lane.labelX.value[judgment.stringIndex] ?? 0,
    y: lane.hitLineY.value - 90,
  }
})

// --- Состояние игры ---

type Phase = 'loading' | 'ready' | 'playing' | 'paused' | 'ended'
const testPosition = ref(0)

useAnimationFrame(() => {
  if (isTest.value) testPosition.value = freeClock.now()
})

const position = computed(() => (isTest.value ? testPosition.value : transport.position.value))
const duration = computed(() =>
  isTest.value ? testPatternDuration() : transport.duration.value || song.value?.duration || 0,
)

const phase = computed<Phase>(() => {
  if (isTest.value) return testRunning.value ? 'playing' : 'paused'
  const state = transport.state.value
  if (state === 'idle' || state === 'loading') return 'loading'
  if (state === 'counting' || state === 'playing') return 'playing'
  if (state === 'paused' && position.value >= duration.value - 0.05) return 'ended'
  if (state === 'paused') return 'paused'
  return 'ready'
})

const loadPercent = computed(() => {
  const { loaded, total } = transport.progress.value
  return total ? Math.round((loaded / total) * 100) : 0
})

watch(
  song,
  (next) => {
    if (!next) return
    const libraryTrack = library.find(props.trackId)
    transport.setOptions({
      guitarTrackIndex: libraryTrack?.guitarTrackIndex ?? 0,
      // Гитарную партию играет игрок; в автоигре — слышно, чтобы было с чем сверять
      guitarAudible: autoplay,
      countIn: true,
    })
    void transport.load(next)
  },
  { immediate: true },
)

// Трек доигран — считаем результат и открываем экран результатов
watch(phase, (next) => {
  if (next !== 'ended' || !song.value) return
  const result = session.finish({
    id: crypto.randomUUID(),
    trackId: props.trackId,
    trackName: song.value.name,
    duration: duration.value,
  })
  results.add(result)
  void router.replace({ name: 'results', params: { sessionId: result.id } })
})

function play() {
  if (isTest.value) {
    freeClock.start()
    testRunning.value = true
  } else {
    void transport.play()
  }
}

function pause() {
  if (isTest.value) {
    freeClock.pause()
    testRunning.value = false
  } else {
    transport.pause()
  }
}

function restart() {
  session.reset()
  if (isTest.value) {
    freeClock.pause()
    play()
    return
  }
  transport.stop()
  void transport.play()
}

function toggle() {
  if (phase.value === 'playing') pause()
  else if (phase.value === 'ready' || phase.value === 'paused') play()
}

function onKey(event: KeyboardEvent) {
  if (event.code === 'Space') {
    event.preventDefault()
    toggle()
  } else if (event.code === 'Escape' && phase.value === 'playing') {
    pause()
  }
}

// Ушёл со вкладки — пауза, чтобы не пропустить кусок трека
function onVisibility() {
  if (document.hidden && phase.value === 'playing') pause()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
  if (isTest.value) play()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
})

const title = computed(() => (isTest.value ? 'Тестовые ноты' : (song.value?.name ?? '')))
const subtitle = computed(() => {
  const base = isTest.value ? 'без звука · проверка дорожки' : `${song.value?.bpm ?? ''} bpm`
  return autoplay ? `${base} · автоигра` : base
})

const inputHint = computed(() => {
  if (autoplay) return 'Автоигра: бот сыграет сам, гитара не нужна.'
  if (input.status.value === 'running')
    return 'Гитара подключена. Нажми «Начать» или пробел — будет отсчёт такта.'
  return 'Гитара не подключена — ноты не будут засчитываться.'
})

function exit() {
  void router.push({ name: 'library' })
}
</script>

<template>
  <div class="play">
    <div class="play__stage">
      <canvas ref="canvas" class="play__canvas" />
    </div>

    <GameHud
      v-if="!notFound"
      :title="title"
      :subtitle="subtitle"
      :tuning="tuning"
      :position="position"
      :duration="duration"
      :label-x="lane.labelX.value"
      @pause="pause"
    >
      <template #left>
        <ScorePanel :score="score.score" :combo="score.combo" :multiplier="score.multiplier" />
      </template>
      <template #right>
        <AccuracyPanel
          :accuracy="accuracy"
          :perfect="score.perfect"
          :good="score.good"
          :miss="score.miss"
          :best="best"
        />
      </template>
      <template #bottom-left>
        <InputPanel
          :peak-db="input.peakDb.value"
          :label="deviceLabel"
          :active="input.status.value === 'running'"
        />
      </template>
      <template #bottom-right>
        <div class="status">
          <span>Темп 100 %</span>
          <span>Задержка {{ latencyMs }} мс</span>
        </div>
      </template>
      <JudgmentPopup v-if="popup" :key="popup.id" :grade="popup.grade" :x="popup.x" :y="popup.y" />
    </GameHud>

    <GameOverlay
      v-if="notFound"
      title="Трек не найден"
      text="Библиотека пока живёт в памяти и очищается при перезагрузке страницы. Загрузи трек заново или сыграй демо."
    >
      <RouterLink class="btn btn--primary" :to="{ name: 'library' }">В библиотеку</RouterLink>
      <RouterLink class="btn" :to="{ name: 'play', params: { trackId: 'demo' } }">
        Демо-трек
      </RouterLink>
    </GameOverlay>

    <GameOverlay
      v-else-if="phase === 'loading'"
      title="Загружаю инструменты"
      text="Сэмплы скачиваются один раз и сохраняются в браузере."
      :progress="loadPercent"
    />

    <GameOverlay v-else-if="phase === 'ready'" :title="title" :text="inputHint">
      <button
        v-if="!autoplay && input.status.value !== 'running'"
        type="button"
        class="btn"
        @click="input.start()"
      >
        {{ input.status.value === 'starting' ? 'Подключаю…' : 'Подключить гитару' }}
      </button>
      <button type="button" class="btn btn--primary" @click="play">Начать</button>
      <button type="button" class="btn" @click="exit">В библиотеку</button>
    </GameOverlay>

    <GameOverlay v-else-if="phase === 'paused'" title="Пауза">
      <button type="button" class="btn btn--primary" @click="play">Продолжить</button>
      <button type="button" class="btn" @click="restart">Сначала</button>
      <button type="button" class="btn" @click="exit">Выйти в библиотеку</button>
      <template v-if="!isTest" #options>
        <button
          type="button"
          class="chip"
          :class="{ 'chip--on': transport.options.value.guitarAudible }"
          @click="transport.setOptions({ guitarAudible: !transport.options.value.guitarAudible })"
        >
          Гитарная партия
        </button>
        <button
          type="button"
          class="chip"
          :class="{ 'chip--on': transport.options.value.metronome }"
          @click="transport.setOptions({ metronome: !transport.options.value.metronome })"
        >
          Метроном
        </button>
        <button
          type="button"
          class="chip"
          :class="{ 'chip--on': transport.options.value.countIn }"
          @click="transport.setOptions({ countIn: !transport.options.value.countIn })"
        >
          Отсчёт
        </button>
      </template>
    </GameOverlay>

    <FpsMeter v-if="showFps" :read="lane.stats" />
  </div>
</template>

<style scoped>
.play {
  position: relative;
  flex: 1;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--color-bg);
}

.play__stage {
  position: absolute;
  inset: 0;
}

.play__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.status {
  display: flex;
  gap: 24px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft);
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AccuracyPanel from '@/components/game/AccuracyPanel.vue'
import FpsMeter from '@/components/game/FpsMeter.vue'
import GameHud from '@/components/game/GameHud.vue'
import GameOverlay from '@/components/game/GameOverlay.vue'
import InputPanel from '@/components/game/InputPanel.vue'
import JudgmentPopup from '@/components/game/JudgmentPopup.vue'
import ScorePanel from '@/components/game/ScorePanel.vue'
import MobileNotice from '@/components/ui/MobileNotice.vue'
import { audioInput } from '@/audio/audioInput'
import { useAnimationFrame } from '@/composables/useAnimationFrame'
import { useAudioInput } from '@/composables/useAudioInput'
import { useGameSession } from '@/composables/useGameSession'
import { useLaneRenderer, type LaneSource } from '@/composables/useLaneRenderer'
import { usePlaySource } from '@/composables/usePlaySource'
import { useTransport } from '@/composables/useTransport'
import { useWakeLock } from '@/composables/useWakeLock'
import { formatClock } from '@/domain/time'
import { FreeClock } from '@/game/clock'
import { testPatternDuration } from '@/game/lane/testPattern'
import { formatLoop, leadInStart, parseLoop, parseTempo, snapLoop } from '@/game/loop'
import { accuracyOf, formatAccuracy } from '@/game/score'
import { useResultsStore } from '@/stores/results'
import { useSettingsStore } from '@/stores/settings'

// Экран игры (полноэкранный). Что играем — см. usePlaySource.
// ?tempo=75 — темп, ?loop=a-b — петля (секунды трека), ?autoplay — бот, ?fps — счётчик кадров.
const props = defineProps<{ trackId: string }>()

const route = useRoute()
const router = useRouter()
const { tuning } = storeToRefs(useSettingsStore())
const results = useResultsStore()
const showFps = computed(() => 'fps' in route.query)
const autoplay = 'autoplay' in route.query

const { kind, source, pending } = usePlaySource(toRef(props, 'trackId'))
const isTest = computed(() => kind.value === 'test')
const song = computed(() => source.value?.song ?? null)
const chartNotes = computed(() => source.value?.notes ?? [])
const laneSource = computed<LaneSource | null>(() =>
  source.value
    ? {
        stringCount: tuning.value.strings.length,
        notes: source.value.notes,
        beats: source.value.beats,
      }
    : null,
)
const notFound = computed(() => !pending.value && !source.value)

// --- Часы: тестовый режим — свои, трек — по транспорту (часы AudioContext) ---

const transport = useTransport()
const freeClock = new FreeClock(testPatternDuration())
const clock = { now: () => (isTest.value ? freeClock.now() : transport.clock.now()) }

const canvas = ref<HTMLCanvasElement | null>(null)
const lane = useLaneRenderer(canvas, laneSource, clock)

// --- Темп и петля из адреса ---

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value) as string | undefined
const tempo = computed(() => (isTest.value ? 1 : parseTempo(first(route.query.tempo))))
const loop = computed(() => {
  const s = song.value
  if (!s) return null
  const range = parseLoop(first(route.query.loop), s.duration)
  if (!range) return null
  const snapped = snapLoop(s.beats, range, s.duration)
  return { ...snapped, leadFrom: leadInStart(s.beats, snapped.start) }
})
const isPractice = computed(() => tempo.value < 1 || !!loop.value)

watch(
  [tempo, loop],
  () => {
    transport.setTempo(tempo.value)
    transport.setLoop(loop.value)
  },
  { immediate: true },
)

function updateQuery(patch: Record<string, string | undefined>) {
  const query = { ...route.query, ...patch }
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete query[k]
  void router.replace({ query })
}

function setTempo(percent: number) {
  updateQuery({ tempo: percent === 100 ? undefined : String(percent) })
}

/** Петля на 4 такта вокруг текущего места */
function loopHere() {
  const s = song.value
  if (!s) return
  const bars = s.beats.filter((b) => b.downbeat).map((b) => b.time)
  const position = Math.max(0, transport.position.value)
  // Такт, где стоим, минус один — чтобы место ошибки оказалось внутри петли
  let current = 0
  bars.forEach((t, i) => {
    if (t <= position) current = i
  })
  const index = Math.max(0, current - 1)
  const start = bars[index] ?? 0
  const end = bars[index + 4] ?? s.duration
  updateQuery({ loop: formatLoop({ start, end }) })
}

function clearLoop() {
  updateQuery({ loop: undefined })
}

// --- Вход с гитары и сессия ---

const input = useAudioInput()
const testRunning = ref(false)

const session = useGameSession({
  notes: chartNotes,
  tuning,
  clock,
  isRunning: () => (isTest.value ? testRunning.value : transport.state.value === 'playing'),
  songTimeAt: (contextTime) => (isTest.value ? freeClock.now() : transport.songTimeAt(contextTime)),
  tempo,
  loop,
  pass: transport.pass,
  lane,
  autoplay,
})

const score = session.score
const accuracy = computed(() => accuracyOf(score.value))
const best = computed(() => (source.value ? results.bestScore(source.value.trackId) : null))
const deviceLabel = computed(() => {
  const id = audioInput.activeDeviceId
  return input.devices.value.find((d) => d.id === id)?.label ?? 'Вход по умолчанию'
})
const latencyMs = computed(() => {
  // Пересчитывается при смене статуса входа
  void input.status.value
  return Math.round(session.totalLatency() * 1000)
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
  if (pending.value || state === 'idle' || state === 'loading') return 'loading'
  if (state === 'counting' || state === 'playing') return 'playing'
  if (state === 'paused' && !loop.value && position.value >= duration.value - 0.05) return 'ended'
  if (state === 'paused') return 'paused'
  return 'ready'
})

// Экран не гаснет, пока идёт игра
useWakeLock(computed(() => phase.value === 'playing'))

const loadPercent = computed(() => {
  const { loaded, total } = transport.progress.value
  return total ? Math.round((loaded / total) * 100) : 0
})

watch(
  song,
  (next) => {
    if (!next || !source.value) return
    transport.setOptions({
      guitarTrackIndex: source.value.guitarTrackIndex,
      // Гитарную партию играет игрок; в автоигре — слышно, чтобы было с чем сверять
      guitarAudible: autoplay,
      countIn: true,
      // В упражнении аккомпанемента нет — нужен метроном
      metronome: kind.value === 'exercise',
    })
    void transport.load(next).then(() => {
      transport.setTempo(tempo.value)
      transport.setLoop(loop.value)
    })
  },
  { immediate: true },
)

/** Сохранить результат и открыть экран результатов */
function finish() {
  if (!song.value || !source.value) return
  transport.pause()
  const result = session.finish({
    id: crypto.randomUUID(),
    trackId: source.value.trackId,
    trackName: song.value.name,
    duration: duration.value,
  })
  void results.add(result)
  void router.replace({ name: 'results', params: { sessionId: result.id } })
}

// Трек доигран (без петли) — результат
watch(phase, (next) => {
  if (next === 'ended') finish()
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

const TEMPO_STEPS = [50, 60, 70, 75, 80, 90, 100]

const title = computed(() => (isTest.value ? 'Тестовые ноты' : (song.value?.name ?? '')))
const subtitle = computed(() => {
  if (isTest.value) return 'без звука · проверка дорожки'
  const parts = [`${song.value?.bpm ?? ''} bpm`]
  if (kind.value === 'exercise') parts.push('упражнение')
  if (isPractice.value) parts.push('практика')
  if (autoplay) parts.push('автоигра')
  return parts.join(' · ')
})

const inputHint = computed(() => {
  if (autoplay) return 'Автоигра: бот сыграет сам, гитара не нужна.'
  if (input.status.value === 'running') {
    return 'Гитара подключена. Нажми «Начать» или пробел — будет отсчёт такта.'
  }
  return 'Гитара не подключена — ноты не будут засчитываться.'
})

const passInfo = computed(() => {
  if (!loop.value) return null
  const done = session.passes.value
  return {
    pass: transport.pass.value + 1,
    last: done.at(-1) ?? null,
    best: done.length ? Math.max(...done) : null,
  }
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
      :loop="loop"
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
          :best="isPractice ? null : best"
        />
        <div v-if="passInfo" class="passes">
          <span class="caps-label">Повтор {{ passInfo.pass }}</span>
          <span v-if="passInfo.last !== null && passInfo.best !== null">
            прошлый {{ formatAccuracy(passInfo.last) }} · лучший {{ formatAccuracy(passInfo.best) }}
          </span>
        </div>
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
          <span>Темп {{ Math.round(tempo * 100) }} %</span>
          <span>Задержка {{ latencyMs }} мс</span>
          <span v-if="loop" class="status__loop">
            Петля {{ formatClock(loop.start) }}–{{ formatClock(loop.end) }}
          </span>
        </div>
      </template>
      <JudgmentPopup v-if="popup" :key="popup.id" :grade="popup.grade" :x="popup.x" :y="popup.y" />
    </GameHud>

    <GameOverlay
      v-if="notFound"
      title="Трек не найден"
      text="Возможно, трек удалён из библиотеки. Загрузи его заново или сыграй демо."
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
      <MobileNotice v-if="!autoplay" />
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
      <button v-if="loop && !isTest" type="button" class="btn" @click="finish">
        Закончить практику
      </button>
      <button type="button" class="btn" @click="restart">Сначала</button>
      <button type="button" class="btn" @click="exit">Выйти в библиотеку</button>
      <template v-if="!isTest" #options>
        <div class="practice">
          <span class="caps-label">Темп</span>
          <div class="practice__row">
            <button
              v-for="step in TEMPO_STEPS"
              :key="step"
              type="button"
              class="chip"
              :class="{ 'chip--on': Math.round(tempo * 100) === step }"
              @click="setTempo(step)"
            >
              {{ step }} %
            </button>
          </div>
          <span class="caps-label">Петля</span>
          <div class="practice__row">
            <button type="button" class="chip" @click="loopHere">
              Зациклить это место · 4 такта
            </button>
            <button v-if="loop" type="button" class="chip" @click="clearLoop">Убрать петлю</button>
          </div>
          <span class="caps-label">Звук</span>
          <div class="practice__row">
            <button
              type="button"
              class="chip"
              :class="{ 'chip--on': transport.options.value.guitarAudible }"
              @click="
                transport.setOptions({ guitarAudible: !transport.options.value.guitarAudible })
              "
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
          </div>
        </div>
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

.status__loop {
  color: #ffc65a;
}

.passes {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-soft);
}

.practice {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
}

.practice .caps-label {
  margin-top: 6px;
  font-size: 11px;
}

.practice__row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>

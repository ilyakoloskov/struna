import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { audioInput } from '@/audio/audioInput'
import { getAudioContext } from '@/audio/context'
import type { TransportLoop } from '@/audio/playback/transport'
import { seededRandom } from '@/domain/random'
import type { Tuning } from '@/domain/music/tunings'
import type { FrettedNote } from '@/domain/tracks/types'
import { outputLatencyOf, type GameClock } from '@/game/clock'
import { PlayedNoteDetector, type PlayedNote } from '@/game/input/playedNotes'
import { Judge, buildTargets, type Grade, type Judgment, type Target } from '@/game/judge'
import { NOTE_GHOST, NOTE_HIDDEN, NOTE_HIT, NOTE_MISSED, NOTE_PENDING } from '@/game/noteState'
import { buildResult, type SessionResult } from '@/game/results'
import { EMPTY_SCORE, accuracyOf, applyGrade, type ScoreState } from '@/game/score'
import { useSettingsStore } from '@/stores/settings'
import { useAnimationFrame } from './useAnimationFrame'

export interface LastJudgment {
  grade: Grade
  /** Струна (индекс от низкой) — для позиции всплывающей оценки */
  stringIndex: number
  /** Растёт с каждой оценкой — перезапускает анимацию */
  id: number
}

interface SessionDeps {
  notes: Ref<readonly FrettedNote[]>
  tuning: Ref<Tuning>
  clock: GameClock
  /** Идёт ли воспроизведение (сыгранное засчитывается только тогда) */
  isRunning: () => boolean
  /** Время трека для момента по часам AudioContext */
  songTimeAt: (contextTime: number) => number
  /** Темп 0.5…1 — задержки в реальных секундах переводятся в секунды трека */
  tempo: Ref<number>
  /** Петля (или null) и номер прохода — на каждом проходе судейство начинается заново */
  loop: Ref<TransportLoop | null>
  pass: Ref<number>
  lane: {
    setNoteStates(states: Uint8Array | null): void
    hit(strings: readonly number[], perfect: boolean): void
    resetEffects(): void
  }
  /** Автоигра для проверки без гитары: бот «играет» ноты с разбросом по времени */
  autoplay: boolean
}

/**
 * Игровая сессия: сыгранные ноты с входа → судейство → счёт → эффекты на дорожке.
 * Время сыгранной ноты переводится во время трека «как слышит игрок»: минус задержка вывода
 * (когда он услышал ноту), задержка ввода (когда звук дошёл до нас) и поправка калибровки.
 * В петле судятся только ноты внутри неё; у каждого прохода своя точность.
 */
export function useGameSession(deps: SessionDeps) {
  const { latencyOffsetMs } = storeToRefs(useSettingsStore())
  const score = ref<ScoreState>(EMPTY_SCORE)
  const lastJudgment = shallowRef<LastJudgment | null>(null)
  const extraNotes = ref(0)
  /** Точность завершённых проходов петли */
  const passes = ref<number[]>([])
  /** Счёт текущего прохода — для точности прохода */
  const passScore = ref<ScoreState>(EMPTY_SCORE)

  let targets: Target[] = []
  let judge = new Judge([])
  let states = new Uint8Array(0)
  let judgmentId = 0
  let botCursor = 0
  let botPlan: { time: number; skip: boolean }[] = []
  let botSeed = 7

  /** Цели, которые судятся: в петле — только внутри неё */
  function judgedTargets(): Target[] {
    const all = buildTargets(deps.notes.value)
    const loop = deps.loop.value
    return loop ? all.filter((t) => t.time >= loop.start - 1e-6 && t.time < loop.end - 1e-6) : all
  }

  /** Новый проход: свежий судья, состояния нот, план бота */
  function beginPass() {
    targets = judgedTargets()
    judge = new Judge(targets)
    const loop = deps.loop.value
    deps.notes.value.forEach((note, i) => {
      if (!loop) states[i] = NOTE_PENDING
      else if (note.time < loop.leadFrom - 1e-6 || note.time >= loop.end - 1e-6)
        states[i] = NOTE_HIDDEN
      else if (note.time < loop.start - 1e-6) states[i] = NOTE_GHOST
      else states[i] = NOTE_PENDING
    })
    passScore.value = EMPTY_SCORE
    // План бота: разброс ±70 мс и ~6 % пропусков — чтобы были и Perfect, и Good, и Miss
    const random = seededRandom(botSeed++)
    botPlan = targets.map((t) => ({
      time: t.time + (random() + random() - 1) * 0.07,
      skip: random() < 0.06,
    }))
    botCursor = 0
  }

  function reset() {
    states = new Uint8Array(deps.notes.value.length)
    deps.lane.setNoteStates(states)
    deps.lane.resetEffects()
    score.value = EMPTY_SCORE
    extraNotes.value = 0
    lastJudgment.value = null
    passes.value = []
    botSeed = 7
    beginPass()
  }

  watch([deps.notes, deps.loop], reset, { immediate: true })

  // Новый проход петли: подводим итог прошлого и начинаем заново
  watch(deps.pass, (pass, previous) => {
    if (pass <= previous) return
    judge.advance(Infinity, apply)
    if (targets.length) passes.value = [...passes.value, accuracyOf(passScore.value)]
    deps.lane.resetEffects()
    beginPass()
  })

  function apply(judgment: Judgment) {
    const target = targets[judgment.targetIndex]!
    score.value = applyGrade(score.value, judgment.grade)
    passScore.value = applyGrade(passScore.value, judgment.grade)
    const state = judgment.grade === 'miss' ? NOTE_MISSED : NOTE_HIT
    for (const index of target.noteIndices) states[index] = state
    if (judgment.grade !== 'miss') deps.lane.hit(target.strings, judgment.grade === 'perfect')
    lastJudgment.value = {
      grade: judgment.grade,
      stringIndex: target.strings[0] ?? 0,
      id: ++judgmentId,
    }
  }

  function play(songTime: number, midi: number) {
    const judgment = judge.play(songTime, midi)
    extraNotes.value += judgment ? 0 : 1
    if (judgment) apply(judgment)
  }

  // --- Вход с гитары ---

  let detector: PlayedNoteDetector | null = null
  let detectorFrame = 0

  function ensureDetector(): PlayedNoteDetector | null {
    const frame = audioInput.frameDuration
    if (!frame) return null
    if (!detector || frame !== detectorFrame) {
      detectorFrame = frame
      detector = new PlayedNoteDetector({ frameDuration: frame }, onPlayed)
    }
    return detector
  }

  /** Полная задержка в реальных секундах: вывод + ввод + поправка калибровки */
  function totalLatency(): number {
    return (
      outputLatencyOf(getAudioContext()) + audioInput.inputLatency + latencyOffsetMs.value / 1000
    )
  }

  function onPlayed(note: PlayedNote) {
    if (deps.autoplay || !deps.isRunning()) return
    play(deps.songTimeAt(note.time) - totalLatency() * deps.tempo.value, note.midi)
  }

  const offOnset = audioInput.onOnset((onset) => ensureDetector()?.onOnset(onset.time / 1000))
  const offFrame = audioInput.onFrame((frame) =>
    ensureDetector()?.onFrame({
      time: frame.time / 1000,
      freq: frame.freq,
      clarity: frame.clarity,
      rms: frame.rms,
    }),
  )

  // --- Каждый кадр: промахи по прошедшим нотам и ходы бота ---

  useAnimationFrame(() => {
    if (!deps.isRunning()) return
    const now = deps.clock.now()
    if (deps.autoplay) {
      while (botCursor < botPlan.length && botPlan[botCursor]!.time <= now) {
        const plan = botPlan[botCursor]!
        const target = targets[botCursor]!
        if (!plan.skip) play(plan.time, target.midis[0]!)
        botCursor++
      }
    }
    judge.advance(now, apply)
  })

  onBeforeUnmount(() => {
    offOnset()
    offFrame()
  })

  function finish(meta: {
    id: string
    trackId: string
    trackName: string
    duration: number
  }): SessionResult {
    // Добиваем промахи до конца трека (или прохода петли)
    judge.advance(Infinity, apply)
    const loop = deps.loop.value
    return buildResult({
      ...meta,
      tuning: deps.tuning.value,
      targets,
      grades: judge.grades,
      score: score.value,
      extraNotes: extraNotes.value,
      tempo: deps.tempo.value,
      loop: loop ? { start: loop.start, end: loop.end } : null,
    })
  }

  return {
    score,
    lastJudgment,
    extraNotes,
    passes,
    passScore,
    totalLatency,
    reset,
    finish,
  }
}

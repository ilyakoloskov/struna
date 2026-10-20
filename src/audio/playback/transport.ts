import { getAudioContext, resumeAudioContext } from '../context'
import type { Beat, NoteEvent, Song } from '@/domain/tracks/types'
import { createVoice, scheduleClick, type LoadProgress, type Voice } from './instruments'
import { PlaybackClock } from './playbackClock'
import { EventCursor, countIn } from './timeline'

// Транспорт трека: упреждающее планирование по часам AudioContext
// («A tale of two clocks»): таймер раз в 25 мс ставит в очередь всё, что прозвучит
// в ближайшие 150 мс. Точность — по часам аудио, а не таймера, поэтому UI не сбивает ритм.
// Темп (50–100 %) растягивает время; петля повторяет фрагмент с заходом за такт.

export type TransportState = 'idle' | 'loading' | 'ready' | 'counting' | 'playing' | 'paused'

export interface TransportOptions {
  /** Индекс гитарной дорожки — её можно заглушить, чтобы играть самому */
  guitarTrackIndex: number | null
  guitarAudible: boolean
  metronome: boolean
  countIn: boolean
}

export interface TransportLoop {
  start: number
  end: number
  /** Откуда начинается каждый проход (заход за такт до start) */
  leadFrom: number
}

const TICK_MS = 25
/** Окно планирования, реальные секунды */
const LOOKAHEAD = 0.15
/** Запас от «сейчас» до первой ноты, чтобы успеть поставить её в очередь */
const START_LEAD = 0.08

interface TrackPlayer {
  trackIndex: number
  voice: Voice
  cursor: EventCursor<NoteEvent>
  isGuitar: boolean
}

type Listener = () => void

export class Transport {
  private readonly context = getAudioContext()
  private readonly master: GainNode
  private song: Song | null = null
  private players: TrackPlayer[] = []
  private beats: EventCursor<Beat> = new EventCursor([])
  private timer: ReturnType<typeof setInterval> | null = null
  private clock = new PlaybackClock(1)
  private pausedAt = 0
  private loadToken = 0
  private loopRange: TransportLoop | null = null
  private readonly listeners = new Set<Listener>()

  state: TransportState = 'idle'
  progress: LoadProgress = { loaded: 0, total: 0 }
  /** Инструменты, сэмплы которых не загрузились (например, нет сети) */
  failedInstruments: string[] = []
  options: TransportOptions = {
    guitarTrackIndex: null,
    guitarAudible: false,
    metronome: false,
    countIn: true,
  }

  constructor() {
    this.master = this.context.createGain()
    this.master.gain.value = 0.8
    this.master.connect(this.context.destination)
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Позиция в треке, с; во время отсчёта — отрицательная */
  get position(): number {
    if (this.isRunning) return this.clock.songTime(this.context.currentTime)
    return this.pausedAt
  }

  /** Время трека для момента по часам AudioContext (без побочных эффектов — для ударов игрока) */
  songTimeAt(contextTime: number): number {
    return this.clock.songTimeAt(contextTime)
  }

  /** Номер прохода петли (0 — первый); обновляется вместе с position */
  get pass(): number {
    return this.clock.pass
  }

  get tempo(): number {
    return this.clock.rate
  }

  get loop(): TransportLoop | null {
    return this.loopRange
  }

  get isRunning(): boolean {
    return this.state === 'playing' || this.state === 'counting'
  }

  get duration(): number {
    return this.song?.duration ?? 0
  }

  async load(song: Song): Promise<void> {
    this.unload()
    const token = ++this.loadToken
    this.song = song
    this.setState('loading')

    const progressByTrack = new Map<number, LoadProgress>()
    const failed: string[] = []
    this.players = song.tracks.map((track) => {
      const voice = createVoice(this.context, track.instrument, this.master, (p) => {
        progressByTrack.set(track.index, p)
        this.progress = [...progressByTrack.values()].reduce(
          (sum, x) => ({ loaded: sum.loaded + x.loaded, total: sum.total + x.total }),
          { loaded: 0, total: 0 },
        )
        this.emit()
      })
      voice.ready.catch(() => failed.push(track.name))
      return {
        trackIndex: track.index,
        voice,
        cursor: new EventCursor(track.notes),
        isGuitar: track.index === this.options.guitarTrackIndex,
      }
    })
    this.beats = new EventCursor(song.beats)

    await Promise.allSettled(this.players.map((p) => p.voice.ready))
    if (token !== this.loadToken) return
    this.failedInstruments = failed
    this.pausedAt = this.loopRange?.leadFrom ?? 0
    this.setState('ready')
  }

  setOptions(options: Partial<TransportOptions>): void {
    this.options = { ...this.options, ...options }
    for (const player of this.players) {
      player.isGuitar = player.trackIndex === this.options.guitarTrackIndex
      // Заглушили гитару на ходу — обрываем её звучащие ноты
      if (player.isGuitar && !this.options.guitarAudible) player.voice.stopAll()
    }
    this.emit()
  }

  /** Темп 0.5…1; меняется только на остановленном транспорте */
  setTempo(rate: number): void {
    if (this.isRunning) return
    this.clock = new PlaybackClock(Math.min(1, Math.max(0.5, rate)))
    this.emit()
  }

  /** Петля или null; начало воспроизведения переносится на заход */
  setLoop(loop: TransportLoop | null): void {
    if (this.isRunning) return
    this.loopRange = loop
    this.clock = new PlaybackClock(this.clock.rate)
    this.pausedAt = loop ? loop.leadFrom : 0
    this.emit()
  }

  async play(): Promise<void> {
    if (!this.song || this.isRunning) return
    if (this.state === 'loading' || this.state === 'idle') return
    await resumeAudioContext()
    const loop = this.loopRange
    if (loop && (this.pausedAt < loop.leadFrom || this.pausedAt >= loop.end)) {
      this.pausedAt = loop.leadFrom
    }
    if (!loop && this.pausedAt >= this.duration) this.pausedAt = 0

    const now = this.context.currentTime + START_LEAD
    let lead = 0
    if (this.options.countIn) {
      const count = countIn(this.song)
      for (const click of count.clicks) {
        scheduleClick(this.context, now + click.offset / this.clock.rate, click.accent, this.master)
      }
      lead = count.duration / this.clock.rate
    }
    this.clock.start(now + lead, this.pausedAt)
    this.seekCursors(this.pausedAt)
    this.setState(lead > 0 ? 'counting' : 'playing')
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  pause(): void {
    if (!this.isRunning) return
    this.pausedAt = Math.max(0, this.position)
    this.halt()
    this.setState('paused')
  }

  seek(time: number): void {
    const wasPlaying = this.isRunning
    if (wasPlaying) this.halt()
    this.pausedAt = Math.max(0, Math.min(this.duration, time))
    if (wasPlaying) {
      this.state = 'paused'
      void this.play()
    } else {
      this.emit()
    }
  }

  stop(): void {
    this.halt()
    this.clock = new PlaybackClock(this.clock.rate)
    this.pausedAt = this.loopRange?.leadFrom ?? 0
    if (this.song) this.setState('ready')
  }

  dispose(): void {
    this.unload()
    this.master.disconnect()
    this.listeners.clear()
  }

  private tick() {
    const passBefore = this.clock.pass
    const position = this.position
    if (this.clock.pass !== passBefore) this.emit()
    if (this.state === 'counting' && position >= 0) this.setState('playing')
    const loop = this.loopRange
    if (!loop && position > this.duration + 0.3) {
      this.halt()
      this.pausedAt = this.duration
      this.setState('paused')
      return
    }

    const horizon = position + LOOKAHEAD * this.clock.rate
    if (!loop) {
      this.schedule(horizon, Infinity)
      return
    }

    if (!this.clock.hasPendingWrap) {
      this.schedule(Math.min(horizon, loop.end), loop.end)
      // Граница петли в окне планирования: ставим переход и сразу ноты следующего прохода
      if (horizon >= loop.end) {
        this.clock.scheduleWrap(loop.end, loop.leadFrom)
        this.seekCursors(loop.leadFrom)
      }
    }
    if (this.clock.hasPendingWrap) {
      this.schedule(loop.leadFrom + Math.max(0, horizon - loop.end), loop.end)
    }
  }

  /** Ставит в очередь всё, что начинается раньше until (время трека); ноты обрезаются по limit */
  private schedule(until: number, limit: number) {
    const late = this.context.currentTime - 0.05
    const rate = this.clock.rate
    for (const player of this.players) {
      const notes = player.cursor.take(until)
      if (player.isGuitar && !this.options.guitarAudible) continue
      for (const note of notes) {
        const when = this.clock.contextTime(note.time)
        if (when < late) continue
        const duration = Math.min(note.duration, limit - note.time) / rate
        if (duration > 0)
          player.voice.play(note, Math.max(when, this.context.currentTime), duration)
      }
    }
    for (const beat of this.beats.take(until)) {
      const when = this.clock.contextTime(beat.time)
      if (this.options.metronome && when >= late) {
        scheduleClick(this.context, when, beat.downbeat, this.master)
      }
    }
  }

  private seekCursors(time: number) {
    for (const player of this.players) player.cursor.seek(time)
    this.beats.seek(time)
  }

  private halt() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const player of this.players) player.voice.stopAll()
  }

  private unload() {
    this.halt()
    for (const player of this.players) player.voice.dispose()
    this.players = []
    this.song = null
    this.progress = { loaded: 0, total: 0 }
    this.failedInstruments = []
    this.state = 'idle'
  }

  private setState(state: TransportState) {
    this.state = state
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

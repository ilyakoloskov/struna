import { getAudioContext, resumeAudioContext } from '../context'
import type { Beat, NoteEvent, Song } from '@/domain/tracks/types'
import { createVoice, scheduleClick, type LoadProgress, type Voice } from './instruments'
import { EventCursor, countIn } from './timeline'

// Транспорт трека: упреждающее планирование по часам AudioContext
// («A tale of two clocks»): таймер раз в 25 мс ставит в очередь всё, что прозвучит
// в ближайшие 150 мс. Точность — по часам аудио, а не таймера, поэтому UI не сбивает ритм.

export type TransportState = 'idle' | 'loading' | 'ready' | 'counting' | 'playing' | 'paused'

export interface TransportOptions {
  /** Индекс гитарной дорожки — её можно заглушить, чтобы играть самому */
  guitarTrackIndex: number | null
  guitarAudible: boolean
  metronome: boolean
  countIn: boolean
}

const TICK_MS = 25
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
  /** Время AudioContext, соответствующее нулю трека */
  private origin = 0
  private pausedAt = 0
  private loadToken = 0
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
    if (this.state === 'playing' || this.state === 'counting') {
      return this.context.currentTime - this.origin
    }
    return this.pausedAt
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
    this.pausedAt = 0
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

  async play(): Promise<void> {
    if (!this.song || this.state === 'playing' || this.state === 'counting') return
    if (this.state === 'loading' || this.state === 'idle') return
    await resumeAudioContext()
    if (this.pausedAt >= this.duration) this.pausedAt = 0

    const now = this.context.currentTime + START_LEAD
    let lead = 0
    if (this.options.countIn) {
      const count = countIn(this.song)
      for (const click of count.clicks) {
        scheduleClick(this.context, now + click.offset, click.accent, this.master)
      }
      lead = count.duration
    }
    this.origin = now + lead - this.pausedAt
    this.seekCursors(this.pausedAt)
    this.setState(lead > 0 ? 'counting' : 'playing')
    this.timer = setInterval(() => this.tick(), TICK_MS)
    this.tick()
  }

  pause(): void {
    if (this.state !== 'playing' && this.state !== 'counting') return
    this.pausedAt = Math.max(0, this.position)
    this.halt()
    this.setState('paused')
  }

  seek(time: number): void {
    const wasPlaying = this.state === 'playing' || this.state === 'counting'
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
    this.pausedAt = 0
    if (this.song) this.setState('ready')
  }

  dispose(): void {
    this.unload()
    this.master.disconnect()
    this.listeners.clear()
  }

  private tick() {
    const position = this.position
    if (this.state === 'counting' && position >= 0) this.setState('playing')
    if (position > this.duration + 0.3) {
      this.halt()
      this.pausedAt = this.duration
      this.setState('paused')
      return
    }

    const until = position + LOOKAHEAD
    const late = this.context.currentTime - 0.05
    for (const player of this.players) {
      const notes = player.cursor.take(until)
      if (player.isGuitar && !this.options.guitarAudible) continue
      for (const note of notes) {
        const when = this.origin + note.time
        if (when >= late) player.voice.play(note, Math.max(when, this.context.currentTime))
      }
    }
    for (const beat of this.beats.take(until)) {
      const when = this.origin + beat.time
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

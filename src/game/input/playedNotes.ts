import { freqToMidi } from '@/domain/music/pitch'
import { medianOf } from '@/audio/dsp/stabilizer'

// Сыгранные ноты из двух потоков ворклета: начала нот (onset) и кадров высоты (YIN).
// Время ноты — момент удара (точный), высота — медиана кадров сразу после атаки.
// Кадр высоты описывает окно длиной frameDuration, заканчивающееся в frame.time,
// поэтому ждём кадры, окно которых целиком после атаки.
// Легато (хаммер-он, слайд) — смена устойчивой высоты без нового удара — тоже нота.
// Удар без устойчивой высоты (глухая нота) — нота с midi = NaN.

export interface PitchSample {
  /** Конец окна анализа, с (часы AudioContext) */
  time: number
  freq: number
  clarity: number
  rms: number
}

export interface PlayedNote {
  /** Начало ноты, с (часы AudioContext) */
  time: number
  /** Дробный MIDI; NaN — удар без высоты (глухая нота) */
  midi: number
  source: 'onset' | 'legato'
}

export interface PlayedNoteOptions {
  /** Длина окна детектора высоты, с */
  frameDuration: number
  a4?: number
  minClarity?: number
  minRms?: number
  /** Пропуск самой атаки — там высота неустойчива, с */
  attackSkip?: number
  /** Сколько кадров нужно для решения */
  framesNeeded?: number
  /** Если кадров мало — решаем по тому, что есть, через это время после удара, с */
  timeout?: number
  /** Сколько кадров подряд новая высота должна держаться, чтобы считаться легато */
  legatoFrames?: number
}

interface Pending {
  time: number
  midis: number[]
}

export class PlayedNoteDetector {
  private readonly opts: Required<PlayedNoteOptions>
  private pending: Pending | null = null
  private currentNote: number | null = null
  private legatoCandidate: number | null = null
  private legatoCount = 0
  private legatoStart = 0

  constructor(
    options: PlayedNoteOptions,
    private readonly emit: (note: PlayedNote) => void,
  ) {
    this.opts = {
      a4: 440,
      minClarity: 0.8,
      minRms: 0.003,
      attackSkip: 0.012,
      framesNeeded: 2,
      timeout: 0.2,
      legatoFrames: 3,
      ...options,
    }
  }

  onOnset(time: number): void {
    this.flush()
    this.pending = { time, midis: [] }
    this.resetLegato()
  }

  onFrame(frame: PitchSample): void {
    const { frameDuration, minClarity, minRms, attackSkip, framesNeeded, timeout, a4 } = this.opts
    const voiced = frame.freq > 0 && frame.clarity >= minClarity && frame.rms >= minRms
    const midi = voiced ? freqToMidi(frame.freq, a4) : null

    const pending = this.pending
    if (pending) {
      const windowStart = frame.time - frameDuration
      if (midi !== null && windowStart >= pending.time + attackSkip) pending.midis.push(midi)
      if (pending.midis.length >= framesNeeded) this.flush()
      else if (frame.time - pending.time > timeout + frameDuration) this.flush()
      return
    }

    if (midi === null) {
      // Тишина — следующая высота уже не легато
      this.currentNote = null
      this.resetLegato()
      return
    }
    this.trackLegato(frame.time, midi)
  }

  private trackLegato(time: number, midi: number) {
    const note = Math.round(midi)
    if (this.currentNote === null || note === this.currentNote) {
      this.resetLegato()
      return
    }
    if (note !== this.legatoCandidate) {
      this.legatoCandidate = note
      this.legatoCount = 0
      // Новая высота началась где-то внутри окна этого кадра — берём его середину
      this.legatoStart = time - this.opts.frameDuration / 2
    }
    this.legatoCount++
    if (this.legatoCount >= this.opts.legatoFrames) {
      this.currentNote = note
      this.emit({ time: this.legatoStart, midi, source: 'legato' })
      this.resetLegato()
    }
  }

  private flush() {
    const pending = this.pending
    this.pending = null
    if (!pending) return
    if (pending.midis.length === 0) {
      this.currentNote = null
      this.emit({ time: pending.time, midi: Number.NaN, source: 'onset' })
      return
    }
    const midi = medianOf(pending.midis)
    this.currentNote = Math.round(midi)
    this.emit({ time: pending.time, midi, source: 'onset' })
  }

  private resetLegato() {
    this.legatoCandidate = null
    this.legatoCount = 0
  }
}

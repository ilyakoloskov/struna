import { freqToMidi, DEFAULT_A4 } from '@/domain/music/pitch'

// Стабилизация показаний детектора, чтобы стрелка тюнера не дёргалась:
// 1) гейт по громкости и уверенности — шум и затухающая струна отбрасываются;
// 2) медиана последних кадров — убирает одиночные выбросы (в т.ч. октавные);
// 3) гистерезис ноты — смена ноты только после N кадров подряд;
// 4) экспоненциальное сглаживание высоты;
// 5) удержание последнего показания после затухания.

export interface PitchFrame {
  /** Частота в Гц, 0 — высота не найдена */
  freq: number
  clarity: number
  /** Среднеквадратичная амплитуда кадра, 0…1 */
  rms: number
  /** Время кадра, мс */
  time: number
}

export interface StableReading {
  /** Сглаженная высота, дробный MIDI */
  midi: number
  /** Текущая нота после гистерезиса, целый MIDI */
  note: number
  /** true — сигнал затих, показываем удержанное значение */
  held: boolean
}

export interface StabilizerOptions {
  minClarity: number
  minRms: number
  medianSize: number
  /** Сколько кадров подряд новая нота должна держаться, чтобы её принять */
  switchFrames: number
  /** Коэффициент сглаживания 0…1: больше — быстрее реакция, меньше — спокойнее стрелка */
  smoothing: number
  holdMs: number
  a4: number
}

export const DEFAULT_STABILIZER_OPTIONS: StabilizerOptions = {
  minClarity: 0.8,
  minRms: 0.003, // ≈ −50 dBFS
  medianSize: 5,
  switchFrames: 3,
  smoothing: 0.25,
  holdMs: 1200,
  a4: DEFAULT_A4,
}

export class PitchStabilizer {
  private readonly options: StabilizerOptions
  private history: number[] = []
  private current: StableReading | null = null
  private candidate: number | null = null
  private candidateCount = 0
  private lastVoicedTime = -Infinity

  constructor(options: Partial<StabilizerOptions> = {}) {
    this.options = { ...DEFAULT_STABILIZER_OPTIONS, ...options }
  }

  reset(): void {
    this.history = []
    this.current = null
    this.candidate = null
    this.candidateCount = 0
    this.lastVoicedTime = -Infinity
  }

  push(frame: PitchFrame): StableReading | null {
    const { minClarity, minRms, medianSize, switchFrames, smoothing, holdMs, a4 } = this.options
    const voiced = frame.freq > 0 && frame.clarity >= minClarity && frame.rms >= minRms

    if (!voiced) {
      this.history = []
      this.candidate = null
      this.candidateCount = 0
      if (this.current && frame.time - this.lastVoicedTime <= holdMs) {
        return { ...this.current, held: true }
      }
      this.current = null
      return null
    }

    this.lastVoicedTime = frame.time
    this.history.push(freqToMidi(frame.freq, a4))
    if (this.history.length > medianSize) this.history.shift()
    const median = medianOf(this.history)
    const nearestNote = Math.round(median)

    if (!this.current) {
      this.current = { midi: median, note: nearestNote, held: false }
      return { ...this.current }
    }

    if (nearestNote !== this.current.note) {
      if (nearestNote === this.candidate) {
        this.candidateCount++
      } else {
        this.candidate = nearestNote
        this.candidateCount = 1
      }
      if (this.candidateCount >= switchFrames) {
        // Новая нота подтверждена: прыгаем сразу, без плавного перехода
        this.current = { midi: median, note: nearestNote, held: false }
        this.candidate = null
        this.candidateCount = 0
      }
      return { ...this.current, held: false }
    }

    this.candidate = null
    this.candidateCount = 0
    const midi = this.current.midi + smoothing * (median - this.current.midi)
    this.current = { midi, note: this.current.note, held: false }
    return { ...this.current }
  }
}

export function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

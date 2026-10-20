// AudioWorkletProcessor: копит вход в кольцевом буфере и каждые hopSize сэмплов
// оценивает высоту (YIN), RMS и пик; на каждом блоке ищет начало ноты (onset).
// Работает в аудиопотоке — без аллокаций в process().

import { BiquadLowpass } from '../dsp/biquad'
import { CHROMA_SIZE, ChromaAnalyzer } from '../dsp/chroma'
import { OnsetDetector } from '../dsp/onset'
import { YinDetector } from '../dsp/yin'
import {
  PITCH_PROCESSOR_NAME,
  type AnalysisFrameMessage,
  type ChromaMessage,
  type OnsetMessage,
  type ProcessorCommand,
} from './messages'

// Глобалы AudioWorkletGlobalScope (в lib.dom их нет)
declare const currentTime: number
declare const sampleRate: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

class PitchProcessor extends AudioWorkletProcessor {
  private detector: YinDetector | null = null
  private lowpass: BiquadLowpass | null = null
  private readonly onset = new OnsetDetector({ sampleRate })
  private readonly onsetMessage: OnsetMessage = { type: 'onset', time: 0, strength: 0 }
  // Хрома для проверки аккордов: сырой сигнал (ФНЧ срезал бы верх диапазона),
  // считается один раз после каждого удара — по окну сразу после атаки
  private readonly chroma = new ChromaAnalyzer(sampleRate)
  private readonly rawRing = new Float32Array(CHROMA_SIZE)
  private readonly rawFrame = new Float32Array(CHROMA_SIZE)
  private rawIndex = 0
  /** Сколько сэмплов осталось до расчёта хромы (−1 — не ждём) */
  private chromaCountdown = -1
  private chromaOnsetTime = 0
  private ring = new Float32Array(0)
  private frame = new Float32Array(0)
  private writeIndex = 0
  private filled = 0
  private hopSize = 512
  private sinceHop = 0
  private hopPeak = 0
  private gateRms = 0
  private readonly message: AnalysisFrameMessage = {
    type: 'frame',
    freq: 0,
    clarity: 0,
    rms: 0,
    peak: 0,
    time: 0,
  }

  constructor() {
    super()
    this.port.onmessage = (event: MessageEvent<ProcessorCommand>) => {
      if (event.data.type === 'configure') this.configure(event.data)
    }
  }

  private configure({ config, gateRms }: Extract<ProcessorCommand, { type: 'configure' }>) {
    this.detector = new YinDetector(config)
    this.lowpass = new BiquadLowpass(config.sampleRate, config.lowpassHz)
    this.ring = new Float32Array(config.frameSize)
    this.frame = new Float32Array(config.frameSize)
    this.hopSize = config.hopSize
    this.gateRms = gateRms
    this.writeIndex = 0
    this.filled = 0
    this.sinceHop = 0
    this.hopPeak = 0
  }

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0]
    const lowpass = this.lowpass
    if (!this.detector || !lowpass || !channels || channels.length === 0) return true

    // Гитара может быть на любом входе звуковой карты: берём самый громкий канал кванта
    let channel = channels[0]!
    let channelPeak = peakOf(channel)
    for (let c = 1; c < channels.length; c++) {
      const peak = peakOf(channels[c]!)
      if (peak > channelPeak) {
        channelPeak = peak
        channel = channels[c]!
      }
    }

    // Начало ноты — по сырому сигналу: ФНЧ срезал бы щелчок медиатора
    const strength = this.onset.process(channel, currentTime)
    if (strength > 0) {
      this.onsetMessage.time = currentTime * 1000
      this.onsetMessage.strength = strength
      this.port.postMessage(this.onsetMessage)
      // Окно хромы начинается ~10 мс после атаки
      this.chromaCountdown = CHROMA_SIZE + Math.round(sampleRate * 0.01)
      this.chromaOnsetTime = currentTime * 1000
    }

    const raw = this.rawRing
    for (let i = 0; i < channel.length; i++) {
      raw[this.rawIndex] = channel[i]!
      this.rawIndex = this.rawIndex + 1 === CHROMA_SIZE ? 0 : this.rawIndex + 1
    }
    if (this.chromaCountdown >= 0) {
      this.chromaCountdown -= channel.length
      if (this.chromaCountdown < 0) this.postChroma()
    }

    const ring = this.ring
    const size = ring.length
    for (let i = 0; i < channel.length; i++) {
      ring[this.writeIndex] = lowpass.process(channel[i]!)
      this.writeIndex = this.writeIndex + 1 === size ? 0 : this.writeIndex + 1
    }
    this.filled = Math.min(size, this.filled + channel.length)
    this.sinceHop += channel.length
    if (channelPeak > this.hopPeak) this.hopPeak = channelPeak

    if (this.sinceHop >= this.hopSize && this.filled === size) {
      this.sinceHop = 0
      this.analyze()
    }
    return true
  }

  private postChroma() {
    for (let i = 0; i < CHROMA_SIZE; i++) {
      this.rawFrame[i] = this.rawRing[(this.rawIndex + i) % CHROMA_SIZE]!
    }
    const chroma = this.chroma.analyze(this.rawFrame)
    // Раз на удар — небольшая аллокация допустима
    const message: ChromaMessage = {
      type: 'chroma',
      time: this.chromaOnsetTime,
      chroma: Array.from(chroma),
    }
    this.port.postMessage(message)
  }

  private analyze() {
    const { ring, frame } = this
    const size = ring.length
    // Разворачиваем кольцо в линейный кадр: от самого старого сэмпла к новому
    let sumSquares = 0
    for (let i = 0; i < size; i++) {
      const sample = ring[(this.writeIndex + i) % size]!
      frame[i] = sample
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / size)

    const message = this.message
    if (rms >= this.gateRms) {
      const estimate = this.detector!.detect(frame)
      message.freq = estimate.freq
      message.clarity = estimate.clarity
    } else {
      message.freq = 0
      message.clarity = 0
    }
    message.rms = rms
    message.peak = this.hopPeak
    message.time = currentTime * 1000
    this.hopPeak = 0
    this.port.postMessage(message)
  }
}

function peakOf(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]!)
    if (abs > peak) peak = abs
  }
  return peak
}

registerProcessor(PITCH_PROCESSOR_NAME, PitchProcessor)

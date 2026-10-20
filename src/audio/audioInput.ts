// Аудиовход: AudioContext, getUserMedia, AudioWorklet анализа высоты.
// Без Vue — используется тюнером, живым грифом и игрой через composables.

import processorUrl from './worklets/pitch-processor.ts?worker&url'
import { getAudioContext, resumeAudioContext } from './context'
import { createAnalysisConfig } from './dsp/analysisConfig'
import {
  PITCH_PROCESSOR_NAME,
  type AnalysisFrameMessage,
  type ChromaMessage,
  type OnsetMessage,
  type ProcessorCommand,
  type ProcessorMessage,
} from './worklets/messages'

export interface InputDevice {
  id: string
  label: string
}

export interface PitchRange {
  lowestMidi: number
  highestMidi: number
  a4: number
}

export type AudioInputErrorCode = 'denied' | 'not-found' | 'unsupported' | 'unknown'

export class AudioInputError extends Error {
  constructor(
    readonly code: AudioInputErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** −60 dBFS: тише этого высоту не считаем */
const GATE_RMS = 0.001

type FrameListener = (frame: AnalysisFrameMessage) => void
type OnsetListener = (onset: OnsetMessage) => void
type ChromaListener = (chroma: ChromaMessage) => void

export class AudioInput {
  private context: AudioContext | null = null
  private workletLoaded: Promise<void> | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | null = null
  private range: PitchRange | null = null
  private readonly listeners = new Set<FrameListener>()
  private readonly onsetListeners = new Set<OnsetListener>()
  private readonly chromaListeners = new Set<ChromaListener>()
  private frameSeconds = 0

  get isRunning(): boolean {
    return this.node !== null
  }

  get sampleRate(): number | null {
    return this.context?.sampleRate ?? null
  }

  /** Метка устройства, которое реально открыто (может отличаться от запрошенного) */
  get activeDeviceId(): string | null {
    return this.stream?.getAudioTracks()[0]?.getSettings().deviceId ?? null
  }

  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof AudioWorkletNode !== 'undefined'
    )
  }

  static async listDevices(): Promise<InputDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, index) => ({ id: d.deviceId, label: d.label || `Вход ${index + 1}` }))
  }

  onFrame(listener: FrameListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Начала нот (удары по струнам) с точным временем */
  onOnset(listener: OnsetListener): () => void {
    this.onsetListeners.add(listener)
    return () => this.onsetListeners.delete(listener)
  }

  /** Хрома после каждого удара — для проверки аккордов */
  onChroma(listener: ChromaListener): () => void {
    this.chromaListeners.add(listener)
    return () => this.chromaListeners.delete(listener)
  }

  /** Длина окна детектора высоты, с — кадр высоты описывает звук за это время до frame.time */
  get frameDuration(): number {
    return this.frameSeconds
  }

  /**
   * Задержка ввода: от струны до ворклета. Браузер знает её не всегда —
   * точную поправку даст калибровка (этап 8).
   */
  get inputLatency(): number {
    const settings = this.stream?.getAudioTracks()[0]?.getSettings() as
      (MediaTrackSettings & { latency?: number }) | undefined
    const latency = settings?.latency ?? 0
    return Number.isFinite(latency) && latency > 0 && latency < 0.5 ? latency : 0
  }

  /** Запуск или переключение на другое устройство */
  async start(deviceId: string | null, range: PitchRange): Promise<void> {
    if (!AudioInput.isSupported()) {
      throw new AudioInputError('unsupported', 'Браузер не поддерживает захват звука')
    }
    this.range = range
    const context = await this.ensureContext()

    this.releaseStream()
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          // Обработка браузера портит сигнал гитары и добавляет задержку
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 },
        },
      })
    } catch (error) {
      throw toInputError(error)
    }

    this.source = context.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(context, PITCH_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    this.node.port.onmessage = (event: MessageEvent<ProcessorMessage>) => {
      const message = event.data
      if (message.type === 'onset') {
        for (const listener of this.onsetListeners) listener(message)
      } else if (message.type === 'chroma') {
        for (const listener of this.chromaListeners) listener(message)
      } else {
        for (const listener of this.listeners) listener(message)
      }
    }
    this.configure()
    this.source.connect(this.node)
    // Выход процессора — тишина; подключение к destination гарантирует, что граф обрабатывается
    this.node.connect(context.destination)
    // Если контекст остался приостановлен (нет жеста пользователя), UI попросит нажать кнопку
    await resumeAudioContext()
  }

  /** Перенастройка окна анализа под новый строй без перезапуска потока */
  setRange(range: PitchRange): void {
    this.range = range
    this.configure()
  }

  /** Возобновить AudioContext после жеста пользователя (политика автозапуска) */
  async resume(): Promise<void> {
    await resumeAudioContext()
  }

  get isSuspended(): boolean {
    return this.context?.state === 'suspended'
  }

  /** Освобождает микрофон; общий AudioContext не трогаем — в нём может играть трек */
  async stop(): Promise<void> {
    this.releaseStream()
  }

  private configure() {
    if (!this.node || !this.context || !this.range) return
    const { lowestMidi, highestMidi, a4 } = this.range
    const config = createAnalysisConfig(this.context.sampleRate, lowestMidi, highestMidi, a4)
    this.frameSeconds = config.frameSize / config.sampleRate
    const command: ProcessorCommand = { type: 'configure', config, gateRms: GATE_RMS }
    this.node.port.postMessage(command)
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = getAudioContext()
      this.workletLoaded = this.context.audioWorklet.addModule(processorUrl)
    }
    await this.workletLoaded
    return this.context
  }

  private releaseStream() {
    this.node?.port.close()
    this.node?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    this.node = null
    this.source = null
    this.stream = null
  }
}

function toInputError(error: unknown): AudioInputError {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new AudioInputError('denied', 'Доступ к звуковому входу запрещён')
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new AudioInputError('not-found', 'Устройство ввода не найдено')
  }
  return new AudioInputError('unknown', error instanceof Error ? error.message : String(error))
}

/** Один вход на всё приложение: тюнер, живой гриф и игра делят его */
export const audioInput = new AudioInput()

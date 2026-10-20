// Аудиовход: AudioContext, getUserMedia, AudioWorklet анализа высоты.
// Без Vue — используется тюнером, живым грифом и игрой через composables.

import processorUrl from './worklets/pitch-processor.ts?worker&url'
import { createAnalysisConfig } from './dsp/analysisConfig'
import {
  PITCH_PROCESSOR_NAME,
  type AnalysisFrameMessage,
  type ProcessorCommand,
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
const RESUME_WAIT_MS = 300

type FrameListener = (frame: AnalysisFrameMessage) => void

export class AudioInput {
  private context: AudioContext | null = null
  private workletLoaded: Promise<void> | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | null = null
  private range: PitchRange | null = null
  private readonly listeners = new Set<FrameListener>()

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
    this.node.port.onmessage = (event: MessageEvent<AnalysisFrameMessage>) => {
      for (const listener of this.listeners) listener(event.data)
    }
    this.configure()
    this.source.connect(this.node)
    // Выход процессора — тишина; подключение к destination гарантирует, что граф обрабатывается
    this.node.connect(context.destination)
    // Без жеста пользователя resume() может не завершиться никогда (политика автозапуска).
    // Ждём недолго: если контекст остался приостановлен, UI попросит нажать кнопку.
    await Promise.race([context.resume(), delay(RESUME_WAIT_MS)])
  }

  /** Перенастройка окна анализа под новый строй без перезапуска потока */
  setRange(range: PitchRange): void {
    this.range = range
    this.configure()
  }

  /** Возобновить AudioContext после жеста пользователя (политика автозапуска) */
  async resume(): Promise<void> {
    await this.context?.resume()
  }

  get isSuspended(): boolean {
    return this.context?.state === 'suspended'
  }

  async stop(): Promise<void> {
    this.releaseStream()
    await this.context?.suspend()
  }

  private configure() {
    if (!this.node || !this.context || !this.range) return
    const { lowestMidi, highestMidi, a4 } = this.range
    const command: ProcessorCommand = {
      type: 'configure',
      config: createAnalysisConfig(this.context.sampleRate, lowestMidi, highestMidi, a4),
      gateRms: GATE_RMS,
    }
    this.node.port.postMessage(command)
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' })
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

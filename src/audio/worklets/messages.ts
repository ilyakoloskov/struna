import type { AnalysisConfig } from '../dsp/analysisConfig'

// Протокол обмена между основным потоком и pitch-processor

export interface ConfigureCommand {
  type: 'configure'
  config: AnalysisConfig
  /** Ниже этого RMS детектор не запускается — экономим CPU на тишине */
  gateRms: number
}

export type ProcessorCommand = ConfigureCommand

export interface AnalysisFrameMessage {
  type: 'frame'
  /** Частота в Гц, 0 — не найдена или тишина */
  freq: number
  clarity: number
  rms: number
  /** Пиковая амплитуда за шаг анализа */
  peak: number
  /** Время конца кадра по часам AudioContext, мс */
  time: number
}

export interface OnsetMessage {
  type: 'onset'
  /** Начало блока с атакой по часам AudioContext, мс */
  time: number
  strength: number
}

export interface ChromaMessage {
  type: 'chroma'
  /** Время удара, после которого посчитана хрома, мс */
  time: number
  /** Энергия 12 нот (C…B), максимум = 1 */
  chroma: number[]
}

export type ProcessorMessage = AnalysisFrameMessage | OnsetMessage | ChromaMessage

export const PITCH_PROCESSOR_NAME = 'pitch-processor'

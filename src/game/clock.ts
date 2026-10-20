// Время трека для отрисовки.
// Транспорт считает по часам AudioContext — это момент, когда звук уходит в звуковую карту.
// До ушей он доходит позже на задержку вывода, поэтому ноту рисуем по «слышимому» времени.

export interface GameClock {
  /** Время трека, с, как его слышит игрок */
  now(): number
}

export function heardTime(transportPosition: number, outputLatency: number): number {
  return transportPosition - outputLatency
}

/** Задержка вывода звука: outputLatency, если браузер её знает, иначе baseLatency */
export function outputLatencyOf(context: AudioContext): number {
  const latency = context.outputLatency || context.baseLatency || 0
  return Number.isFinite(latency) && latency > 0 && latency < 0.5 ? latency : 0
}

/** Часы тестового режима без звука: по performance.now(), с паузой */
export class FreeClock implements GameClock {
  private startedAt = 0
  private pausedAt = 0
  private running = false

  constructor(private readonly loop = 0) {}

  start(): void {
    if (this.running) return
    this.startedAt = performance.now() / 1000 - this.pausedAt
    this.running = true
  }

  pause(): void {
    if (!this.running) return
    this.pausedAt = this.now()
    this.running = false
  }

  get isRunning(): boolean {
    return this.running
  }

  now(): number {
    const t = this.running ? performance.now() / 1000 - this.startedAt : this.pausedAt
    return this.loop > 0 ? t % this.loop : t
  }
}

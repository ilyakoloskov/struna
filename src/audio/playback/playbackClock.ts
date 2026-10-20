// Соответствие времени трека и часов AudioContext с учётом темпа и петли.
// Темп r: секунда трека длится 1/r секунды реального времени (MIDI играется сэмплами нота за нотой,
// поэтому замедление — просто растяжение времени, высота не меняется).
// Петля: переход на новый проход планируется заранее (чтобы успеть поставить ноты в очередь),
// но позиция переключается ровно в момент границы — иначе дорожка прыгнула бы раньше звука.

interface PendingWrap {
  /** Момент перехода по часам AudioContext */
  at: number
  origin: number
}

export class PlaybackClock {
  /** Время AudioContext, соответствующее нулю трека (в текущем проходе) */
  private origin = 0
  private pending: PendingWrap | null = null
  /** Последний совершённый переход — для событий, пришедших с опозданием (удары игрока) */
  private lastWrap: { at: number; previousOrigin: number } | null = null
  /** Номер прохода петли, начиная с 0 */
  pass = 0

  constructor(public rate = 1) {}

  /** Начать с позиции трека songTime в момент ctxTime */
  start(ctxTime: number, songTime: number): void {
    this.origin = ctxTime - songTime / this.rate
    this.pending = null
    this.lastWrap = null
  }

  /**
   * Время трека для момента ctxTime без побочных эффектов — для событий из прошлого:
   * удар, сыгранный до перехода петли, относится к прошлому проходу, даже если обработан после.
   */
  songTimeAt(ctxTime: number): number {
    if (this.pending && ctxTime >= this.pending.at)
      return (ctxTime - this.pending.origin) * this.rate
    if (this.lastWrap && ctxTime < this.lastWrap.at) {
      return (ctxTime - this.lastWrap.previousOrigin) * this.rate
    }
    return (ctxTime - this.origin) * this.rate
  }

  /** Время трека в момент ctxTime (с переходом на новый проход, если граница пройдена) */
  songTime(ctxTime: number): number {
    this.applyPending(ctxTime)
    return (ctxTime - this.origin) * this.rate
  }

  /** Момент по часам AudioContext для времени трека — в проходе, где сейчас планируются ноты */
  contextTime(songTime: number): number {
    const origin = this.pending ? this.pending.origin : this.origin
    return origin + songTime / this.rate
  }

  /**
   * Запланировать переход: когда трек дойдёт до from, продолжить с to.
   * Возвращает момент перехода по часам AudioContext.
   */
  scheduleWrap(from: number, to: number): number {
    const at = this.origin + from / this.rate
    this.pending = { at, origin: at - to / this.rate }
    return at
  }

  get hasPendingWrap(): boolean {
    return this.pending !== null
  }

  private applyPending(ctxTime: number) {
    if (this.pending && ctxTime >= this.pending.at) {
      this.lastWrap = { at: this.pending.at, previousOrigin: this.origin }
      this.origin = this.pending.origin
      this.pending = null
      this.pass++
    }
  }
}

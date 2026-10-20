// Щипок струны по алгоритму Karplus–Strong: шумовой импульс в линии задержки,
// которую на каждом проходе усредняет и чуть затухает фильтр — получается звук струны.
//
// Длина линии — целое число сэмплов, поэтому точную высоту добираем скоростью
// воспроизведения: иначе на высоких нотах ошибка округления доходит до ~20 центов.

export interface PluckOptions {
  sampleRate: number
  durationSec?: number
  /** Затухание за проход 0…1: ближе к 1 — дольше звучит */
  decay?: number
  /** Яркость атаки 0…1: меньше — мягче, как щипок пальцем */
  brightness?: number
  random?: () => number
}

export interface PluckSound {
  samples: Float32Array<ArrayBuffer>
  /** Множитель скорости воспроизведения для точной высоты */
  playbackRate: number
}

const FADE_OUT_SEC = 0.05

export function pluck(freq: number, options: PluckOptions): PluckSound {
  const {
    sampleRate,
    durationSec = 1.6,
    decay = 0.996,
    brightness = 0.6,
    random = Math.random,
  } = options
  const period = Math.max(2, Math.floor(sampleRate / freq))
  const length = Math.round(sampleRate * durationSec)
  const samples = new Float32Array(length)

  // Начальный импульс: шум, сглаженный однополюсным ФНЧ (чем меньше яркость, тем мягче)
  let previous = 0
  for (let i = 0; i < period && i < length; i++) {
    const noise = random() * 2 - 1
    previous = brightness * noise + (1 - brightness) * previous
    samples[i] = previous
  }

  // y[n] = decay · (y[n−N] + y[n−N−1]) / 2
  for (let i = period; i < length; i++) {
    const older = i - period - 1 >= 0 ? samples[i - period - 1]! : 0
    samples[i] = decay * 0.5 * (samples[i - period]! + older)
  }

  // Нормализация и короткое затухание в конце, чтобы не было щелчка
  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(samples[i]!))
  const gain = peak > 0 ? 0.5 / peak : 0
  const fade = Math.round(sampleRate * FADE_OUT_SEC)
  for (let i = 0; i < length; i++) {
    const tail = length - i
    samples[i] = samples[i]! * gain * (tail < fade ? tail / fade : 1)
  }

  // Усреднение соседних сэмплов добавляет полсэмпла задержки — учитываем в периоде
  const effectivePeriod = period + 0.5
  return { samples, playbackRate: (freq * effectivePeriod) / sampleRate }
}

import { CacheStorage, DrumMachine, Soundfont, type Storage } from 'smplr'
import type { NoteEvent, TrackInstrument } from '@/domain/tracks/types'
import { DRUM_KIT, drumGroup, soundfontName } from './gmMapping'

// Голоса дорожек на сэмплах smplr: мелодические — General MIDI soundfont, ударные — LinnDrum.
// Сэмплы качаются с CDN при первом использовании и кэшируются (Cache API) — повторно не скачиваются.

export interface Voice {
  ready: Promise<void>
  /** Сыграть ноту в момент when по часам AudioContext, длительностью duration реальных секунд */
  play(note: NoteEvent, when: number, duration: number): void
  /** Оборвать все звучащие ноты */
  stopAll(): void
  dispose(): void
}

export interface LoadProgress {
  loaded: number
  total: number
}

let storage: Storage | undefined
function sampleStorage(): Storage | undefined {
  // Cache API доступен только в безопасном контексте (https, localhost)
  if (!storage && typeof window !== 'undefined' && window.isSecureContext && 'caches' in window) {
    storage = CacheStorage('struna-samples')
  }
  return storage
}

const toVelocity = (v: number) => Math.max(1, Math.min(127, Math.round(v * 127)))

export function createVoice(
  context: AudioContext,
  instrument: TrackInstrument,
  destination: AudioNode,
  onProgress: (progress: LoadProgress) => void,
): Voice {
  if (instrument.percussion) {
    const drums = DrumMachine(context, {
      instrument: DRUM_KIT,
      storage: sampleStorage(),
      destination,
      onLoadProgress: onProgress,
    })
    return {
      ready: drums.ready,
      play(note, when) {
        const group = drumGroup(note.midi)
        if (group) drums.start({ note: group, velocity: toVelocity(note.velocity), time: when })
      },
      stopAll: () => drums.stop(),
      dispose: () => drums.dispose(),
    }
  }

  const soundfont = Soundfont(context, {
    instrument: soundfontName(instrument),
    storage: sampleStorage(),
    destination,
    onLoadProgress: onProgress,
  })
  return {
    ready: soundfont.ready,
    play(note, when, duration) {
      soundfont.start({
        note: note.midi,
        velocity: toVelocity(note.velocity),
        time: when,
        duration,
      })
    },
    stopAll: () => soundfont.stop(),
    dispose: () => soundfont.dispose(),
  }
}

/** Щелчок метронома: короткий синус, сильная доля — выше и громче */
export function scheduleClick(
  context: AudioContext,
  when: number,
  accent: boolean,
  destination: AudioNode,
): void {
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.frequency.value = accent ? 1600 : 1000
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
  osc.connect(gain).connect(destination)
  osc.start(when)
  osc.stop(when + 0.07)
}

import { Midi } from '@tonejs/midi'
import { decodeMidiText } from './midiText'
import type { Beat, Song, SongTrack } from './types'

// Импорт MIDI через @tonejs/midi: разбор файла и карта темпов (перевод тиков в секунды).
// На выходе — наша модель Song, остальной код про MIDI не знает.

const DEFAULT_BPM = 120

export class MidiImportError extends Error {}

export function parseMidi(data: ArrayBuffer | Uint8Array, fileName = ''): Song {
  let midi: Midi
  try {
    midi = new Midi(data)
  } catch {
    throw new MidiImportError('Файл не похож на MIDI или повреждён')
  }

  const tracks: SongTrack[] = midi.tracks
    .map((track, index) => ({
      index,
      name: decodeMidiText(track.name).trim() || capitalize(track.instrument.name),
      instrument: {
        program: track.instrument.number,
        name: track.instrument.name,
        family: track.instrument.family,
        percussion: track.instrument.percussion,
      },
      notes: track.notes
        .map((n) => ({ midi: n.midi, time: n.time, duration: n.duration, velocity: n.velocity }))
        .sort((a, b) => a.time - b.time || a.midi - b.midi),
    }))
    .filter((track) => track.notes.length > 0)

  if (tracks.length === 0) throw new MidiImportError('В файле нет нот')

  const signature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4]
  return {
    name: decodeMidiText(midi.name).trim() || fileName.replace(/\.midi?$/i, '') || 'Без названия',
    duration: midi.duration,
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? DEFAULT_BPM),
    timeSignature: [signature[0] ?? 4, signature[1] ?? 4],
    beats: buildBeats(midi),
    tracks,
  }
}

/** Сетка долей до конца последней ноты, с учётом смен размера; время — по карте темпов */
function buildBeats(midi: Midi): Beat[] {
  const { header } = midi
  const endTicks = Math.max(
    0,
    ...midi.tracks.flatMap((t) => t.notes.map((n) => n.ticks + n.durationTicks)),
  )
  const signatures = [...header.timeSignatures].sort((a, b) => a.ticks - b.ticks)
  if (signatures.length === 0 || signatures[0]!.ticks > 0) {
    signatures.unshift({ ticks: 0, timeSignature: [4, 4] })
  }

  const beats: Beat[] = []
  signatures.forEach((sig, i) => {
    const [numerator = 4, denominator = 4] = sig.timeSignature
    const beatTicks = (header.ppq * 4) / denominator
    const segmentEnd = signatures[i + 1]?.ticks ?? endTicks
    for (let t = sig.ticks, k = 0; t < segmentEnd; t += beatTicks, k++) {
      beats.push({ time: header.ticksToSeconds(t), downbeat: k % numerator === 0 })
    }
  })
  return beats
}

const GUITAR_NAME = /guit|gtr|гитар/i

/**
 * Угадываем гитарную партию: инструмент из семейства гитар (GM 24–31) или «guitar» в названии,
 * при равенстве — дорожка с бóльшим числом нот. Если гитары нет — самая «нотная» мелодическая дорожка.
 */
export function guessGuitarTrack(song: Song): number | null {
  const scored = song.tracks
    .filter((t) => !t.instrument.percussion)
    .map((t) => ({
      index: t.index,
      score:
        (t.instrument.family === 'guitar' ? 10 : 0) +
        (GUITAR_NAME.test(t.name) ? 5 : 0) -
        (t.instrument.family === 'bass' ? 5 : 0),
      notes: t.notes.length,
    }))
    .sort((a, b) => b.score - a.score || b.notes - a.notes)
  return scored[0]?.index ?? null
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

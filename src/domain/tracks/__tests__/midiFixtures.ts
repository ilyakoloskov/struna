import { Midi } from '@tonejs/midi'

export interface FixtureTrack {
  name?: string
  program?: number
  channel?: number
  /** [midi, начало в долях, длительность в долях] */
  notes: [number, number, number][]
}

/** Собирает MIDI-файл в памяти: темп, размер и дорожки */
export function buildMidi(options: {
  bpm?: number
  timeSignature?: [number, number]
  extraTempo?: { beat: number; bpm: number }
  tracks: FixtureTrack[]
  name?: string
}): Uint8Array {
  const midi = new Midi()
  const ppq = midi.header.ppq
  midi.header.setTempo(options.bpm ?? 120)
  if (options.extraTempo) {
    midi.header.tempos.push({ ticks: options.extraTempo.beat * ppq, bpm: options.extraTempo.bpm })
  }
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: options.timeSignature ?? [4, 4] })
  midi.header.update()
  if (options.name) midi.name = options.name

  for (const fixture of options.tracks) {
    const track = midi.addTrack()
    if (fixture.name) track.name = fixture.name
    track.channel = fixture.channel ?? 0
    track.instrument.number = fixture.program ?? 0
    for (const [note, beat, length] of fixture.notes) {
      track.addNote({ midi: note, ticks: beat * ppq, durationTicks: length * ppq, velocity: 0.8 })
    }
  }
  return midi.toArray()
}

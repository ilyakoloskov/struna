import { describe, expect, it } from 'vitest'
import { MidiImportError, guessGuitarTrack, parseMidi } from '../midiImport'
import { buildMidi } from './midiFixtures'

const guitar = {
  name: 'Lead',
  program: 30,
  notes: [
    [40, 0, 1],
    [43, 1, 1],
    [45, 2, 2],
  ] as [number, number, number][],
}
const bass = { name: 'Bass', program: 33, notes: [[28, 0, 4]] as [number, number, number][] }
const drums = {
  name: 'Drums',
  channel: 9,
  notes: [
    [36, 0, 0.5],
    [38, 1, 0.5],
  ] as [number, number, number][],
}

describe('parseMidi', () => {
  it('ноты, время в секундах, инструменты', () => {
    const song = parseMidi(buildMidi({ bpm: 120, tracks: [guitar, bass] }), 'riff.mid')
    expect(song.name).toBe('riff')
    expect(song.bpm).toBe(120)
    expect(song.tracks).toHaveLength(2)
    const lead = song.tracks[0]!
    expect(lead.instrument.family).toBe('guitar')
    expect(lead.instrument.name).toBe('distortion guitar')
    expect(lead.notes.map((n) => n.midi)).toEqual([40, 43, 45])
    // 120 bpm: доля = 0.5 с
    expect(lead.notes.map((n) => n.time)).toEqual([0, 0.5, 1])
    expect(lead.notes[2]!.duration).toBeCloseTo(1)
    expect(song.duration).toBeCloseTo(2)
  })

  it('ударные распознаются по 10-му каналу', () => {
    const song = parseMidi(buildMidi({ tracks: [guitar, drums] }))
    expect(song.tracks.find((t) => t.name === 'Drums')!.instrument.percussion).toBe(true)
  })

  it('название из файла, иначе из имени файла', () => {
    expect(parseMidi(buildMidi({ name: 'Song A', tracks: [guitar] }), 'x.mid').name).toBe('Song A')
    expect(parseMidi(buildMidi({ tracks: [guitar] }), 'my-track.MIDI').name).toBe('my-track')
  })

  it('пустые дорожки отбрасываются, индекс сохраняется', () => {
    const song = parseMidi(buildMidi({ tracks: [{ notes: [] }, guitar] }))
    expect(song.tracks).toHaveLength(1)
    expect(song.tracks[0]!.index).toBe(1)
  })

  it('учитывает смену темпа', () => {
    const song = parseMidi(
      buildMidi({
        bpm: 120,
        extraTempo: { beat: 2, bpm: 60 },
        tracks: [
          {
            program: 30,
            notes: [
              [40, 0, 1],
              [40, 2, 1],
              [40, 3, 1],
            ],
          },
        ],
      }),
    )
    // две доли по 0.5 с, затем доли по 1 с
    expect(song.tracks[0]!.notes.map((n) => n.time)).toEqual([0, 1, 2])
  })

  it('сетка долей: сильные доли по размеру', () => {
    const song = parseMidi(
      buildMidi({ timeSignature: [3, 4], tracks: [{ program: 30, notes: [[40, 0, 6]] }] }),
    )
    expect(song.timeSignature).toEqual([3, 4])
    expect(song.beats).toHaveLength(6)
    expect(song.beats.map((b) => b.downbeat)).toEqual([true, false, false, true, false, false])
    expect(song.beats[1]!.time).toBeCloseTo(0.5)
  })

  it('мусор и пустые файлы — понятная ошибка', () => {
    expect(() => parseMidi(new Uint8Array([1, 2, 3]))).toThrow(MidiImportError)
    expect(() => parseMidi(buildMidi({ tracks: [{ notes: [] }] }))).toThrow('В файле нет нот')
  })
})

describe('guessGuitarTrack', () => {
  it('выбирает гитару, а не бас и не ударные', () => {
    const song = parseMidi(buildMidi({ tracks: [drums, bass, guitar] }))
    expect(guessGuitarTrack(song)).toBe(2)
  })

  it('из двух гитар — с бóльшим числом нот', () => {
    const rhythm = {
      name: 'Rhythm',
      program: 29,
      notes: [[40, 0, 1]] as [number, number, number][],
    }
    const song = parseMidi(buildMidi({ tracks: [rhythm, guitar] }))
    expect(guessGuitarTrack(song)).toBe(1)
  })

  it('по названию, если программа не гитарная', () => {
    const named = { name: 'Gtr 1', program: 0, notes: [[52, 0, 1]] as [number, number, number][] }
    const piano = {
      name: 'Piano',
      program: 0,
      notes: [
        [60, 0, 1],
        [62, 1, 1],
      ] as [number, number, number][],
    }
    expect(guessGuitarTrack(parseMidi(buildMidi({ tracks: [piano, named] })))).toBe(1)
  })

  it('без гитары — мелодическая дорожка, только ударные — null', () => {
    const piano = { name: 'Piano', program: 0, notes: [[60, 0, 1]] as [number, number, number][] }
    expect(guessGuitarTrack(parseMidi(buildMidi({ tracks: [drums, piano] })))).toBe(1)
    expect(guessGuitarTrack(parseMidi(buildMidi({ tracks: [drums] })))).toBeNull()
  })
})

describe('демо-трек', () => {
  it('гитара, бас и ударные; гитара угадывается', async () => {
    const { createDemoSong } = await import('../demoSong')
    const song = createDemoSong()
    expect(song.tracks.map((t) => t.instrument.family)).toEqual(['guitar', 'bass', 'drums'])
    expect(guessGuitarTrack(song)).toBe(0)
    expect(song.beats).toHaveLength(32)
    const last = Math.max(...song.tracks.flatMap((t) => t.notes.map((n) => n.time + n.duration)))
    expect(last).toBeLessThanOrEqual(song.duration)
  })
})

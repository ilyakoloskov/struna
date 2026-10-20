import type { Beat, NoteEvent, Song } from './types'

// Демо-трек для проверки без своих файлов: оригинальный рифф в ми миноре,
// бас по корням и простой рок-бит. 100 bpm, 4/4, 8 тактов.

const BPM = 100
const BEAT = 60 / BPM
const BARS = 8

const n = (midi: number, beat: number, length: number, velocity = 0.85): NoteEvent => ({
  midi,
  time: beat * BEAT,
  duration: length * BEAT * 0.95,
  velocity,
})

/** Рифф на 2 такта: восьмые по низам с выходом на пентатонику */
function guitarRiff(startBeat: number): NoteEvent[] {
  const E2 = 40
  const pattern: [number, number, number][] = [
    [E2, 0, 0.5],
    [E2, 0.5, 0.5],
    [43, 1, 0.5],
    [E2, 1.5, 0.5],
    [45, 2, 0.5],
    [E2, 2.5, 0.5],
    [46, 3, 0.5],
    [45, 3.5, 0.5],
    [E2, 4, 0.5],
    [E2, 4.5, 0.5],
    [43, 5, 0.5],
    [E2, 5.5, 0.5],
    [50, 6, 0.5],
    [52, 6.5, 0.5],
    [55, 7, 1],
  ]
  return pattern.map(([midi, beat, length]) => n(midi, startBeat + beat, length))
}

/** Аккордовая концовка: квинтаккорды E5 — G5 — A5 — B5 */
function powerChords(startBeat: number): NoteEvent[] {
  const roots = [40, 43, 45, 47]
  return roots.flatMap((root, i) => [
    n(root, startBeat + i * 2, 2),
    n(root + 7, startBeat + i * 2, 2),
    n(root + 12, startBeat + i * 2, 2),
  ])
}

function bassLine(): NoteEvent[] {
  const roots = [28, 28, 28, 28, 28, 28, 31, 33, 35, 35]
  const notes: NoteEvent[] = []
  for (let bar = 0; bar < BARS; bar++) {
    const root = bar < 6 ? 28 : roots[bar + 2]!
    for (let beat = 0; beat < 4; beat++) notes.push(n(root, bar * 4 + beat, 0.9, 0.8))
  }
  return notes
}

function drumBeat(): NoteEvent[] {
  const notes: NoteEvent[] = []
  for (let bar = 0; bar < BARS; bar++) {
    const b = bar * 4
    if (bar === 0) notes.push(n(49, b, 1, 0.9))
    for (let eighth = 0; eighth < 8; eighth++) notes.push(n(42, b + eighth / 2, 0.25, 0.6))
    notes.push(n(36, b, 0.5), n(36, b + 2, 0.5), n(36, b + 2.5, 0.5))
    notes.push(n(38, b + 1, 0.5), n(38, b + 3, 0.5))
  }
  return notes.sort((a, b) => a.time - b.time)
}

function beats(): Beat[] {
  return Array.from({ length: BARS * 4 }, (_, i) => ({ time: i * BEAT, downbeat: i % 4 === 0 }))
}

export function createDemoSong(): Song {
  const guitar = [...guitarRiff(0), ...guitarRiff(8), ...guitarRiff(16), ...powerChords(24)]
  return {
    name: 'Демо: рифф в ми миноре',
    duration: BARS * 4 * BEAT,
    bpm: BPM,
    timeSignature: [4, 4],
    beats: beats(),
    tracks: [
      {
        index: 0,
        name: 'Гитара',
        instrument: { program: 29, name: 'overdriven guitar', family: 'guitar', percussion: false },
        notes: guitar,
      },
      {
        index: 1,
        name: 'Бас',
        instrument: {
          program: 33,
          name: 'electric bass (finger)',
          family: 'bass',
          percussion: false,
        },
        notes: bassLine(),
      },
      {
        index: 2,
        name: 'Барабаны',
        instrument: { program: 0, name: 'standard kit', family: 'drums', percussion: true },
        notes: drumBeat(),
      },
    ],
  }
}

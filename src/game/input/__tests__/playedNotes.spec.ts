import { describe, expect, it } from 'vitest'
import { PlayedNoteDetector, type PitchSample, type PlayedNote } from '../playedNotes'
import { midiToFreq } from '@/domain/music/pitch'

const FRAME = 0.043
const HOP = 0.0107

/** Кадры высоты каждые HOP секунд; midiAt(t) — что звучит в окне, заканчивающемся в t */
function frames(from: number, to: number, midiAt: (t: number) => number | null): PitchSample[] {
  const result: PitchSample[] = []
  for (let t = from; t <= to; t += HOP) {
    const midi = midiAt(t)
    result.push(
      midi === null
        ? { time: t, freq: 0, clarity: 0, rms: 0 }
        : { time: t, freq: midiToFreq(midi), clarity: 0.95, rms: 0.05 },
    )
  }
  return result
}

function run(events: ({ onset: number } | PitchSample)[]): PlayedNote[] {
  const out: PlayedNote[] = []
  const detector = new PlayedNoteDetector({ frameDuration: FRAME }, (n) => out.push(n))
  for (const e of [...events].sort(
    (a, b) => ('onset' in a ? a.onset : a.time) - ('onset' in b ? b.onset : b.time),
  )) {
    if ('onset' in e) detector.onOnset(e.onset)
    else detector.onFrame(e)
  }
  return out
}

describe('PlayedNoteDetector', () => {
  it('нота: время удара, высота из кадров после атаки', () => {
    // До удара в окне ещё предыдущая нота — её кадры не должны попасть в высоту
    const notes = run([...frames(0, 1, (t) => (t - FRAME < 0.5 ? 45 : 40.1)), { onset: 0.5 }])
    expect(notes).toHaveLength(1)
    expect(notes[0]!.time).toBe(0.5)
    expect(notes[0]!.midi).toBeCloseTo(40.1, 1)
    expect(notes[0]!.source).toBe('onset')
  })

  it('несколько ударов подряд', () => {
    const notes = run([
      { onset: 0.2 },
      { onset: 0.6 },
      ...frames(0.2, 1.1, (t) => (t - FRAME < 0.6 ? 40 : 43)),
    ])
    expect(notes.map((n) => Math.round(n.midi))).toEqual([40, 43])
    expect(notes.map((n) => n.time)).toEqual([0.2, 0.6])
  })

  it('удар без устойчивой высоты (глухая нота) — нота без высоты', () => {
    const notes = run([{ onset: 0.3 }, ...frames(0.3, 0.8, () => null)])
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ time: 0.3, source: 'onset' })
    expect(notes[0]!.midi).toBeNaN()
  })

  it('легато: смена высоты без удара — новая нота', () => {
    const notes = run([{ onset: 0.1 }, ...frames(0.1, 1.2, (t) => (t < 0.7 ? 40 : 42))])
    expect(notes.map((n) => [Math.round(n.midi), n.source])).toEqual([
      [40, 'onset'],
      [42, 'legato'],
    ])
    expect(Math.abs(notes[1]!.time - 0.7)).toBeLessThan(FRAME)
  })

  it('дрожание высоты в пределах полутона — не легато', () => {
    const notes = run([{ onset: 0.1 }, ...frames(0.1, 1.2, (t) => 40 + 0.3 * Math.sin(t * 40))])
    expect(notes).toHaveLength(1)
  })

  it('после тишины смена высоты без удара не считается легато', () => {
    const notes = run([
      { onset: 0.1 },
      ...frames(0.1, 1.5, (t) => (t < 0.6 ? 40 : t < 0.9 ? null : 47)),
    ])
    expect(notes).toHaveLength(1)
  })
})

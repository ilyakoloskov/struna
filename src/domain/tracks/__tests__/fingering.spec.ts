import { describe, expect, it } from 'vitest'
import { assignFingering, countUnplayable, groupChords } from '../fingering'
import type { FrettedNote, NoteEvent } from '../types'
import { findPreset } from '@/domain/music/tunings'
import { seededRandom } from '@/audio/dsp/__tests__/signals'

const six = findPreset('6-standard-e')!
const seven = findPreset('7-standard-b')!

/** Мелодия: по ноте каждые 0.25 с */
function melody(midis: number[], step = 0.25): NoteEvent[] {
  return midis.map((midi, i) => ({ midi, time: i * step, duration: step, velocity: 0.8 }))
}

function chord(midis: number[], time = 0): NoteEvent[] {
  return midis.map((midi) => ({ midi, time, duration: 1, velocity: 0.8 }))
}

/** «струна:лад», струны с 1 = самая высокая, как пишут гитаристы */
const tab = (notes: FrettedNote[], tuning = six) =>
  notes.map((n) => (n.stringIndex < 0 ? 'x' : `${tuning.strings.length - n.stringIndex}:${n.fret}`))

describe('assignFingering', () => {
  it('открытая струна для самой низкой ноты', () => {
    expect(tab(assignFingering(melody([40]), six))).toEqual(['6:0'])
    expect(tab(assignFingering(melody([35]), seven), seven)).toEqual(['7:0'])
  })

  it('гамма до мажор в первой позиции', () => {
    const result = assignFingering(melody([48, 50, 52, 53, 55, 57, 59, 60]), six)
    expect(result.every((n) => n.fret <= 3)).toBe(true)
    expect(tab(result)).toEqual(['5:3', '4:0', '4:2', '4:3', '3:0', '3:2', '2:0', '2:1'])
  })

  it('открытый аккорд E мажор', () => {
    const result = assignFingering(chord([40, 47, 52, 56, 59, 64]), six)
    expect(tab(result)).toEqual(['6:0', '5:2', '4:2', '3:1', '2:0', '1:0'])
  })

  it('ноты аккорда — на разных струнах, без перекрёста', () => {
    const result = assignFingering(chord([45, 52, 57, 61]), six) // A мажор
    const strings = result.map((n) => n.stringIndex)
    expect(new Set(strings).size).toBe(4)
    expect([...strings].sort((a, b) => a - b)).toEqual(strings)
  })

  it('мелодия у 12-го лада остаётся в одной позиции', () => {
    // E минорная пентатоника от 12-го лада: E4 G4 A4 B4 D5 E5 и обратно
    const result = assignFingering(melody([64, 67, 69, 71, 74, 76, 74, 71, 69, 67, 64]), six)
    const fretted = result.filter((n) => n.fret > 0).map((n) => n.fret)
    expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(4)
  })

  it('повторяющийся рифф не прыгает по грифу', () => {
    const riff = [40, 43, 45, 40, 43, 46, 45, 40, 43, 45, 43, 40]
    const result = assignFingering(melody([...riff, ...riff]), six)
    const first = tab(result.slice(0, riff.length))
    const second = tab(result.slice(riff.length))
    expect(second).toEqual(first)
    expect(result.every((n) => n.fret <= 6)).toBe(true)
  })

  it('ноты вне строя помечаются неиграбельными', () => {
    const result = assignFingering(melody([35, 40, 89]), six) // B1 ниже E2, A6 выше 24-го лада
    expect(tab(result)).toEqual(['x', '6:0', 'x'])
    expect(countUnplayable(result)).toBe(2)
  })

  it('в 7-струнном строе низкая B играбельна', () => {
    expect(countUnplayable(assignFingering(melody([35, 37, 38]), seven))).toBe(0)
  })

  it('аккорд из 7 разных нот на 6 струнах — одна неиграбельна', () => {
    const result = assignFingering(chord([40, 45, 50, 55, 59, 64, 67]), six)
    expect(countUnplayable(result)).toBe(1)
  })

  it('унисон в аккорде получает одну позицию', () => {
    const result = assignFingering(chord([52, 52, 59]), six)
    expect(countUnplayable(result)).toBe(0)
    expect(result[0]!.stringIndex).toBe(result[1]!.stringIndex)
  })

  it('порядок нот на выходе — по времени', () => {
    const notes = [...melody([64]).map((n) => ({ ...n, time: 1 })), ...melody([40])]
    expect(assignFingering(notes, six).map((n) => n.time)).toEqual([0, 1])
  })

  it('3000 случайных нот обрабатываются быстро', () => {
    const random = seededRandom(7)
    const notes = Array.from({ length: 3000 }, (_, i) => ({
      midi: 40 + Math.floor(random() * 36),
      time: i * 0.15,
      duration: 0.15,
      velocity: 0.8,
    }))
    const start = performance.now()
    const result = assignFingering(notes, six)
    expect(performance.now() - start).toBeLessThan(1500)
    expect(countUnplayable(result)).toBe(0)
  })
})

describe('groupChords', () => {
  it('объединяет почти одновременные ноты', () => {
    const notes = [
      { midi: 52, time: 0, duration: 1, velocity: 1 },
      { midi: 40, time: 0.01, duration: 1, velocity: 1 },
      { midi: 45, time: 0.5, duration: 1, velocity: 1 },
    ]
    const groups = groupChords(notes, 0.03)
    expect(groups.map((g) => g.map((n) => n.midi))).toEqual([[40, 52], [45]])
  })
})

describe('chartNotesFor', () => {
  const track = {
    index: 0,
    name: 'G',
    instrument: { program: 29, name: 'overdriven guitar', family: 'guitar', percussion: false },
    notes: melody([45, 50]),
    // В файле A2 сыграна на 6-й струне 5-м ладу, D3 — на 5-й 5-м
    positions: [
      { stringIndex: 0, fret: 5 },
      { stringIndex: 1, fret: 5 },
    ],
    tuning: [40, 45, 50, 55, 59, 64],
  }

  it('строй совпадает — позиции из файла как есть', async () => {
    const { chartNotesFor } = await import('../fingering')
    expect(tab(chartNotesFor(track, six))).toEqual(['6:5', '5:5'])
  })

  it('строй другой — расстановка под выбранный', async () => {
    const { chartNotesFor } = await import('../fingering')
    // В 7-струнном стандарте A2 — открытая 5-я
    expect(tab(chartNotesFor(track, seven), seven)).toEqual(['5:0', '4:0'])
  })

  it('приёмы: из файла — все; при своей расстановке — только не привязанные к ладам', async () => {
    const { chartNotesFor } = await import('../fingering')
    const withTechniques = {
      ...track,
      techniques: [{ harmonic: 'natural' as const, vibrato: true }, { slideIn: 'below' as const }],
    }
    expect(chartNotesFor(withTechniques, six).map((n) => n.technique)).toEqual([
      { harmonic: 'natural', vibrato: true },
      { slideIn: 'below' },
    ])
    expect(chartNotesFor(withTechniques, seven).map((n) => n.technique)).toEqual([
      { vibrato: true },
      undefined,
    ])
  })
})

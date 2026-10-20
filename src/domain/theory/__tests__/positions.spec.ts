import { describe, expect, it } from 'vitest'
import { boxPositions, cagedPositions, positionRun, supportsCaged, type Cell } from '../positions'
import { buildScale, findScale } from '../scales'
import { findPreset } from '@/domain/music/tunings'
import { formatNote } from '@/domain/music/pitch'
import { n } from './helpers'

const six = findPreset('6-standard-e')!
const seven = findPreset('7-standard-b')!
const scale = (tonic: string, id: string) => buildScale(n(tonic), findScale(id)!)

/** Лады по струнам сверху вниз, как в табулатуре: «1:5-8 2:5-8 …» */
function frets(cells: readonly Cell[], strings = 6): string {
  const lines: string[] = []
  for (let s = strings - 1; s >= 0; s--) {
    const f = cells.filter((c) => c.stringIndex === s).map((c) => c.fret)
    lines.push(`${strings - s}:${f.join('-')}`)
  }
  return lines.join(' ')
}

describe('боксы', () => {
  it('ля-минорная пентатоника: бокс 1 на 5-м ладу', () => {
    const boxes = boxPositions(six, scale('A', 'minor-pentatonic'))
    expect(boxes).toHaveLength(5)
    expect(frets(boxes[0]!.cells)).toBe('1:5-8 2:5-8 3:5-7 4:5-7 5:5-7 6:5-8')
    expect(boxes[0]!.label).toBe('Бокс 1')
  })

  it('бокс 2 ля-минорной пентатоники', () => {
    const box2 = boxPositions(six, scale('A', 'minor-pentatonic'))[1]!
    expect(frets(box2.cells)).toBe('1:8-10 2:8-10 3:7-9 4:7-10 5:7-10 6:8-10')
  })

  it('соль мажор: 7 позиций по 3 ноты на струну, первая от 3-го лада', () => {
    const positions = boxPositions(six, scale('G', 'ionian'))
    expect(positions).toHaveLength(7)
    expect(frets(positions[0]!.cells)).toBe('1:5-7-8 2:5-7-8 3:4-5-7 4:4-5-7 5:3-5-7 6:3-5-7')
  })

  it('ми минорная пентатоника: бокс 1 в открытой позиции', () => {
    const box = boxPositions(six, scale('E', 'minor-pentatonic'))[0]!
    expect(box.minFret).toBe(0)
    expect(frets(box.cells)).toBe('1:0-3 2:0-3 3:0-2 4:0-2 5:0-2 6:0-3')
  })

  it('блюзовая гамма: бокс пентатоники + блюзовая нота', () => {
    const box = boxPositions(six, scale('A', 'blues'))[0]!
    // E♭ — на 5-й струне 6-й лад и на 3-й струне 8-й лад
    expect(frets(box.cells)).toBe('1:5-8 2:5-8 3:5-7-8 4:5-7 5:5-6-7 6:5-8')
  })

  it('7 струн: позиции начинаются с 7-й струны', () => {
    const box = boxPositions(seven, scale('B', 'minor-pentatonic'))[0]!
    expect(box.cells.filter((c) => c.stringIndex === 0).map((c) => c.fret)).toEqual([0, 3])
  })

  it('все ноты позиции — из гаммы, лады на грифе', () => {
    for (const id of ['ionian', 'dorian', 'harmonic-minor', 'major-pentatonic', 'blues']) {
      const s = scale('F#', id)
      for (const p of boxPositions(six, s)) {
        for (const c of p.cells) {
          expect(c.fret).toBeGreaterThanOrEqual(0)
          expect(c.fret).toBeLessThanOrEqual(24)
        }
      }
    }
  })
})

describe('CAGED', () => {
  it('доступен только для стандартных интервалов', () => {
    expect(supportsCaged(six)).toBe(true)
    expect(supportsCaged(seven)).toBe(true)
    expect(supportsCaged(findPreset('6-eb-standard')!)).toBe(true)
    expect(supportsCaged(findPreset('6-drop-d')!)).toBe(false)
    expect(cagedPositions(findPreset('6-drop-d')!, scale('C', 'ionian'))).toEqual([])
  })

  it('до мажор: 5 форм по грифу, форма E на 8-м ладу', () => {
    const positions = cagedPositions(six, scale('C', 'ionian'))
    expect(positions.map((p) => p.label)).toEqual([
      'Форма C',
      'Форма A',
      'Форма G',
      'Форма E',
      'Форма D',
    ])
    const e = positions.find((p) => p.label === 'Форма E')!
    expect(frets(e.shape)).toBe('1:8 2:8 3:9 4:10 5:10 6:8')
    // Открытая форма C: x 3 2 0 1 0
    expect(frets(positions[0]!.shape)).toBe('1:0 2:1 3:0 4:2 5:3 6:')
  })

  it('ноты формы — звуки тонического трезвучия', () => {
    const a = buildScale(n('A'), findScale('aeolian')!)
    for (const p of cagedPositions(six, a)) {
      const names = new Set(
        p.shape.map((c) => formatNote(six.strings[c.stringIndex]!.midi + c.fret).replace(/\d/, '')),
      )
      expect([...names].every((x) => ['A', 'C', 'E'].includes(x))).toBe(true)
    }
  })

  it('форма лежит внутри своего бокса гаммы', () => {
    for (const p of cagedPositions(six, scale('E', 'ionian'))) {
      const keys = new Set(p.cells.map((c) => `${c.stringIndex}:${c.fret}`))
      expect(p.shape.every((c) => keys.has(`${c.stringIndex}:${c.fret}`))).toBe(true)
    }
  })
})

describe('positionRun', () => {
  it('ноты позиции по возрастанию без повторов', () => {
    const box = boxPositions(six, scale('A', 'minor-pentatonic'))[0]!
    const run = positionRun(six, box)
    expect(run.map((r) => formatNote(r.midi))).toEqual([
      'A2',
      'C3',
      'D3',
      'E3',
      'G3',
      'A3',
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
      'C5',
    ])
    expect(run[0]!.cell).toEqual({ stringIndex: 0, fret: 5 })
  })
})

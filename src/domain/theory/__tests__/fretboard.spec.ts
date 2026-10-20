import { describe, expect, it } from 'vitest'
import {
  clampFretRange,
  formatFretRange,
  fretMarker,
  parseFretRange,
  positionsOf,
} from '../fretboard'
import { findPreset } from '@/domain/music/tunings'

describe('fretboard', () => {
  it('отметки ладов', () => {
    expect([0, 3, 5, 7, 9, 12, 15, 24].map(fretMarker)).toEqual([0, 1, 1, 1, 1, 2, 1, 2])
  })

  it('G3 на 7-струнке в ладах 0–15 — в 4 позициях, как на макете', () => {
    const positions = positionsOf(findPreset('7-standard-b')!, 55, { from: 0, to: 15 })
    // Струны от низкой: B1 (на 20-м ладу — вне диапазона), E2:15, A2:10, D3:5, G3:0
    expect(positions.map((p) => `${p.stringIndex}:${p.fret}`)).toEqual([
      '1:15',
      '2:10',
      '3:5',
      '4:0',
    ])
  })

  it('учитывает диапазон ладов', () => {
    const positions = positionsOf(findPreset('6-standard-e')!, 55, { from: 3, to: 12 })
    expect(positions.map((p) => p.fret)).toEqual([10, 5])
  })

  it('разбор и формат диапазона', () => {
    expect(parseFretRange('0-15')).toEqual({ from: 0, to: 15 })
    expect(parseFretRange('5-3')).toBeNull()
    expect(parseFretRange('0-30')).toBeNull()
    expect(parseFretRange('abc')).toBeNull()
    expect(formatFretRange({ from: 3, to: 12 })).toBe('3-12')
  })

  it('ограничение диапазона', () => {
    expect(clampFretRange({ from: -2, to: 40 })).toEqual({ from: 0, to: 24 })
    expect(clampFretRange({ from: 10, to: 5 })).toEqual({ from: 10, to: 11 })
  })
})

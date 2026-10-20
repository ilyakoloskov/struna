import { describe, expect, it } from 'vitest'
import { createLayout, laneSpeed, laneWidth, stringX, timeToZ } from '../geometry'
import { forEachVisible, maxDuration, ringActivity } from '../visibleNotes'
import { ATLAS_COLUMNS, ATLAS_ROWS, DIGIT_UVS, digitCell } from '../digitAtlas'
import { createTestPattern, testPatternDuration } from '../testPattern'
import { heardTime } from '@/game/clock'

describe('geometry', () => {
  const seven = createLayout(7, 2)

  it('струны симметричны относительно центра, низкая — слева', () => {
    expect(stringX(0, seven)).toBe(-3)
    expect(stringX(3, seven)).toBe(0)
    expect(stringX(6, seven)).toBe(3)
    expect(stringX(0, createLayout(6))).toBe(-2.5)
    expect(laneWidth(seven)).toBe(7)
  })

  it('нота на линии удара ровно в своё время', () => {
    expect(timeToZ(10, 10, seven)).toBeCloseTo(0)
    expect(timeToZ(12, 10, seven)).toBeCloseTo(-seven.length) // дальний край через lookahead
    expect(timeToZ(9.5, 10, seven)).toBeGreaterThan(0) // уже прошла
  })

  it('скорость = длина / lookahead', () => {
    expect(laneSpeed(seven)).toBeCloseTo(seven.length / 2)
  })
})

describe('forEachVisible', () => {
  const notes = [
    { time: 0, duration: 4 }, // длинная, началась давно
    { time: 1, duration: 0.2 },
    { time: 3, duration: 0.2 },
    { time: 5, duration: 0.2 },
    { time: 9, duration: 0.2 },
  ]

  it('окно с учётом длинных нот', () => {
    const seen: number[] = []
    const count = forEachVisible(notes, 3 - 0.25, 3 + 2.2, maxDuration(notes), (_, i) =>
      seen.push(i),
    )
    // нота 0 ещё звучит (до 4 с), нота 1 уже ушла, 3 и 5 — в окне, 9 — далеко
    expect(seen).toEqual([0, 2, 3])
    expect(count).toBe(3)
  })

  it('пустой список и окно после конца', () => {
    expect(forEachVisible([], -0.2, 2, 0, () => {})).toBe(0)
    expect(forEachVisible(notes, 99.8, 102, 4, () => {})).toBe(0)
  })
})

describe('digitCell', () => {
  it('ячейки не перекрываются и лежат внутри текстуры', () => {
    const cells = Array.from({ length: 25 }, (_, n) => digitCell(n))
    for (const c of cells) {
      expect(c.u1 - c.u0).toBeCloseTo(1 / ATLAS_COLUMNS)
      expect(c.v1 - c.v0).toBeCloseTo(1 / ATLAS_ROWS)
      expect(c.u0).toBeGreaterThanOrEqual(0)
      expect(c.v0).toBeGreaterThanOrEqual(-1e-9)
    }
    const keys = new Set(cells.map((c) => `${c.u0}:${c.v0}`))
    expect(keys.size).toBe(25)
  })

  it('таблица UV совпадает с ячейками', () => {
    const c = digitCell(13)
    expect([...DIGIT_UVS.subarray(13 * 4, 13 * 4 + 4)]).toEqual(
      [c.u0, c.v0, c.u1, c.v1].map(Math.fround),
    )
  })

  it('0 — левая верхняя, 8 — вторая строка', () => {
    expect(digitCell(0)).toMatchObject({ u0: 0, v1: 1 })
    expect(digitCell(8)).toMatchObject({ u0: 0, v1: 1 - 1 / ATLAS_ROWS })
    expect(digitCell(99)).toEqual(digitCell(24))
  })
})

describe('ringActivity', () => {
  it('вспышка в момент ноты, затухает к краям окна', () => {
    const note = { time: 5, duration: 0.2 }
    expect(ringActivity(5, note)).toBe(1)
    expect(ringActivity(5.06, note)).toBeCloseTo(0.5)
    expect(ringActivity(4.94, note)).toBeCloseTo(0.5)
    expect(ringActivity(5.2, note)).toBe(0)
  })

  it('длинная нота держит кольцо, пока звучит', () => {
    const long = { time: 5, duration: 2 }
    expect(ringActivity(6, long)).toBeCloseTo(0.45)
    expect(ringActivity(7.5, long)).toBe(0)
  })
})

describe('часы', () => {
  it('слышимое время отстаёт на задержку вывода', () => {
    expect(heardTime(10, 0.04)).toBeCloseTo(9.96)
  })
})

describe('тестовый паттерн', () => {
  it('ноты на всех струнах, по порядку, в пределах длительности', () => {
    for (const count of [6, 7]) {
      const notes = createTestPattern(count)
      expect(new Set(notes.map((n) => n.stringIndex)).size).toBe(count)
      expect(notes.every((n) => n.stringIndex >= 0 && n.stringIndex < count)).toBe(true)
      expect(notes.map((n) => n.time)).toEqual([...notes.map((n) => n.time)].sort((a, b) => a - b))
      expect(Math.max(...notes.map((n) => n.time + n.duration))).toBeLessThanOrEqual(
        testPatternDuration(),
      )
    }
  })
})

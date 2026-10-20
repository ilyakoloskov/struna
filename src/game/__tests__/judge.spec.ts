import { describe, expect, it } from 'vitest'
import { Judge, buildTargets, gradeForOffset, pitchMatches, type Judgment } from '../judge'
import type { FrettedNote } from '@/domain/tracks/types'

const note = (time: number, midi: number, stringIndex = 0): FrettedNote => ({
  time,
  midi,
  duration: 0.2,
  velocity: 0.8,
  stringIndex,
  fret: 0,
})

describe('buildTargets', () => {
  it('аккорд — одна цель, неиграбельные ноты пропускаются', () => {
    const targets = buildTargets([
      note(0, 40, 0),
      note(0.01, 47, 1),
      note(0.02, 52, 2),
      note(1, 45, 1),
      { ...note(2, 30), stringIndex: -1 },
    ])
    expect(targets.map((t) => t.midis)).toEqual([[40, 47, 52], [45]])
    expect(targets[0]!.strings).toEqual([0, 1, 2])
    expect(targets[1]!.noteIndices).toEqual([3])
  })
})

describe('окна и высота', () => {
  it('Perfect ±50 мс, Good ±120 мс', () => {
    expect(gradeForOffset(0.03)).toBe('perfect')
    expect(gradeForOffset(-0.05)).toBe('perfect')
    expect(gradeForOffset(0.08)).toBe('good')
    expect(gradeForOffset(-0.12)).toBe('good')
    expect(gradeForOffset(0.13)).toBe('miss')
  })

  it('±50 центов и октавные ошибки детектора', () => {
    expect(pitchMatches(40.4, 40)).toBe(true)
    expect(pitchMatches(40.6, 40)).toBe(false)
    expect(pitchMatches(52.2, 40)).toBe(true) // на октаву выше
    expect(pitchMatches(28, 40)).toBe(true) // на октаву ниже
    expect(pitchMatches(47, 40)).toBe(false) // квинта
  })
})

describe('Judge', () => {
  const targets = buildTargets([note(1, 40), note(1.5, 43), note(2, 45), note(3, 40)])

  it('попадания с оценками и отклонением', () => {
    const judge = new Judge(targets)
    expect(judge.play(1.02, 40)).toMatchObject({ targetIndex: 0, grade: 'perfect' })
    const late = judge.play(1.59, 43)!
    expect(late.grade).toBe('good')
    expect(late.offset).toBeCloseTo(0.09)
  })

  it('не та нота вовремя — лишняя, цель становится Miss', () => {
    const judge = new Judge(targets)
    expect(judge.play(1, 47)).toBeNull()
    expect(judge.extraNotes).toBe(1)
    const misses: Judgment[] = []
    judge.advance(1.2, (j) => misses.push(j))
    expect(misses.map((m) => m.targetIndex)).toEqual([0])
  })

  it('одна цель засчитывается один раз', () => {
    const judge = new Judge(targets)
    judge.play(1, 40)
    expect(judge.play(1.03, 40)).toBeNull()
    expect(judge.extraNotes).toBe(1)
  })

  it('выбирается ближайшая по времени подходящая цель', () => {
    const close = buildTargets([note(1, 40), note(1.1, 40)])
    const judge = new Judge(close)
    expect(judge.play(1.09, 40)?.targetIndex).toBe(1)
    expect(judge.play(1.0, 40)?.targetIndex).toBe(0)
  })

  it('аккорд засчитывается по любой его ноте', () => {
    const chord = buildTargets([note(1, 40, 0), note(1, 47, 1), note(1, 52, 2)])
    expect(new Judge(chord).play(1.01, 47)?.grade).toBe('perfect')
    expect(new Judge(chord).play(1.01, 64)?.grade).toBe('perfect') // 52 + октава
  })

  it('advance отдаёт Miss только когда окно закрылось', () => {
    const judge = new Judge(targets)
    const misses: number[] = []
    judge.advance(1.1, (j) => misses.push(j.targetIndex))
    expect(misses).toEqual([])
    judge.play(1.5, 43)
    judge.advance(2.5, (j) => misses.push(j.targetIndex))
    expect(misses).toEqual([0, 2])
    expect(judge.finished).toBe(false)
    judge.advance(10, (j) => misses.push(j.targetIndex))
    expect(misses).toEqual([0, 2, 3])
    expect(judge.finished).toBe(true)
  })
})

describe('строгая проверка аккордов', () => {
  const chordNotes = [note(1, 40, 0), note(1, 47, 1), note(1, 52, 2), note(1, 56, 3)] // E мажор
  const targets = buildTargets([...chordNotes, note(2, 45)])

  it('аккорд не засчитывается одной нотой — нужна хрома', async () => {
    const judge = new Judge(targets, true)
    expect(judge.play(1.01, 47)).toBeNull()
    expect(judge.extraNotes).toBe(0) // это звук аккорда, а не лишняя нота
    const { expectedChroma } = await import('../chordMatch')
    expect(judge.playChord(1.02, expectedChroma([40, 47, 52, 56]))?.grade).toBe('perfect')
  })

  it('не тот аккорд по хроме — не засчитан', async () => {
    const judge = new Judge(targets, true)
    const { expectedChroma } = await import('../chordMatch')
    expect(judge.playChord(1.0, expectedChroma([40, 47, 52, 55]))).toBeNull() // Em
  })

  it('одиночные ноты в строгом режиме судятся по высоте', () => {
    const judge = new Judge(targets, true)
    expect(judge.play(2.0, 45)?.grade).toBe('perfect')
  })

  it('без строгого режима аккорд засчитывается любой нотой', () => {
    expect(new Judge(targets, false).play(1.0, 56)?.grade).toBe('perfect')
  })
})

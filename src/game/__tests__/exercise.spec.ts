import { describe, expect, it } from 'vitest'
import { createPositionExercise, createScaleExercise, exerciseTrackId, scaleRun } from '../exercise'
import { boxPositions, cagedPositions } from '@/domain/theory/positions'
import { findPreset } from '@/domain/music/tunings'
import { buildScale, findScale } from '@/domain/theory/scales'
import { parseSpelledNote } from '@/domain/theory/notes'
import { formatNote } from '@/domain/music/pitch'

const six = findPreset('6-standard-e')!
const aMinorPent = buildScale(parseSpelledNote('A')!, findScale('minor-pentatonic')!)

describe('упражнение на гамму', () => {
  it('A минорная пентатоника в 5-й позиции: вверх от тоники и обратно', () => {
    const run = scaleRun(six, aMinorPent, { from: 5, to: 8 })
    expect(run.map((m) => formatNote(m)).slice(0, 6)).toEqual(['A2', 'C3', 'D3', 'E3', 'G3', 'A3'])
    expect(run[0]).toBe(run.at(-1))
    const top = Math.max(...run)
    expect(run.indexOf(top)).toBe((run.length - 1) / 2)
  })

  it('все ноты в выбранном диапазоне ладов, восьмыми по темпу', () => {
    const exercise = createScaleExercise(six, aMinorPent, { from: 5, to: 8 }, 120)!
    expect(exercise.notes.every((n) => n.fret >= 5 && n.fret <= 8)).toBe(true)
    expect(exercise.notes[1]!.time - exercise.notes[0]!.time).toBeCloseTo(0.25)
    expect(exercise.song.name).toContain('лады 5–8')
    expect(exercise.song.duration).toBeGreaterThan(exercise.notes.at(-1)!.time)
  })

  it('если в диапазоне нет тоники — упражнения нет', () => {
    // На 1-м ладу из пентатоники ля минор есть только C4
    expect(createScaleExercise(six, aMinorPent, { from: 1, to: 1 }, 80)).toBeNull()
  })

  it('ключ для истории — с диапазоном или позицией', () => {
    expect(exerciseTrackId('A', 'minor-pentatonic', { from: 5, to: 8 }, '6-standard-e')).toBe(
      'exercise:A:minor-pentatonic:5-8:6-standard-e',
    )
    expect(
      exerciseTrackId('A', 'minor-pentatonic', { from: 0, to: 15 }, '6-standard-e', {
        number: 2,
        system: 'caged',
      }),
    ).toBe('exercise:A:minor-pentatonic:caged2:6-standard-e')
  })

  it('упражнение в позиции играет ровно её клетки вверх и вниз', () => {
    const box = boxPositions(six, aMinorPent)[0]!
    const exercise = createPositionExercise(six, aMinorPent, box, 100)!
    const keys = new Set(box.cells.map((c) => `${c.stringIndex}:${c.fret}`))
    expect(exercise.notes.every((n) => keys.has(`${n.stringIndex}:${n.fret}`))).toBe(true)
    // 12 нот вверх и 11 вниз
    expect(exercise.notes).toHaveLength(23)
    expect(exercise.notes[0]).toMatchObject({ stringIndex: 0, fret: 5 })
    expect(exercise.notes.at(-1)).toMatchObject({ stringIndex: 0, fret: 5 })
    expect(exercise.song.name).toContain('бокс 1')
  })

  it('упражнение в форме CAGED', () => {
    const form = cagedPositions(six, aMinorPent)[0]!
    const exercise = createPositionExercise(six, aMinorPent, form, 100)!
    expect(exercise.song.name).toContain('форма')
    expect(exercise.notes.length).toBeGreaterThan(10)
  })
})

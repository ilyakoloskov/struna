import { describe, expect, it } from 'vitest'
import { createScaleExercise, exerciseTrackId, scaleRun } from '../exercise'
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

  it('ключ для истории', () => {
    expect(exerciseTrackId('A', 'minor-pentatonic', { from: 5, to: 8 }, '6-standard-e')).toBe(
      'exercise:A:minor-pentatonic:5-8:6-standard-e',
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  TUNING_PRESETS,
  createCustomTuning,
  defaultCustomMidis,
  findPreset,
  isValidCustomMidis,
  lowestMidi,
  nearestStringIndex,
} from '../tunings'

describe('tunings', () => {
  it('пресеты: ноты струн от низкой к высокой', () => {
    const notes = (id: string) =>
      findPreset(id)!
        .strings.map((s) => `${s.name}${s.octave}`)
        .join(' ')
    expect(notes('6-standard-e')).toBe('E2 A2 D3 G3 B3 E4')
    expect(notes('6-drop-d')).toBe('D2 A2 D3 G3 B3 E4')
    expect(notes('6-eb-standard')).toBe('E♭2 A♭2 D♭3 G♭3 B♭3 E♭4')
    expect(notes('7-standard-b')).toBe('B1 E2 A2 D3 G3 B3 E4')
    expect(notes('7-drop-a')).toBe('A1 E2 A2 D3 G3 B3 E4')
  })

  it('номера струн: 1 — самая высокая', () => {
    const seven = findPreset('7-standard-b')!
    expect(seven.strings[0]!.number).toBe(7)
    expect(seven.strings.at(-1)!.number).toBe(1)
  })

  it('все пресеты — 6 или 7 струн, высоты возрастают', () => {
    for (const tuning of TUNING_PRESETS) {
      expect([6, 7]).toContain(tuning.strings.length)
      const midis = tuning.strings.map((s) => s.midi)
      expect([...midis].sort((a, b) => a - b)).toEqual(midis)
    }
  })

  it('самая низкая нота Drop A — A1', () => {
    expect(lowestMidi(findPreset('7-drop-a')!)).toBe(33)
  })

  it('ближайшая струна', () => {
    const standard = findPreset('6-standard-e')!
    expect(nearestStringIndex(standard, 40.3)).toBe(0) // E2
    expect(nearestStringIndex(standard, 58.8)).toBe(4) // B3
    expect(nearestStringIndex(standard, 47)).toBe(1) // между A2 и D3 — ближе A2
  })

  it('свой строй', () => {
    const custom = createCustomTuning([36, 43, 48, 53, 57, 62])
    expect(custom.id).toBe('custom')
    expect(custom.strings.map((s) => s.name).join(' ')).toBe('C G C F A D')
    expect(custom.label).toBe('6 стр. · Свой строй')
  })

  it('стартовые ноты своего строя', () => {
    expect(defaultCustomMidis(7)).toEqual([35, 40, 45, 50, 55, 59, 64])
    expect(defaultCustomMidis(6)).toHaveLength(6)
  })

  it('проверка своего строя', () => {
    expect(isValidCustomMidis([40, 45, 50, 55, 59, 64])).toBe(true)
    expect(isValidCustomMidis([40, 45, 50])).toBe(false)
    expect(isValidCustomMidis([10, 45, 50, 55, 59, 64])).toBe(false)
    expect(isValidCustomMidis('E2')).toBe(false)
  })
})

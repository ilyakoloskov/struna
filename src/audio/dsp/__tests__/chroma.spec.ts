import { describe, expect, it } from 'vitest'
import { FFT } from '../fft'
import { CHROMA_SIZE, ChromaAnalyzer } from '../chroma'
import { matchChord } from '@/game/chordMatch'
import { midiToFreq, parseNote } from '@/domain/music/pitch'
import { seededRandom, tone } from './signals'

const SR = 48000

/** Аккорд — сумма гитарных нот (с обертонами), чуть разной громкости и фазы */
function chord(notes: string[], noise = 0.002): Float32Array {
  const out = new Float32Array(CHROMA_SIZE)
  notes.forEach((name, i) => {
    const t = tone(midiToFreq(parseNote(name)!), {
      sampleRate: SR,
      length: CHROMA_SIZE,
      amplitude: 0.15 * (1 - i * 0.06),
      noise: 0,
      seed: i + 1,
    })
    for (let k = 0; k < out.length; k++) out[k]! += t[k]!
  })
  const random = seededRandom(9)
  for (let k = 0; k < out.length; k++) out[k]! += noise * (random() * 2 - 1)
  return out
}

const analyzer = new ChromaAnalyzer(SR)
const pcs = (...names: string[]) => names.map((n) => parseNote(`${n}4`)! % 12)
const midis = (voicing: string[]) => voicing.map((n) => parseNote(n)!)
const top = (chroma: Float32Array, count: number) =>
  [...chroma]
    .map((v, pc) => ({ v, pc }))
    .sort((a, b) => b.v - a.v)
    .slice(0, count)
    .map((x) => x.pc)
    .sort((a, b) => a - b)

describe('FFT', () => {
  it('синус попадает в свой бин', () => {
    const n = 1024
    const fft = new FFT(n)
    const re = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 37 * i) / n))
    const im = new Float64Array(n)
    fft.transform(re, im)
    const magnitude = (k: number) => Math.hypot(re[k]!, im[k]!)
    expect(magnitude(37)).toBeCloseTo(n / 2, 3)
    expect(magnitude(36)).toBeLessThan(1e-6)
  })

  it('совпадает с прямым ДПФ', () => {
    const n = 64
    const random = seededRandom(3)
    const x = Array.from({ length: n }, () => random() - 0.5)
    const re = Float64Array.from(x)
    const im = new Float64Array(n)
    new FFT(n).transform(re, im)
    for (const k of [0, 5, 17, 31]) {
      let dr = 0
      let di = 0
      x.forEach((v, t) => {
        dr += v * Math.cos((2 * Math.PI * k * t) / n)
        di -= v * Math.sin((2 * Math.PI * k * t) / n)
      })
      expect(re[k]).toBeCloseTo(dr, 9)
      expect(im[k]).toBeCloseTo(di, 9)
    }
  })

  it('только степени двойки', () => {
    expect(() => new FFT(1000)).toThrow()
  })
})

describe('ChromaAnalyzer', () => {
  it('одиночная нота — максимум на своей ноте', () => {
    const chroma = analyzer.analyze(chord(['A2']))
    expect(chroma.indexOf(1)).toBe(pcs('A')[0])
  })

  it('открытый ми мажор: E G♯ B сильнее остальных', () => {
    expect(top(analyzer.analyze(chord(['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'])), 3)).toEqual(
      pcs('E', 'G#', 'B').sort((a, b) => a - b),
    )
  })

  it('тишина — нули', () => {
    expect([...analyzer.analyze(new Float32Array(CHROMA_SIZE))].every((v) => v === 0)).toBe(true)
  })
})

describe('matchChord', () => {
  const power = midis(['E2', 'B2', 'E3'])

  it('квинтаккорд засчитан; одна тоника вместо него — нет', () => {
    expect(matchChord(analyzer.analyze(chord(['E2', 'B2', 'E3'])), power).ok).toBe(true)
    expect(matchChord(analyzer.analyze(chord(['E2'])), power).ok).toBe(false)
  })

  it('шум — не аккорд', () => {
    const random = seededRandom(5)
    const noise = Float32Array.from({ length: CHROMA_SIZE }, () => (random() * 2 - 1) * 0.1)
    expect(
      matchChord(analyzer.analyze(noise), midis(['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'])).ok,
    ).toBe(false)
  })
})

describe('матрица открытых аккордов', () => {
  const chords: Record<string, { voicing: string[]; notes: string[] }> = {
    E: { voicing: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'], notes: ['E', 'G#', 'B'] },
    Em: { voicing: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'], notes: ['E', 'G', 'B'] },
    A: { voicing: ['A2', 'E3', 'A3', 'C#4', 'E4'], notes: ['A', 'C#', 'E'] },
    Am: { voicing: ['A2', 'E3', 'A3', 'C4', 'E4'], notes: ['A', 'C', 'E'] },
    C: { voicing: ['C3', 'E3', 'G3', 'C4', 'E4'], notes: ['C', 'E', 'G'] },
    G: { voicing: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'], notes: ['G', 'B', 'D'] },
    D: { voicing: ['D3', 'A3', 'D4', 'F#4'], notes: ['D', 'F#', 'A'] },
    F: { voicing: ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'], notes: ['F', 'A', 'C'] },
    Bm: { voicing: ['B2', 'F#3', 'B3', 'D4', 'F#4'], notes: ['B', 'D', 'F#'] },
    E5: { voicing: ['E2', 'B2', 'E3'], notes: ['E', 'B'] },
    D5: { voicing: ['D2', 'A2', 'D3'], notes: ['D', 'A'] }, // Drop D
    A5: { voicing: ['A1', 'E2', 'A2'], notes: ['A', 'E'] }, // Drop A, 7 струн
    B5: { voicing: ['B1', 'F#2', 'B2'], notes: ['B', 'F#'] }, // 7 струн
  }
  /** Сыграно больше нужного (полный аккорд вместо квинтаккорда на той же тонике) — допустимо */
  const superset: Record<string, string[]> = {
    E5: ['E', 'Em'],
    D5: ['D'],
    A5: ['A', 'Am'],
    B5: ['Bm'],
  }

  it('каждый аккорд засчитывается только своим шаблоном (и квинтаккордом своей тоники)', () => {
    const errors: string[] = []
    const table: string[] = []
    for (const [played, { voicing }] of Object.entries(chords)) {
      const chroma = analyzer.analyze(chord(voicing))
      const row: string[] = []
      for (const [expected, other] of Object.entries(chords)) {
        const result = matchChord(chroma, midis(other.voicing))
        row.push(`${expected}:${result.similarity.toFixed(2)}${result.ok ? '✓' : ''}`)
        const allowed = played === expected || (superset[expected] ?? []).includes(played)
        if (result.ok !== allowed) errors.push(`${played} как ${expected}: ${result.ok}`)
      }
      table.push(`${played.padEnd(3)} ${row.join(' ')}`)
    }
    if (process.env.CHORD_TABLE) console.warn(table.join('\n'))
    expect(errors).toEqual([])
  })

  it('мажор и минор с одной тоникой различаются (одна нота разницы)', () => {
    const E = analyzer.analyze(chord(chords.E!.voicing))
    expect(matchChord(E, midis(chords.Em!.voicing)).ok).toBe(false)
  })
})

describe('устойчивость', () => {
  it('аккорд засчитывается при шуме и разной громкости струн', () => {
    const voicing = ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4']
    for (const noise of [0.002, 0.01, 0.02]) {
      expect(matchChord(analyzer.analyze(chord(voicing, noise)), midis(voicing)).ok).toBe(true)
    }
  })

  it('соседи аккорда: одна нота на полтона в сторону', async () => {
    const { chordVariants } = await import('@/game/chordMatch')
    const variants = chordVariants([40, 47, 52, 56])
    expect(variants).toContainEqual([40, 47, 52, 55]) // E → Em
    expect(variants).toContainEqual([40, 47, 52]) // E → E5 (без терции)
    expect(variants).toHaveLength(9)
  })
})

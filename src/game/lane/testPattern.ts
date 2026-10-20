import type { FrettedNote } from '@/domain/tracks/types'
import type { NoteTechnique } from '@/domain/tracks/technique'

// Тестовые ноты без звука: лесенка по всем струнам, аккорды, длинные ноты и приёмы.
// Нужны, чтобы проверить отрисовку и ритм отдельно от звука.

export const TEST_BPM = 120
const BEAT = 60 / TEST_BPM

/** Приёмы на нотах лесенки в тактах 3 и 7 — по одному на ноту */
const TECHNIQUES: NoteTechnique[] = [
  { harmonic: 'natural' },
  { bend: { from: 0, peak: 2, to: 2 } },
  { legato: 'hammer' },
  { slideOut: { frets: 2, toNote: false } },
  { palmMute: true },
  { dead: true },
  { vibrato: true },
  { bend: { from: 0, peak: 1, to: 0 } },
]

export function createTestPattern(stringCount: number, bars = 8): FrettedNote[] {
  const notes: FrettedNote[] = []
  const add = (
    beat: number,
    stringIndex: number,
    fret: number,
    length = 0.5,
    technique?: NoteTechnique,
  ) =>
    notes.push({
      midi: 40 + stringIndex * 5 + fret,
      time: beat * BEAT,
      duration: length * BEAT,
      velocity: 0.8,
      stringIndex,
      fret,
      ...(technique && { technique }),
    })

  for (let bar = 0; bar < bars; bar++) {
    const b = bar * 4
    if (bar % 2 === 0) {
      // Лесенка: восьмые снизу вверх и обратно
      for (let i = 0; i < 8; i++) {
        const s = i < stringCount ? i : 2 * stringCount - 1 - i
        const technique = bar % 4 === 2 ? TECHNIQUES[i] : undefined
        add(b + i * 0.5, Math.max(0, Math.min(stringCount - 1, s)), (bar + i) % 13, 0.5, technique)
      }
    } else {
      // Аккорд на трёх нижних струнах и длинная нота на верхней
      for (let s = 0; s < 3; s++) add(b, s, [0, 2, 2][s]!, 1)
      add(b + 2, stringCount - 1, 12, 2)
      add(b + 2, stringCount - 2, 13, 1.5)
    }
  }
  return notes.sort((a, b) => a.time - b.time || a.stringIndex - b.stringIndex)
}

export function testPatternDuration(bars = 8): number {
  return bars * 4 * BEAT
}

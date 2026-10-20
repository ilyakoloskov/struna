import { storeToRefs } from 'pinia'
import { playNote } from '@/audio/synth/synth'
import type { Triad } from '@/domain/theory/chords'
import { chroma, mod, type SpelledNote } from '@/domain/theory/notes'
import { useSettingsStore } from '@/stores/settings'

/** Пауза между нотами аккорда — лёгкое арпеджио, как бряцание по струнам */
const STRUM_MS = 60

/** Проигрывание нот и аккордов по клику на грифе, круге и в списках */
export function useNotePlayer() {
  const { a4 } = storeToRefs(useSettingsStore())

  function playMidi(midi: number) {
    void playNote(midi, a4.value)
  }

  /** Нота в третьей октаве (C3…B3) — удобный для прослушивания регистр */
  function playSpelled(note: SpelledNote) {
    playMidi(48 + chroma(note))
  }

  function playChord(chord: Triad) {
    const root = 48 + chroma(chord.root)
    chord.notes.forEach((note, i) => {
      const midi = root + mod(chroma(note) - chroma(chord.root), 12)
      setTimeout(() => playMidi(midi), i * STRUM_MS)
    })
  }

  return { playMidi, playSpelled, playChord }
}

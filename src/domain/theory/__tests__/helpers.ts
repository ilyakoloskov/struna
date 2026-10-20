import { formatNote, parseSpelledNote, type SpelledNote } from '../notes'

export function n(text: string): SpelledNote {
  const parsed = parseSpelledNote(text)
  if (!parsed) throw new Error(`bad note ${text}`)
  return parsed
}

export function names(notes: readonly SpelledNote[]): string {
  return notes.map(formatNote).join(' ')
}

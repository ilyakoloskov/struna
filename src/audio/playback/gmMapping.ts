import type { TrackInstrument } from '@/domain/tracks/types'

// Сопоставление General MIDI с инструментами smplr.

/** Названия GM из @tonejs/midi, которые пишутся иначе, чем имена soundfont */
const SOUNDFONT_EXCEPTIONS: Record<string, string> = {
  'honky-tonk piano': 'honkytonk_piano',
  clavi: 'clavinet',
  'synthstrings 1': 'synth_strings_1',
  'synthstrings 2': 'synth_strings_2',
  'synth voice': 'synth_choir',
  'synthbrass 1': 'synth_brass_1',
  'synthbrass 2': 'synth_brass_2',
  'lead 8 (bass + lead)': 'lead_8_bass__lead',
  'fx 8 (sci-fi)': 'fx_8_scifi',
  'bag pipe': 'bagpipe',
}

/** Имя soundfont для мелодического инструмента: «electric guitar (clean)» → «electric_guitar_clean» */
export function soundfontName(instrument: Pick<TrackInstrument, 'name'>): string {
  const name = instrument.name.toLowerCase().trim()
  return (
    SOUNDFONT_EXCEPTIONS[name] ??
    name
      .replace(/[()]/g, '')
      .trim()
      .replace(/[\s-]+/g, '_')
  )
}

/** Драм-машина для ударных: LinnDrum — сэмплы акустической установки */
export const DRUM_KIT = 'LM-2'

/** Нота ударных GM (10-й канал) → группа сэмплов LinnDrum; null — пропустить */
export function drumGroup(note: number): string | null {
  return GM_DRUMS[note] ?? null
}

const GM_DRUMS: Record<number, string> = {
  35: 'kick-alt',
  36: 'kick',
  37: 'stick-m',
  38: 'snare-m',
  39: 'clap',
  40: 'snare-h',
  41: 'tom-ll',
  42: 'hhclosed',
  43: 'tom-l',
  44: 'hhclosed-short',
  45: 'tom-m',
  46: 'hhopen',
  47: 'tom-m',
  48: 'tom-h',
  49: 'crash',
  50: 'tom-hh',
  51: 'ride',
  52: 'crash',
  53: 'ride',
  54: 'tambourine',
  55: 'crash',
  56: 'cowbell',
  57: 'crash',
  59: 'ride',
  60: 'conga-h',
  61: 'conga-m',
  62: 'conga-hh',
  63: 'conga-h',
  64: 'conga-l',
  69: 'cabasa',
  70: 'cabasa',
}

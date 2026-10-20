import type * as AlphaTab from '@coderline/alphatab'
import type { Beat, NoteEvent, NotePosition, Song, SongTrack } from './types'

// Guitar Pro (.gp, .gp3–.gp7, .gpx) через alphaTab → наша модель Song.
// Модуль alphaTab передаётся параметром: в приложении он грузится лениво (тяжёлый),
// в тестах импортируется напрямую.
//
// Время: MIDI-генератор alphaTab раскрывает повторы и отдаёт смены темпа и ноты с абсолютными тиками.
// Гитарные дорожки берём из модели (там струна и лад): для каждого сыгранного такта из таблицы тиков
// позиция ноты = тик начала такта + позиция доли в такте.

type AlphaTabModule = typeof AlphaTab
type Score = AlphaTab.model.Score

/** Тиков на четверть в alphaTab */
const QUARTER = 960
const PERCUSSION_CHANNEL = 9

export class GpImportError extends Error {}

interface TempoPoint {
  tick: number
  bpm: number
  /** Секунды к началу этой точки */
  seconds: number
}

/** Перевод тиков в секунды по карте темпов */
export function createTickClock(changes: readonly { tick: number; bpm: number }[]) {
  const sorted = [...changes].sort((a, b) => a.tick - b.tick)
  const points: TempoPoint[] = []
  for (const change of sorted.length ? sorted : [{ tick: 0, bpm: 120 }]) {
    const last = points.at(-1)
    if (last && last.tick === change.tick) {
      last.bpm = change.bpm
      continue
    }
    const seconds = last
      ? last.seconds + ((change.tick - last.tick) / QUARTER) * (60 / last.bpm)
      : 0
    points.push({ tick: change.tick, bpm: change.bpm, seconds })
  }
  if (points[0]!.tick > 0) points.unshift({ tick: 0, bpm: points[0]!.bpm, seconds: 0 })
  return (tick: number): number => {
    let point = points[0]!
    for (const p of points) {
      if (p.tick > tick) break
      point = p
    }
    return point.seconds + ((tick - point.tick) / QUARTER) * (60 / point.bpm)
  }
}

export function loadGpScore(at: AlphaTabModule, data: Uint8Array): Score {
  try {
    return at.importer.ScoreLoader.loadScoreFromBytes(data, new at.Settings())
  } catch {
    throw new GpImportError('Файл не похож на Guitar Pro или повреждён')
  }
}

export function scoreToSong(at: AlphaTabModule, score: Score, fileName = ''): Song {
  const settings = new at.Settings()
  const tempos: { tick: number; bpm: number }[] = []
  const midiNotes = new Map<
    number,
    { start: number; length: number; key: number; velocity: number; channel: number }[]
  >()
  let tickShift = 0

  // Обработчик MIDI-событий: нужны только темпы и ноты (для аккомпанемента)
  const handler: AlphaTab.midi.IMidiFileHandler = {
    addTickShift: (shift: number) => (tickShift = shift),
    addTimeSignature: () => {},
    addRest: () => {},
    addControlChange: () => {},
    addProgramChange: () => {},
    addNoteBend: () => {},
    addBend: () => {},
    finishTrack: () => {},
    addTempo: (tick: number, bpm: number) => void tempos.push({ tick, bpm }),
    addNote: (
      track: number,
      start: number,
      length: number,
      key: number,
      velocity: number,
      channel: number,
    ) => {
      const list = midiNotes.get(track) ?? []
      list.push({ start, length, key, velocity, channel })
      midiNotes.set(track, list)
    },
  }
  const generator = new at.midi.MidiFileGenerator(score, settings, handler)
  generator.generate()

  const toSeconds = createTickClock(tempos.length ? tempos : [{ tick: 0, bpm: score.tempo }])
  const played = generator.tickLookup.masterBars
  if (played.length === 0) throw new GpImportError('В файле нет тактов')

  const tracks: SongTrack[] = score.tracks
    .map((track, index) => {
      const staff = track.staves[0]
      const percussion = staff?.isPercussion ?? false
      const program = track.playbackInfo.program
      const fretted = !percussion && (staff?.tuning.length ?? 0) >= 4
      const base = {
        index,
        name: track.name.trim() || `Дорожка ${index + 1}`,
        instrument: {
          program,
          name: gmName(program),
          family: percussion ? 'drums' : gmFamily(program),
          percussion,
        },
      }
      if (fretted && staff) return { ...base, ...frettedNotes(staff, played, toSeconds) }
      const notes = (midiNotes.get(index) ?? []).map((n) => ({
        midi: n.key,
        time: toSeconds(n.start - tickShift),
        duration: toSeconds(n.start - tickShift + n.length) - toSeconds(n.start - tickShift),
        velocity: n.velocity / 127,
      }))
      // Ударные в GP распознаются по 10-му каналу, даже если стаф не помечен
      if (
        notes.length &&
        (midiNotes.get(index) ?? []).every((n) => n.channel === PERCUSSION_CHANNEL)
      ) {
        base.instrument.percussion = true
        base.instrument.family = 'drums'
      }
      return { ...base, notes: notes.sort((a, b) => a.time - b.time || a.midi - b.midi) }
    })
    .filter((t) => t.notes.length > 0)

  if (tracks.length === 0) throw new GpImportError('В файле нет нот')

  const first = score.masterBars[0]!
  const last = played.at(-1)!
  return {
    name:
      [score.artist, score.title].filter((s) => s?.trim()).join(' — ') ||
      fileName.replace(/\.(gp\d?|gpx)$/i, '') ||
      'Без названия',
    duration: toSeconds(last.end),
    bpm: Math.round(score.tempo),
    timeSignature: [first.timeSignatureNumerator, first.timeSignatureDenominator],
    beats: buildBeats(played, toSeconds),
    tracks,
  }
}

/** Ноты гитарной дорожки с позициями из файла, с учётом повторов */
function frettedNotes(
  staff: AlphaTab.model.Staff,
  played: readonly AlphaTab.midi.MasterBarTickLookup[],
  toSeconds: (tick: number) => number,
): { notes: NoteEvent[]; positions: NotePosition[]; tuning: number[] } {
  // В alphaTab строй — от высокой струны к низкой, а note.string = 1 — самая низкая
  const tuning = [...staff.tuning].reverse()
  const events: { note: NoteEvent; position: NotePosition }[] = []
  for (const occurrence of played) {
    const bar = staff.bars[occurrence.masterBar.index]
    if (!bar) continue
    for (const voice of bar.voices) {
      for (const beat of voice.beats) {
        const start = occurrence.start + beat.playbackStart
        for (const note of beat.notes) {
          // Продолжение залиги и глухие ноты не играются отдельно
          if (note.isTieDestination || note.isDead) continue
          const stringIndex = note.string - 1
          const open = tuning[stringIndex]
          if (open === undefined) continue
          const midi = note.realValue
          const length = tiedLength(note, beat)
          events.push({
            note: {
              midi,
              time: toSeconds(start),
              duration: toSeconds(start + length) - toSeconds(start),
              velocity: 0.8,
            },
            // Лад — от высоты, а не note.fret: так капо и транспонирование не сбивают позицию
            position: { stringIndex, fret: midi - open },
          })
        }
      }
    }
  }
  events.sort((a, b) => a.note.time - b.note.time || a.note.midi - b.note.midi)
  return { notes: events.map((e) => e.note), positions: events.map((e) => e.position), tuning }
}

/** Длительность с учётом залиги на следующие доли, в тиках */
function tiedLength(note: AlphaTab.model.Note, beat: AlphaTab.model.Beat): number {
  let length = beat.playbackDuration
  let current = note.tieDestination
  while (current) {
    length += current.beat.playbackDuration
    current = current.tieDestination
  }
  return length
}

function buildBeats(
  played: readonly AlphaTab.midi.MasterBarTickLookup[],
  toSeconds: (tick: number) => number,
): Beat[] {
  const beats: Beat[] = []
  for (const occurrence of played) {
    const { timeSignatureNumerator: num, timeSignatureDenominator: den } = occurrence.masterBar
    const step = (QUARTER * 4) / den
    for (let k = 0, tick = occurrence.start; k < num && tick < occurrence.end; k++, tick += step) {
      beats.push({ time: toSeconds(tick), downbeat: k === 0 })
    }
  }
  return beats
}

const GM_FAMILIES = [
  'piano',
  'chromatic percussion',
  'organ',
  'guitar',
  'bass',
  'strings',
  'ensemble',
  'brass',
  'reed',
  'pipe',
  'synth lead',
  'synth pad',
  'synth effects',
  'world',
  'percussive',
  'sound effects',
]

export function gmFamily(program: number): string {
  return GM_FAMILIES[Math.floor(program / 8)] ?? 'piano'
}

/** Название GM-инструмента в той же записи, что у @tonejs/midi — для выбора сэмплов */
export function gmName(program: number): string {
  return GM_NAMES[program] ?? 'acoustic grand piano'
}

// prettier-ignore
const GM_NAMES = [
  'acoustic grand piano', 'bright acoustic piano', 'electric grand piano', 'honky-tonk piano', 'electric piano 1', 'electric piano 2', 'harpsichord', 'clavi',
  'celesta', 'glockenspiel', 'music box', 'vibraphone', 'marimba', 'xylophone', 'tubular bells', 'dulcimer',
  'drawbar organ', 'percussive organ', 'rock organ', 'church organ', 'reed organ', 'accordion', 'harmonica', 'tango accordion',
  'acoustic guitar (nylon)', 'acoustic guitar (steel)', 'electric guitar (jazz)', 'electric guitar (clean)', 'electric guitar (muted)', 'overdriven guitar', 'distortion guitar', 'guitar harmonics',
  'acoustic bass', 'electric bass (finger)', 'electric bass (pick)', 'fretless bass', 'slap bass 1', 'slap bass 2', 'synth bass 1', 'synth bass 2',
  'violin', 'viola', 'cello', 'contrabass', 'tremolo strings', 'pizzicato strings', 'orchestral harp', 'timpani',
  'string ensemble 1', 'string ensemble 2', 'synthstrings 1', 'synthstrings 2', 'choir aahs', 'voice oohs', 'synth voice', 'orchestra hit',
  'trumpet', 'trombone', 'tuba', 'muted trumpet', 'french horn', 'brass section', 'synthbrass 1', 'synthbrass 2',
  'soprano sax', 'alto sax', 'tenor sax', 'baritone sax', 'oboe', 'english horn', 'bassoon', 'clarinet',
  'piccolo', 'flute', 'recorder', 'pan flute', 'blown bottle', 'shakuhachi', 'whistle', 'ocarina',
  'lead 1 (square)', 'lead 2 (sawtooth)', 'lead 3 (calliope)', 'lead 4 (chiff)', 'lead 5 (charang)', 'lead 6 (voice)', 'lead 7 (fifths)', 'lead 8 (bass + lead)',
  'pad 1 (new age)', 'pad 2 (warm)', 'pad 3 (polysynth)', 'pad 4 (choir)', 'pad 5 (bowed)', 'pad 6 (metallic)', 'pad 7 (halo)', 'pad 8 (sweep)',
  'fx 1 (rain)', 'fx 2 (soundtrack)', 'fx 3 (crystal)', 'fx 4 (atmosphere)', 'fx 5 (brightness)', 'fx 6 (goblins)', 'fx 7 (echoes)', 'fx 8 (sci-fi)',
  'sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bag pipe', 'fiddle', 'shanai',
  'tinkle bell', 'agogo', 'steel drums', 'woodblock', 'taiko drum', 'melodic tom', 'synth drum', 'reverse cymbal',
  'guitar fret noise', 'breath noise', 'seashore', 'bird tweet', 'telephone ring', 'helicopter', 'applause', 'gunshot',
]

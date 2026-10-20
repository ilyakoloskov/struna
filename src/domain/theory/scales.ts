import { formatDegree, intervalName, parseDegree, transpose, type Degree } from './intervals'
import { chroma, formatNote, mod, note, type SpelledNote } from './notes'

export type ScaleId =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues'

export interface ScaleType {
  id: ScaleId
  /** Название в списке: «Натуральный минор (эолийский)» */
  label: string
  /** Название после тоники: «E натуральный минор», «D дорийский лад» */
  title: string
  degrees: readonly Degree[]
  /** Наклонение по терции: от него зависит параллельная тональность */
  quality: 'major' | 'minor'
}

function scale(
  id: ScaleId,
  label: string,
  title: string,
  formula: string,
  quality: 'major' | 'minor',
): ScaleType {
  return { id, label, title, degrees: formula.split(' ').map(parseDegree), quality }
}

export const SCALES: readonly ScaleType[] = [
  scale('ionian', 'Мажор (ионийский)', 'мажор', '1 2 3 4 5 6 7', 'major'),
  scale(
    'aeolian',
    'Натуральный минор (эолийский)',
    'натуральный минор',
    '1 2 b3 4 5 b6 b7',
    'minor',
  ),
  scale('dorian', 'Дорийский', 'дорийский лад', '1 2 b3 4 5 6 b7', 'minor'),
  scale('phrygian', 'Фригийский', 'фригийский лад', '1 b2 b3 4 5 b6 b7', 'minor'),
  scale('lydian', 'Лидийский', 'лидийский лад', '1 2 3 #4 5 6 7', 'major'),
  scale('mixolydian', 'Миксолидийский', 'миксолидийский лад', '1 2 3 4 5 6 b7', 'major'),
  scale('locrian', 'Локрийский', 'локрийский лад', '1 b2 b3 4 b5 b6 b7', 'minor'),
  scale('harmonic-minor', 'Гармонический минор', 'гармонический минор', '1 2 b3 4 5 b6 7', 'minor'),
  scale('melodic-minor', 'Мелодический минор', 'мелодический минор', '1 2 b3 4 5 6 7', 'minor'),
  scale('major-pentatonic', 'Мажорная пентатоника', 'мажорная пентатоника', '1 2 3 5 6', 'major'),
  scale('minor-pentatonic', 'Минорная пентатоника', 'минорная пентатоника', '1 b3 4 5 b7', 'minor'),
  scale('blues', 'Блюзовая гамма', 'блюзовая гамма', '1 b3 4 b5 5 b7', 'minor'),
]

/** Синонимы для URL: ?mode=major / ?mode=minor */
const SCALE_ALIASES: Record<string, ScaleId> = { major: 'ionian', minor: 'aeolian' }

export function findScale(id: string): ScaleType | undefined {
  const resolved = SCALE_ALIASES[id] ?? id
  return SCALES.find((s) => s.id === resolved)
}

export type NoteRole = 'tonic' | 'third' | 'fifth' | 'other'

export interface ScaleNote {
  note: SpelledNote
  degree: Degree
  role: NoteRole
}

export interface Scale {
  tonic: SpelledNote
  type: ScaleType
  notes: readonly ScaleNote[]
}

export function buildScale(tonic: SpelledNote, type: ScaleType): Scale {
  // Квинта — натуральная 5-я ступень, а если её нет (локрийский) — пониженная
  const hasPerfectFifth = type.degrees.some((d) => d.number === 5 && d.alt === 0)
  const notes = type.degrees.map((degree) => ({
    note: transpose(tonic, degree),
    degree,
    role: roleOf(degree, hasPerfectFifth),
  }))
  return { tonic, type, notes }
}

function roleOf(degree: Degree, hasPerfectFifth: boolean): NoteRole {
  if (degree.number === 1) return 'tonic'
  if (degree.number === 3) return 'third'
  if (degree.number === 5 && (degree.alt === 0 || !hasPerfectFifth)) return 'fifth'
  return 'other'
}

/** Нота гаммы по высоте без октавы, если высота входит в гамму */
export function scaleNoteByChroma(scale: Scale, pitchClass: number): ScaleNote | undefined {
  return scale.notes.find((n) => chroma(n.note) === pitchClass)
}

export function scaleChromas(scale: Scale): Set<number> {
  return new Set(scale.notes.map((n) => chroma(n.note)))
}

/** Тоники для выбора: 12 высот, у пяти чёрных клавиш — оба написания */
export const TONIC_CHOICES: readonly SpelledNote[] = [
  note('C'),
  note('C', 1),
  note('D', -1),
  note('D'),
  note('D', 1),
  note('E', -1),
  note('E'),
  note('F'),
  note('F', 1),
  note('G', -1),
  note('G'),
  note('G', 1),
  note('A', -1),
  note('A'),
  note('A', 1),
  note('B', -1),
  note('B'),
]

/** Хроматические ступени от тоники для нот вне гаммы */
const CHROMATIC_DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'].map(
  parseDegree,
)

export interface PitchInScale {
  note: SpelledNote
  degree: Degree
  /** null — нота вне гаммы */
  role: NoteRole | null
}

/**
 * Описание высоты относительно гаммы: написание, ступень, роль.
 * Нота вне гаммы пишется по хроматической ступени от тоники: в ми миноре G♯ — «3», а не A♭.
 */
export function describePitch(scale: Scale, midi: number): PitchInScale {
  const pitchClass = mod(Math.round(midi), 12)
  const inScale = scaleNoteByChroma(scale, pitchClass)
  if (inScale) return inScale
  const degree = CHROMATIC_DEGREES[mod(pitchClass - chroma(scale.tonic), 12)]!
  return { note: transpose(scale.tonic, degree), degree, role: null }
}

export type LabelKind = 'notes' | 'degrees' | 'intervals'

export function pitchLabel(pitch: Pick<PitchInScale, 'note' | 'degree'>, kind: LabelKind): string {
  if (kind === 'degrees') return formatDegree(pitch.degree)
  if (kind === 'intervals') return intervalName(pitch.degree)
  return formatNote(pitch.note)
}

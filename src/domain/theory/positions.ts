import { pitchClass } from '@/domain/music/pitch'
import type { Tuning } from '@/domain/music/tunings'
import { MAX_FRETS } from './fretboard'
import { chroma } from './notes'
import type { Scale } from './scales'

// Позиции гамм на грифе.
//  • Боксы: пентатоники — 5 боксов по 2 ноты на струну, семиступенные — 7 позиций по 3 ноты на струну,
//    блюзовая — боксы минорной пентатоники + блюзовая нота. Считаются от высоты нот, а не по таблице:
//    сдвиг на струне B, 7 струн и drop-строи учитываются сами.
//  • CAGED: 5 форм аккорда тоники с нотами гаммы вокруг; только для стандартных интервалов между струнами.

export type PositionSystem = 'boxes' | 'caged'

export interface Cell {
  /** Индекс струны от самой низкой */
  stringIndex: number
  fret: number
}

export interface ScalePosition {
  /** Номер позиции, с 1 */
  number: number
  /** Название: «Бокс 1», «Форма E» */
  label: string
  cells: Cell[]
  /** Ноты формы аккорда (только CAGED) */
  shape: Cell[]
  minFret: number
  maxFret: number
}

export const cellKey = (c: Cell) => `${c.stringIndex}:${c.fret}`

function span(cells: readonly Cell[]): { minFret: number; maxFret: number } {
  const frets = cells.map((c) => c.fret)
  return { minFret: Math.min(...frets), maxFret: Math.max(...frets) }
}

/** Высоты гаммы (MIDI) от from включительно, по возрастанию, до limit */
function scaleRunFrom(scale: Scale, from: number, limit: number): number[] {
  const classes = new Set(scale.notes.map((n) => chroma(n.note)))
  const run: number[] = []
  for (let m = from; m <= limit; m++) if (classes.has(pitchClass(m))) run.push(m)
  return run
}

/** Позиции «N нот на струну»: позиция k начинается с k-й ступени от тоники на самой низкой струне */
function notesPerStringPositions(tuning: Tuning, scale: Scale, perString: number): ScalePosition[] {
  const opens = tuning.strings.map((s) => s.midi)
  const lowest = opens[0]!
  const tonicFret = (chroma(scale.tonic) - pitchClass(lowest) + 12) % 12
  const degrees = scale.notes.length
  const positions: ScalePosition[] = []

  for (let k = 0; k < degrees; k++) {
    const start = scaleRunFrom(scale, lowest + tonicFret, lowest + tonicFret + 24)[k]!
    const run = scaleRunFrom(scale, start, start + 72)
    let cells: Cell[] = []
    let string = 0
    let onString = 0
    for (const midi of run) {
      // Струна заполнена — переходим на следующую, если нота там не ниже порожка;
      // иначе нота остаётся на текущей струне (как в открытых позициях)
      if (onString >= perString && string < opens.length - 1 && midi - opens[string + 1]! >= 0) {
        string++
        onString = 0
      }
      if (string === opens.length - 1 && onString >= perString) break
      cells.push({ stringIndex: string, fret: midi - opens[string]! })
      onString++
    }
    // Ниже порожка — та же позиция октавой выше
    if (cells.some((c) => c.fret < 0)) cells = cells.map((c) => ({ ...c, fret: c.fret + 12 }))
    // Слишком высоко — октавой ниже, если помещается
    if (cells.some((c) => c.fret > MAX_FRETS) && cells.every((c) => c.fret >= 12)) {
      cells = cells.map((c) => ({ ...c, fret: c.fret - 12 }))
    }
    if (cells.some((c) => c.fret < 0 || c.fret > MAX_FRETS)) continue
    positions.push({
      number: k + 1,
      label: `${perString === 2 ? 'Бокс' : 'Позиция'} ${k + 1}`,
      cells,
      shape: [],
      ...span(cells),
    })
  }
  return positions
}

/**
 * Добавляет к позициям ноты гаммы на струне в пределах её ладов позиции и на лад выше
 * (блюзовая нота: в боксе 1 ля-блюза — 6-й лад на 5-й струне и 8-й на 3-й)
 */
function withExtraNotes(tuning: Tuning, scale: Scale, positions: ScalePosition[]): ScalePosition[] {
  const classes = new Set(scale.notes.map((n) => chroma(n.note)))
  return positions.map((position) => {
    const cells = [...position.cells]
    tuning.strings.forEach((string, s) => {
      const frets = position.cells.filter((c) => c.stringIndex === s).map((c) => c.fret)
      if (!frets.length) return
      for (let f = Math.min(...frets); f <= Math.max(...frets) + 1; f++) {
        if (classes.has(pitchClass(string.midi + f)) && !frets.includes(f))
          cells.push({ stringIndex: s, fret: f })
      }
    })
    cells.sort((a, b) => a.stringIndex - b.stringIndex || a.fret - b.fret)
    return { ...position, cells }
  })
}

export function boxPositions(tuning: Tuning, scale: Scale): ScalePosition[] {
  const id = scale.type.id
  if (id === 'blues') {
    // Боксы минорной пентатоники от той же тоники + блюзовая нота
    const pentatonic: Scale = {
      ...scale,
      notes: scale.notes.filter((n) => !(n.degree.number === 5 && n.degree.alt === -1)),
    }
    return withExtraNotes(tuning, scale, notesPerStringPositions(tuning, pentatonic, 2))
  }
  return notesPerStringPositions(tuning, scale, scale.notes.length <= 5 ? 2 : 3)
}

// --- CAGED ---

/** Интервалы между соседними струнами стандартного строя (6→1): кварты и большая терция G→B */
const STANDARD_INTERVALS = [5, 5, 5, 4, 5]

/** CAGED доступен, если верхние 6 струн настроены стандартными интервалами (E, E♭, 7-струнный B …) */
export function supportsCaged(tuning: Tuning): boolean {
  const top = tuning.strings.slice(-6).map((s) => s.midi)
  return (
    top.length === 6 &&
    top.every((m, i) => i === 0 || m - top[i - 1]! === STANDARD_INTERVALS[i - 1])
  )
}

interface ShapeDef {
  name: string
  /** Струна тоники: номер в группе верхних шести (6 — самая низкая из них) */
  rootString: 6 | 5 | 4
  /** Смещение ладов от тоники для струн 6…1; null — струна не играется */
  offsets: (number | null)[]
}

const MAJOR_SHAPES: ShapeDef[] = [
  { name: 'C', rootString: 5, offsets: [null, 0, -1, -3, -2, -3] },
  { name: 'A', rootString: 5, offsets: [null, 0, 2, 2, 2, 0] },
  { name: 'G', rootString: 6, offsets: [0, -1, -3, -3, -3, 0] },
  { name: 'E', rootString: 6, offsets: [0, 2, 2, 1, 0, 0] },
  { name: 'D', rootString: 4, offsets: [null, null, 0, 2, 3, 2] },
]

const MINOR_SHAPES: ShapeDef[] = [
  { name: 'Cm', rootString: 5, offsets: [null, 0, -2, -3, -2, 0] },
  { name: 'Am', rootString: 5, offsets: [null, 0, 2, 2, 1, 0] },
  { name: 'Gm', rootString: 6, offsets: [0, -2, -3, -3, 0, 0] },
  { name: 'Em', rootString: 6, offsets: [0, 2, 2, 0, 0, 0] },
  { name: 'Dm', rootString: 4, offsets: [null, null, 0, 2, 3, 1] },
]

/** Ширина бокса гаммы вокруг формы аккорда, лады */
const CAGED_BOX = 4

export function cagedPositions(tuning: Tuning, scale: Scale): ScalePosition[] {
  if (!supportsCaged(tuning)) return []
  const shapes = scale.type.quality === 'major' ? MAJOR_SHAPES : MINOR_SHAPES
  const top = tuning.strings.length - 6 // индекс 6-й струны группы
  const classes = new Set(scale.notes.map((n) => chroma(n.note)))
  const tonic = chroma(scale.tonic)

  const positions = shapes.flatMap((shape) => {
    const rootIndex = top + (6 - shape.rootString)
    const rootOpen = tuning.strings[rootIndex]!.midi
    let root = (tonic - pitchClass(rootOpen) + 12) % 12
    // Форма должна целиком лечь на гриф (без отрицательных ладов)
    const lowest = Math.min(...shape.offsets.filter((o): o is number => o !== null))
    if (root + lowest < 0) root += 12
    const shapeCells: Cell[] = shape.offsets.flatMap((offset, i) =>
      offset === null ? [] : [{ stringIndex: top + i, fret: root + offset }],
    )
    const { minFret } = span(shapeCells)
    // Бокс гаммы: от минимального лада формы на ширину бокса, но не уже самой формы
    const from = Math.max(0, minFret - (minFret > 0 ? 1 : 0))
    const to = Math.max(from + CAGED_BOX, span(shapeCells).maxFret)
    const cells: Cell[] = []
    tuning.strings.forEach((string, s) => {
      for (let f = from; f <= to; f++)
        if (classes.has(pitchClass(string.midi + f))) cells.push({ stringIndex: s, fret: f })
    })
    if (cells.some((c) => c.fret > MAX_FRETS)) return []
    return [{ shape: shape.name, cells, shapeCells, ...span(cells) }]
  })

  // По грифу снизу вверх: C-A-G-E-D идут по кругу, начинаем с той, что ниже всех
  return positions
    .sort((a, b) => a.minFret - b.minFret)
    .map((p, i) => ({
      number: i + 1,
      label: `Форма ${p.shape}`,
      cells: p.cells,
      shape: p.shapeCells,
      minFret: p.minFret,
      maxFret: p.maxFret,
    }))
}

export function scalePositions(
  tuning: Tuning,
  scale: Scale,
  system: PositionSystem,
): ScalePosition[] {
  return system === 'caged' ? cagedPositions(tuning, scale) : boxPositions(tuning, scale)
}

/** Ноты позиции по возрастанию высоты — для упражнения (с позициями на грифе) */
export function positionRun(
  tuning: Tuning,
  position: ScalePosition,
): { midi: number; cell: Cell }[] {
  return position.cells
    .map((cell) => ({ midi: tuning.strings[cell.stringIndex]!.midi + cell.fret, cell }))
    .sort((a, b) => a.midi - b.midi || a.cell.stringIndex - b.cell.stringIndex)
    .filter((item, i, all) => i === 0 || item.midi !== all[i - 1]!.midi)
}

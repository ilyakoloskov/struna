// Геометрия дорожки в мировых координатах сцены.
// Линия удара — z = 0, дорожка уходит в −z. Струны слева направо — от самой низкой к высокой,
// как на макете и как гитара лежит перед игроком.

export interface LaneLayout {
  stringCount: number
  /** Расстояние между струнами, мировые единицы */
  stringSpacing: number
  /** Длина видимой части дорожки от линии удара, мировые единицы */
  length: number
  /** Сколько секунд вперёд видно — задаёт скорость нот */
  lookahead: number
  /** Сколько секунд нота ещё видна после линии удара */
  behind: number
}

export const DEFAULT_LOOKAHEAD = 2.2

export function createLayout(stringCount: number, lookahead = DEFAULT_LOOKAHEAD): LaneLayout {
  // Пропорции макета: ширина 672 px на 7 струн, длина 1700 px → длина ≈ 2.5 ширины 7-струнной дорожки
  return { stringCount, stringSpacing: 1, length: 17.5, lookahead, behind: 0.25 }
}

/** Скорость нот, мировых единиц в секунду */
export function laneSpeed(layout: LaneLayout): number {
  return layout.length / layout.lookahead
}

export function laneWidth(layout: LaneLayout): number {
  return layout.stringCount * layout.stringSpacing
}

/** x центра струны (stringIndex от самой низкой) */
export function stringX(stringIndex: number, layout: LaneLayout): number {
  return (stringIndex - (layout.stringCount - 1) / 2) * layout.stringSpacing
}

/** z момента времени: 0 — на линии удара, отрицательные — впереди */
export function timeToZ(time: number, songTime: number, layout: LaneLayout): number {
  return -(time - songTime) * laneSpeed(layout)
}

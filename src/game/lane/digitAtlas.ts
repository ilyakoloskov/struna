// Атлас глифов дорожки: номера ладов 0…24 и знаки приёмов — одна текстура, каждая надпись в своей ячейке.
// Шейдер берёт нужную ячейку по UV — текст без отдельной библиотеки и без лишних вызовов отрисовки.

export const ATLAS_COLUMNS = 8
export const ATLAS_ROWS = 5
export const ATLAS_MAX = 24

/** Знаки приёмов — после цифр 0…24 */
export const GLYPH = {
  dead: 25, // ×
  bendHalf: 26, // ↑½ — бенд на полтона
  bendFull: 27, // ↑1 — на тон
  bendOneHalf: 28, // ↑1½
  bendTwo: 29, // ↑2
  hammer: 30, // h
  pull: 31, // p
  palmMute: 32, // PM
  slideUp: 33, // ↗
  slideDown: 34, // ↘
  vibrato: 35, // ~
  release: 36, // ↓ — отпускание бенда
} as const

/** Надписи ячеек атласа по порядку */
export const GLYPH_TEXT: readonly string[] = [
  ...Array.from({ length: ATLAS_MAX + 1 }, (_, n) => String(n)),
  '×',
  '↑½',
  '↑1',
  '↑1½',
  '↑2',
  'h',
  'p',
  'PM',
  '↗',
  '↘',
  '~',
  '↓',
]

export const GLYPH_COUNT = GLYPH_TEXT.length

export interface UvRect {
  u0: number
  v0: number
  u1: number
  v1: number
}

/** UV-прямоугольник ячейки глифа (v снизу вверх, как в WebGL) */
export function glyphCell(index: number): UvRect {
  const n = Math.max(0, Math.min(GLYPH_COUNT - 1, Math.round(index)))
  const column = n % ATLAS_COLUMNS
  const row = Math.floor(n / ATLAS_COLUMNS)
  const width = 1 / ATLAS_COLUMNS
  const height = 1 / ATLAS_ROWS
  return {
    u0: column * width,
    u1: (column + 1) * width,
    v1: 1 - row * height,
    v0: 1 - (row + 1) * height,
  }
}

/** Ячейка номера лада (0…24) */
export function digitCell(fret: number): UvRect {
  return glyphCell(Math.max(0, Math.min(ATLAS_MAX, Math.round(fret))))
}

/** Таблица UV всех глифов (u0, v0, u1, v1 подряд) — для цикла кадра без аллокаций */
export const GLYPH_UVS: Float32Array = (() => {
  const table = new Float32Array(GLYPH_COUNT * 4)
  for (let n = 0; n < GLYPH_COUNT; n++) {
    const c = glyphCell(n)
    table.set([c.u0, c.v0, c.u1, c.v1], n * 4)
  }
  return table
})()

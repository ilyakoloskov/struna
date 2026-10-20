// Атлас номеров ладов 0…24: одна текстура, в которой каждая цифра — своя ячейка.
// Шейдер нот берёт нужную ячейку по UV — текст без отдельной библиотеки и без лишних вызовов отрисовки.

export const ATLAS_COLUMNS = 8
export const ATLAS_ROWS = 4
export const ATLAS_MAX = 24

export interface UvRect {
  u0: number
  v0: number
  u1: number
  v1: number
}

/** UV-прямоугольник ячейки числа (v снизу вверх, как в WebGL) */
export function digitCell(value: number): UvRect {
  const n = Math.max(0, Math.min(ATLAS_MAX, Math.round(value)))
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

/** Таблица UV всех чисел (u0, v0, u1, v1 подряд) — для цикла кадра без аллокаций */
export const DIGIT_UVS: Float32Array = (() => {
  const table = new Float32Array((ATLAS_MAX + 1) * 4)
  for (let n = 0; n <= ATLAS_MAX; n++) {
    const c = digitCell(n)
    table.set([c.u0, c.v0, c.u1, c.v1], n * 4)
  }
  return table
})()

import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from 'three'
import { ATLAS_COLUMNS, ATLAS_ROWS, GLYPH_TEXT } from '../lane/digitAtlas'

const CELL = 128
/** Толщина тёмной обводки глифа, px ячейки */
const OUTLINE = 16
/** Размер шрифта для глифов с мелким рисунком */
const GLYPH_SIZE: Record<string, number> = { '×': 104, '~': 112 }

/**
 * Рисует атлас глифов шрифтом Unbounded. Каналы: альфа — глиф с обводкой,
 * зелёный — только сам глиф (обводка красная). Шейдер делает белую надпись с тёмной обводкой.
 */
export async function createDigitTexture(): Promise<CanvasTexture> {
  // Ждём шрифт, иначе надписи нарисуются системным
  await document.fonts.load('800 80px Unbounded').catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = CELL * ATLAS_COLUMNS
  canvas.height = CELL * ATLAS_ROWS
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  GLYPH_TEXT.forEach((text, n) => {
    const column = n % ATLAS_COLUMNS
    const row = Math.floor(n / ATLAS_COLUMNS)
    // Длинные надписи — уже, чтобы поместились в ячейку; у × и ~ рисунок мелкий — крупнее
    const size = GLYPH_SIZE[text] ?? (text.length >= 3 ? 46 : text.length === 2 ? 58 : 76)
    // Стрелок нет в Unbounded — запасной системный
    ctx.font = `800 ${size}px Unbounded, system-ui, sans-serif`
    const x = column * CELL + CELL / 2
    const y = row * CELL + CELL / 2 + 4
    ctx.lineWidth = OUTLINE
    ctx.strokeStyle = 'rgb(255, 0, 0)'
    ctx.strokeText(text, x, y)
    ctx.fillStyle = 'rgb(255, 255, 255)'
    ctx.fillText(text, x, y)
  })

  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4
  return texture
}

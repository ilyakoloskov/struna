import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from 'three'
import { ATLAS_COLUMNS, ATLAS_MAX, ATLAS_ROWS } from '../lane/digitAtlas'

const CELL = 128

/** Рисует атлас номеров ладов шрифтом Unbounded; цвет задаёт шейдер, здесь важна только альфа */
export async function createDigitTexture(): Promise<CanvasTexture> {
  // Ждём шрифт, иначе цифры нарисуются системным
  await document.fonts.load('800 80px Unbounded').catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = CELL * ATLAS_COLUMNS
  canvas.height = CELL * ATLAS_ROWS
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let n = 0; n <= ATLAS_MAX; n++) {
    const column = n % ATLAS_COLUMNS
    const row = Math.floor(n / ATLAS_COLUMNS)
    // Двузначные — уже, чтобы поместились в ячейку
    ctx.font = `800 ${n >= 10 ? 62 : 76}px Unbounded, sans-serif`
    ctx.fillText(String(n), column * CELL + CELL / 2, row * CELL + CELL / 2 + 4)
  }

  const texture = new CanvasTexture(canvas)
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 4
  return texture
}

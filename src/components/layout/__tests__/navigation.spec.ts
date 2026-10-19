import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, isSectionActive } from '../navigation'

describe('isSectionActive', () => {
  it('совпадает с самим префиксом и вложенными путями', () => {
    expect(isSectionActive('/theory', ['/theory'])).toBe(true)
    expect(isSectionActive('/theory/fretboard', ['/theory'])).toBe(true)
  })

  it('не путает разделы с похожим началом', () => {
    expect(isSectionActive('/theoryx', ['/theory'])).toBe(false)
    expect(isSectionActive('/', ['/library'])).toBe(false)
  })

  it('«Играть» активен в библиотеке, игре и результатах', () => {
    const play = NAV_ITEMS.find((item) => item.label === 'Играть')!
    for (const path of ['/library', '/play/42', '/results/abc']) {
      expect(isSectionActive(path, play.sections)).toBe(true)
    }
  })
})

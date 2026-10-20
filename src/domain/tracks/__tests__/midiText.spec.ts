import { describe, expect, it } from 'vitest'
import { decodeMidiText } from '../midiText'

/** Как @tonejs/midi читает байты: каждый байт — символ Latin-1 */
const asLatin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes)

describe('decodeMidiText', () => {
  it('ASCII не трогаем', () => {
    expect(decodeMidiText('Guitar Lead')).toBe('Guitar Lead')
  })

  it('UTF-8', () => {
    expect(decodeMidiText(asLatin1(new TextEncoder().encode('Гитара соло')))).toBe('Гитара соло')
  })

  it('Windows-1251', () => {
    // «Бас» в cp1251: C1 E0 F1
    expect(decodeMidiText(asLatin1(new Uint8Array([0xc1, 0xe0, 0xf1])))).toBe('Бас')
  })

  it('Latin-1 без кириллицы остаётся как есть', () => {
    // «Gitarre Ü» в Latin-1: не UTF-8 и не похоже на русский текст
    expect(decodeMidiText('Gitarre Über')).toBe('Gitarre Über')
  })

  it('уже декодированный текст не портим', () => {
    expect(decodeMidiText('Барабаны')).toBe('Барабаны')
  })
})

// Текст в MIDI (названия трека и дорожек) — байты без указания кодировки,
// а @tonejs/midi читает их как Latin-1: русские названия превращаются в «Ð¢ÐµÑ…».
// Восстанавливаем: сначала UTF-8, затем Windows-1251 — если получилась кириллица.

const CYRILLIC = /[Ѐ-ӿ]/g

export function decodeMidiText(text: string): string {
  // Уже нормальные символы за пределами байта — ничего не делаем
  if ([...text].some((c) => c.charCodeAt(0) > 0xff)) return text
  const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0))
  if (bytes.every((b) => b < 0x80)) return text

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // не UTF-8
  }

  try {
    const cp1251 = new TextDecoder('windows-1251').decode(bytes)
    const highBytes = bytes.filter((b) => b >= 0x80).length
    const cyrillic = cp1251.match(CYRILLIC)?.length ?? 0
    // Слово из латиницы и кириллицы вперемешку («Ьber») — это не русский текст, а Latin-1
    const mixedWord = cp1251
      .split(/[^\p{L}]+/u)
      .some((word) => /[A-Za-z]/.test(word) && /[\u0400-\u04ff]/.test(word))
    // Большинство «старших» байтов стали кириллицей — значит, это Windows-1251
    if (!mixedWord && cyrillic >= highBytes * 0.6) return cp1251
  } catch {
    // кодировка недоступна
  }
  return text
}

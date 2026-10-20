/** Телефон или планшет: грубый указатель и тач — звук обычно с микрофона, задержка больше */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0
}

// Форматирование времени трека

/** «1:24» */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** «0:01.250» — для списка нот */
export function formatPrecise(seconds: number): string {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const minutes = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

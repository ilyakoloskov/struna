// Один AudioContext на всё приложение: вход с гитары, синтезатор и воспроизведение трека
// живут на одних часах — это упрощает синхронизацию сыгранного с нотами трека в игре.

let context: AudioContext | null = null

export function getAudioContext(): AudioContext {
  context ??= new AudioContext({ latencyHint: 'interactive' })
  return context
}

/** Без жеста пользователя resume() может не завершиться никогда (политика автозапуска) */
const RESUME_WAIT_MS = 300

/** Пытается запустить контекст; true — работает, false — нужен жест пользователя */
export async function resumeAudioContext(): Promise<boolean> {
  const ctx = getAudioContext()
  if (isRunning(ctx)) return true
  await Promise.race([ctx.resume(), new Promise((resolve) => setTimeout(resolve, RESUME_WAIT_MS))])
  // Состояние могло измениться за время ожидания — проверяем заново
  return isRunning(ctx)
}

function isRunning(ctx: AudioContext): boolean {
  return ctx.state === 'running'
}

import { onBeforeUnmount, watch, type Ref } from 'vue'

/**
 * Screen Wake Lock: пока active — экран не гаснет (во время игры руки на гитаре).
 * Браузер снимает блокировку при скрытии вкладки — при возвращении берём заново.
 */
export function useWakeLock(active: Ref<boolean>) {
  let sentinel: WakeLockSentinel | null = null

  async function acquire() {
    if (!('wakeLock' in navigator) || sentinel || document.hidden) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => (sentinel = null))
    } catch {
      // Не разрешено (энергосбережение, политика) — играем без блокировки
    }
  }

  async function release() {
    const current = sentinel
    sentinel = null
    await current?.release().catch(() => undefined)
  }

  function onVisibility() {
    if (!document.hidden && active.value) void acquire()
  }

  watch(active, (on) => void (on ? acquire() : release()), { immediate: true })
  document.addEventListener('visibilitychange', onVisibility)

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    void release()
  })
}

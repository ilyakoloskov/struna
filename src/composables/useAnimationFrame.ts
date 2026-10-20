import { onBeforeUnmount, onMounted } from 'vue'

/** Колбэк на каждый кадр отрисовки, пока компонент смонтирован; dt — мс с прошлого кадра */
export function useAnimationFrame(callback: (dt: number) => void) {
  let handle = 0
  let last = 0

  function loop(time: number) {
    const dt = last ? time - last : 16
    last = time
    callback(dt)
    handle = requestAnimationFrame(loop)
  }

  onMounted(() => {
    handle = requestAnimationFrame(loop)
  })

  onBeforeUnmount(() => {
    cancelAnimationFrame(handle)
  })
}

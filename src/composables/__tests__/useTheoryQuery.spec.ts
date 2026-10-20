import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { routes } from '@/router/routes'
import { useSettingsStore } from '@/stores/settings'
import { useTheoryStore } from '@/stores/theory'

async function mountAt(path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  mount(App, { global: { plugins: [router, pinia] } })
  await flushPromises()
  return { router, theory: useTheoryStore(), settings: useSettingsStore() }
}

describe('useTheoryQuery', () => {
  beforeEach(() => localStorage.clear())

  it('ссылка задаёт тональность, лад, подписи и общий строй', async () => {
    const { theory, settings } = await mountAt(
      '/theory/fretboard?key=F%23&mode=dorian&labels=degrees&frets=5-12&tuning=7-drop-a',
    )
    expect(theory.tonic).toEqual({ letter: 'F', alt: 1 })
    expect(theory.scaleId).toBe('dorian')
    expect(theory.labels).toBe('degrees')
    expect(theory.fretRange).toEqual({ from: 5, to: 12 })
    expect(settings.tuningId).toBe('7-drop-a')
  })

  it('выбор в сторе попадает в URL', async () => {
    const { router, theory } = await mountAt('/theory/circle')
    theory.selectKey({ tonic: { letter: 'B', alt: -1 }, quality: 'minor' })
    await flushPromises()
    expect(router.currentRoute.value.query).toMatchObject({ key: 'Bb', mode: 'aeolian' })
  })

  it('некорректные параметры заменяются текущим выбором', async () => {
    const { router } = await mountAt('/theory/fretboard?key=H&mode=jazz&tuning=nope&utm=x')
    expect(router.currentRoute.value.query).toEqual({
      key: 'E',
      mode: 'ionian',
      tuning: '7-standard-b',
      utm: 'x',
    })
  })

  it('свой строй переживает ссылку', async () => {
    const { settings } = await mountAt('/theory/fretboard?tuning=custom-C2-G2-C3-F3-A3-D4')
    expect(settings.tuningId).toBe('custom')
    expect(settings.customMidis).toEqual([36, 43, 48, 53, 57, 62])
  })
})

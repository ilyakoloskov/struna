import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '../routes'

function makeRouter() {
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('routes', () => {
  it.each([
    ['/', 'home'],
    ['/library', 'library'],
    ['/play/track-1', 'play'],
    ['/results/session-1', 'results'],
    ['/tuner', 'tuner'],
    ['/theory/circle', 'theory-circle'],
    ['/theory/fretboard', 'theory-fretboard'],
    ['/settings', 'settings'],
    ['/unknown/path', 'not-found'],
  ])('%s → %s', async (path, name) => {
    const router = makeRouter()
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
  })

  it('/theory перенаправляет на квинтовый круг', async () => {
    const router = makeRouter()
    await router.push('/theory')
    expect(router.currentRoute.value.name).toBe('theory-circle')
  })

  it('query-параметры теории сохраняются', async () => {
    const router = makeRouter()
    await router.push('/theory/fretboard?key=E&mode=phrygian&tuning=7-standard-b')
    expect(router.currentRoute.value.query).toEqual({
      key: 'E',
      mode: 'phrygian',
      tuning: '7-standard-b',
    })
  })

  it('только экран игры полноэкранный', async () => {
    const router = makeRouter()
    await router.push('/play/1')
    expect(router.currentRoute.value.meta.fullscreen).toBe(true)
    await router.push('/tuner')
    expect(router.currentRoute.value.meta.fullscreen).toBeFalsy()
  })

  it('все страницы загружаются лениво', () => {
    const components = makeRouter()
      .getRoutes()
      .map((record) => record.components?.default)
      .filter(Boolean)
    expect(components.length).toBeGreaterThan(0)
    for (const component of components) {
      expect(typeof component).toBe('function')
    }
  })
})

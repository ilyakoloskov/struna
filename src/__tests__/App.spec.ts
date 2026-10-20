import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import App from '../App.vue'
import { routes } from '../router/routes'

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  const wrapper = mount(App, { global: { plugins: [router, createPinia()] } })
  await flushPromises()
  return wrapper
}

describe('App layout', () => {
  it('показывает навигацию на обычных страницах', async () => {
    const wrapper = await mountAt('/tuner')
    const links = wrapper.findAll('.nav__link').map((link) => link.text())
    expect(links).toEqual(['Играть', 'Тюнер', 'Теория'])
    expect(wrapper.find('.nav__link--active').text()).toBe('Тюнер')
  })

  it('скрывает навигацию на экране игры', async () => {
    const wrapper = await mountAt('/play/1')
    expect(wrapper.find('.nav').exists()).toBe(false)
  })
})

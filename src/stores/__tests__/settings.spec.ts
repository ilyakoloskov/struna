import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../settings'

const KEY = 'struna:settings:v1'

describe('settings: своя партия в игре', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('по умолчанию звучит', () => {
    expect(useSettingsStore().hearGuitarPart).toBe(true)
  })

  it('выбор сохраняется и читается при следующем запуске', async () => {
    useSettingsStore().hearGuitarPart = false
    await nextTick()
    expect(JSON.parse(localStorage.getItem(KEY)!).hearGuitarPart).toBe(false)
    setActivePinia(createPinia())
    expect(useSettingsStore().hearGuitarPart).toBe(false)
  })

  it('старые настройки без поля — звучит', () => {
    localStorage.setItem(KEY, JSON.stringify({ tuningId: '6-standard-e' }))
    expect(useSettingsStore().hearGuitarPart).toBe(true)
  })
})

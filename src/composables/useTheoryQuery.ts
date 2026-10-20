import { watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  decodeTuningParam,
  encodeTuningParam,
  parseTheoryQuery,
  toTheoryQuery,
  type QueryValue,
} from '@/domain/theory/selection'
import { useSettingsStore } from '@/stores/settings'
import { useTheoryStore } from '@/stores/theory'

const OWN_PARAMS = new Set(['key', 'mode', 'labels', 'frets', 'tuning'])

/**
 * Двусторонняя синхронизация выбора теории (тональность, лад, подписи, лады, строй) с URL.
 * URL → стор при каждом переходе; стор → URL через router.replace, без записей в истории.
 */
export function useTheoryQuery() {
  const route = useRoute()
  const router = useRouter()
  const theory = useTheoryStore()
  const settings = useSettingsStore()
  const { selection } = storeToRefs(theory)
  const { tuningId, customMidis } = storeToRefs(settings)

  watch(
    () => route.query,
    (query) => {
      theory.apply(parseTheoryQuery(query))
      // Строй — общий для приложения: ссылка переключает его везде
      const tuning = decodeTuningParam(query.tuning)
      if (tuning) {
        if (tuning.customMidis) settings.setCustomMidis(tuning.customMidis)
        tuningId.value = tuning.tuningId
      }
    },
    { immediate: true },
  )

  watch(
    [selection, tuningId, customMidis],
    () => {
      // Свои параметры пересобираем целиком (умолчания не пишем), чужие — сохраняем
      const others = Object.fromEntries(
        Object.entries(route.query).filter(([k]) => !OWN_PARAMS.has(k)),
      )
      const next: Record<string, QueryValue> = {
        ...others,
        ...toTheoryQuery(selection.value),
        tuning: encodeTuningParam({ tuningId: tuningId.value, customMidis: customMidis.value }),
      }
      const keys = new Set([...Object.keys(next), ...Object.keys(route.query)])
      const changed = [...keys].some((k) => route.query[k] !== next[k])
      if (changed) void router.replace({ query: next as LocationQueryRaw })
    },
    { immediate: true, deep: true },
  )
}

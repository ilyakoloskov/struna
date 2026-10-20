<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import PageContainer from '@/components/layout/PageContainer.vue'
import CalibrationPanel from '@/components/settings/CalibrationPanel.vue'
import CustomTuningEditor from '@/components/tuner/CustomTuningEditor.vue'
import LevelMeter from '@/components/tuner/LevelMeter.vue'
import MobileNotice from '@/components/ui/MobileNotice.vue'
import SelectField from '@/components/ui/SelectField.vue'
import { TUNING_OPTIONS } from '@/components/ui/tuningOptions'
import type { SelectOption } from '@/components/ui/types'
import { useAudioInput } from '@/composables/useAudioInput'
import { LOOKAHEAD_RANGE, useSettingsStore } from '@/stores/settings'

// Настройки: вход звука, строй, калибровка задержки, вид
const settings = useSettingsStore()
const { tuningId, customMidis, a4, noteLookahead, strictChords } = storeToRefs(settings)
const input = useAudioInput()

const deviceOptions = computed<SelectOption<string>[]>(() => [
  { value: '', label: 'Вход по умолчанию' },
  ...input.devices.value
    .filter((d) => d.id !== 'default' && d.id !== '')
    .map((d) => ({ value: d.id, label: d.label })),
])
const deviceId = computed({
  get: () => input.selectedDeviceId.value ?? '',
  set: (value: string) => {
    input.selectedDeviceId.value = value || null
  },
})

const customModel = computed({
  get: () => customMidis.value,
  set: (value: number[]) => settings.setCustomMidis(value),
})

const a4Options: SelectOption<number>[] = Array.from({ length: 21 }, (_, i) => 430 + i).map(
  (hz) => ({ value: hz, label: `${hz} Гц${hz === 440 ? ' · стандарт' : ''}` }),
)

/** Ползунок «скорость нот»: вправо — быстрее, т.е. меньше секунд впереди */
const speed = computed({
  get: () => LOOKAHEAD_RANGE.max + LOOKAHEAD_RANGE.min - noteLookahead.value,
  set: (value: number) => {
    noteLookahead.value = Math.round((LOOKAHEAD_RANGE.max + LOOKAHEAD_RANGE.min - value) * 10) / 10
  },
})
</script>

<template>
  <PageContainer>
    <header class="head">
      <div class="caps-label">Настройки</div>
      <h1 class="head__title">Настройки</h1>
    </header>

    <div class="grid">
      <section class="panel">
        <h2 class="panel__title">Вход звука</h2>
        <SelectField
          v-model="deviceId"
          label="Устройство ввода"
          :options="deviceOptions"
          :disabled="input.status.value !== 'running'"
        />
        <LevelMeter :peak-db="input.peakDb.value" :active="input.status.value === 'running'" />
        <button
          v-if="input.status.value !== 'running'"
          type="button"
          class="btn btn--primary"
          @click="input.start()"
        >
          {{ input.status.value === 'starting' ? 'Подключаю…' : 'Подключить гитару' }}
        </button>
        <MobileNotice />
      </section>

      <section class="panel">
        <h2 class="panel__title">Строй</h2>
        <SelectField v-model="tuningId" label="Строй гитары" :options="TUNING_OPTIONS" accent />
        <CustomTuningEditor v-if="tuningId === 'custom'" v-model="customModel" />
        <SelectField v-model="a4" label="Частота ля первой октавы (A4)" :options="a4Options" />
      </section>

      <CalibrationPanel :input-status="input.status.value" @connect="input.start()" />

      <section class="panel">
        <h2 class="panel__title">Вид</h2>
        <label class="slider">
          <span class="caps-label">
            Скорость нот · видно на {{ noteLookahead.toLocaleString('ru-RU') }} с вперёд
          </span>
          <input
            v-model.number="speed"
            type="range"
            :min="LOOKAHEAD_RANGE.min"
            :max="LOOKAHEAD_RANGE.max"
            step="0.1"
            aria-label="Скорость нот"
          />
          <span class="slider__scale"><span>медленнее</span><span>быстрее</span></span>
        </label>
        <p class="panel__text">
          Анимации, тряска и вспышки отключаются, если в системе включено «Уменьшение движения».
        </p>
      </section>

      <section class="panel">
        <h2 class="panel__title">Игра</h2>
        <label class="switch">
          <input v-model="strictChords" type="checkbox" />
          <span class="switch__text">
            <b>Строгая проверка аккордов</b>
            <span>
              Аккорд засчитывается, только если прозвучал целиком: по спектру проверяется, что
              звучат именно его ноты (E мажор и E минор различаются). Выключи, если на твоей гитаре
              аккорды засчитываются плохо, — тогда хватит любой ноты аккорда.
            </span>
          </span>
        </label>
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.head {
  margin-bottom: 28px;
}

.head__title {
  margin-top: 6px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(32px, 4vw, 48px);
  color: var(--color-text-strong);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
  align-items: start;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.panel__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-strong);
}

.panel__text {
  font-size: 14px;
  color: var(--color-text-muted);
}

.btn {
  align-self: flex-start;
  height: 44px;
  padding: 0 20px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border-strong);
  background: transparent;
  font-weight: 700;
  color: var(--color-text);
}

.btn--primary {
  border-color: transparent;
  background: var(--color-text);
  color: var(--color-text-inverse);
}

.switch {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.switch input {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  accent-color: var(--color-accent);
}

.switch__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: var(--color-text-muted);
}

.switch__text b {
  color: var(--color-text-strong);
}

.slider {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider input {
  accent-color: var(--color-accent);
}

.slider__scale {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-dim);
}
</style>

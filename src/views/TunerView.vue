<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import PageContainer from '@/components/layout/PageContainer.vue'
import MobileNotice from '@/components/ui/MobileNotice.vue'
import SelectField from '@/components/ui/SelectField.vue'
import type { SelectOption } from '@/components/ui/types'
import { TUNING_OPTIONS } from '@/components/ui/tuningOptions'
import CentsMeter from '@/components/tuner/CentsMeter.vue'
import CustomTuningEditor from '@/components/tuner/CustomTuningEditor.vue'
import LevelMeter from '@/components/tuner/LevelMeter.vue'
import NoteDisplay from '@/components/tuner/NoteDisplay.vue'
import StringButtons from '@/components/tuner/StringButtons.vue'
import { useAudioInput } from '@/composables/useAudioInput'
import { usePitchDetector } from '@/composables/usePitchDetector'
import { computeTunerReading, formatCents, statusText } from '@/domain/tuner/reading'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { tuning, tuningId, customMidis } = storeToRefs(settings)

const input = useAudioInput()
const { pitch } = usePitchDetector()

const DEFAULT_DEVICE = ''
const deviceOptions = computed<SelectOption<string>[]>(() => [
  { value: DEFAULT_DEVICE, label: 'Вход по умолчанию' },
  ...input.devices.value
    .filter((d) => d.id !== 'default' && d.id !== '')
    .map((d) => ({ value: d.id, label: d.label })),
])
const deviceId = computed({
  get: () => input.selectedDeviceId.value ?? DEFAULT_DEVICE,
  set: (value: string) => {
    input.selectedDeviceId.value = value || null
  },
})

const customModel = computed({
  get: () => customMidis.value,
  set: (value: number[]) => settings.setCustomMidis(value),
})

// Закреплённая струна сбрасывается при смене строя
const lockedIndex = ref<number | null>(null)
watch(tuning, () => (lockedIndex.value = null))

function toggleLock(index: number) {
  lockedIndex.value = lockedIndex.value === index ? null : index
}

const reading = computed(() =>
  pitch.value ? computeTunerReading(pitch.value.midi, tuning.value, lockedIndex.value) : null,
)

const activeString = computed(() =>
  reading.value?.stringIndex != null ? tuning.value.strings[reading.value.stringIndex] : null,
)

const freqText = computed(() => {
  if (!pitch.value) return 'Сыграй открытую струну'
  const hz = pitch.value.freq.toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return activeString.value ? `${hz} Гц · ${activeString.value.number}-я струна` : `${hz} Гц`
})

const centsText = computed(() =>
  reading.value ? `${formatCents(reading.value.cents)} · ${statusText(reading.value.status)}` : '',
)

const isRunning = computed(() => input.status.value === 'running')

const ERROR_TEXT: Record<string, string> = {
  denied: 'Доступ к звуковому входу запрещён. Разреши его в настройках сайта и попробуй снова.',
  'not-found': 'Устройство ввода не найдено. Подключи звуковую карту и попробуй снова.',
  unsupported: 'Браузер не поддерживает захват звука. Открой STRUNA в Chrome или Edge.',
  unknown: 'Не удалось открыть звуковой вход.',
}
</script>

<template>
  <PageContainer>
    <div class="tuner">
      <aside class="tuner__side">
        <SelectField
          v-model="deviceId"
          label="Устройство ввода"
          :options="deviceOptions"
          :disabled="!isRunning"
        />
        <SelectField v-model="tuningId" label="Строй" :options="TUNING_OPTIONS" accent />
        <CustomTuningEditor v-if="tuningId === 'custom'" v-model="customModel" />
        <LevelMeter :peak-db="input.peakDb.value" :active="isRunning" />
        <MobileNotice />
        <RouterLink class="calibrate" :to="{ name: 'settings', hash: '#calibration' }">
          Калибровка задержки
        </RouterLink>
      </aside>

      <section class="tuner__main" aria-live="off">
        <div v-if="!isRunning" class="connect">
          <template v-if="input.status.value === 'error'">
            <p class="connect__text">{{ ERROR_TEXT[input.errorCode.value ?? 'unknown'] }}</p>
            <button
              v-if="input.errorCode.value !== 'unsupported'"
              type="button"
              class="connect__button"
              @click="input.start()"
            >
              Попробовать снова
            </button>
          </template>
          <template v-else-if="input.status.value === 'needs-gesture'">
            <p class="connect__text">Браузер приостановил звук до первого действия.</p>
            <button type="button" class="connect__button" @click="input.resume()">
              Продолжить
            </button>
          </template>
          <template v-else>
            <p class="connect__text">Подключи гитару к звуковой карте и разреши доступ к входу.</p>
            <button
              type="button"
              class="connect__button"
              :disabled="input.status.value === 'starting'"
              @click="input.start()"
            >
              {{ input.status.value === 'starting' ? 'Подключаю…' : 'Подключить вход' }}
            </button>
          </template>
        </div>

        <template v-else>
          <NoteDisplay
            :name="reading?.name ?? null"
            :octave="reading?.octave ?? null"
            :string-number="activeString?.number ?? null"
            :held="pitch?.held ?? false"
          />
          <div class="tuner__freq">{{ freqText }}</div>
          <CentsMeter
            :cents="reading?.cents ?? null"
            :status="reading?.status ?? null"
            :dimmed="!reading || pitch?.held"
          />
          <div class="tuner__cents" :class="reading && `tuner__cents--${reading.status}`">
            {{ centsText }}&nbsp;
          </div>
        </template>

        <StringButtons
          :strings="tuning.strings"
          :active-index="isRunning ? (reading?.stringIndex ?? null) : null"
          :locked-index="lockedIndex"
          @toggle="toggleLock"
        />
      </section>
    </div>
  </PageContainer>
</template>

<style scoped>
.tuner {
  display: flex;
  gap: 48px;
  min-height: calc(100dvh - var(--header-height) - 72px);
}

.tuner__side {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.calibrate {
  height: var(--control-height);
  border-radius: var(--radius-btn);
  border: 1px solid rgba(255, 176, 32, 0.6);
  background: rgba(255, 176, 32, 0.08);
  font-size: 15px;
  font-weight: 700;
  color: var(--grade-good-text);
}

.calibrate {
  display: grid;
  place-items: center;
}

.tuner__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
}

.tuner__freq {
  margin-top: -16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-soft);
}

.tuner__cents {
  min-height: 1.4em;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  color: var(--grade-perfect-text);
}

.tuner__cents--flat,
.tuner__cents--sharp {
  color: var(--grade-good-text);
}

.connect {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 460px;
  min-height: 420px;
  justify-content: center;
  text-align: center;
}

.connect__text {
  font-size: 18px;
  color: var(--color-text-soft);
}

.connect__button {
  height: 52px;
  padding: 0 28px;
  border: 0;
  border-radius: var(--radius-btn);
  background: var(--color-text);
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-inverse);
}

.connect__button:disabled {
  opacity: 0.6;
}

@media (max-width: 1100px) {
  .tuner {
    flex-direction: column;
  }

  .tuner__side {
    width: 100%;
    max-width: 520px;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { InputStatus } from '@/composables/useAudioInput'
import { useCalibration } from '@/composables/useCalibration'
import { LATENCY_OFFSET_LIMIT, useSettingsStore } from '@/stores/settings'

// Калибровка задержки: бьёшь по струне на каждый щелчок — поправка сохраняется
const props = defineProps<{ inputStatus: InputStatus }>()
const emit = defineEmits<{ connect: [] }>()

const { latencyOffsetMs } = storeToRefs(useSettingsStore())
const calibration = useCalibration()

const ready = computed(() => props.inputStatus === 'running')

const message = computed(() => {
  const outcome = calibration.outcome.value
  if (!outcome) return null
  if (outcome.ok) {
    const { offsetMs, spreadMs, used } = outcome.result
    return {
      ok: true,
      text: `Поправка ${offsetMs > 0 ? '+' : ''}${offsetMs} мс · разброс ±${spreadMs} мс · ${used} ударов`,
    }
  }
  return {
    ok: false,
    text:
      outcome.reason === 'too-few-hits'
        ? `Услышал только ${outcome.used} ударов из ${calibration.total}. Проверь уровень входа и бей чётче.`
        : 'Удары слишком неровные — попробуй ещё раз спокойнее, глуша струну ладонью.',
  }
})

function save() {
  const outcome = calibration.outcome.value
  if (outcome?.ok) latencyOffsetMs.value = outcome.result.offsetMs
  calibration.cancel()
}

const offsetText = computed(
  () => `${latencyOffsetMs.value > 0 ? '+' : ''}${latencyOffsetMs.value} мс`,
)
</script>

<template>
  <section id="calibration" class="panel">
    <h2 class="panel__title">Калибровка задержки</h2>
    <p class="panel__text">
      Звуковая карта и браузер добавляют задержку, которую не всегда сообщают. Сыграй по метроному —
      и ноты будут засчитываться точно в такт.
    </p>

    <div v-if="calibration.state.value === 'running'" class="run" aria-live="polite">
      <div class="run__beats" aria-hidden="true">
        <span
          v-for="i in calibration.total"
          :key="i"
          :class="{
            'run__beat--now': calibration.beat.value === i - 1,
            'run__beat--past': calibration.beat.value >= i,
          }"
        />
      </div>
      <p class="run__text">
        {{
          calibration.beat.value < 0
            ? `Приготовься… ${-calibration.beat.value}`
            : `Бей по струне на каждый щелчок · ${Math.min(calibration.beat.value + 1, calibration.total)} / ${calibration.total}`
        }}
      </p>
      <p class="run__heard">Услышано ударов: {{ calibration.hits.value }}</p>
      <button type="button" class="btn" @click="calibration.cancel()">Отменить</button>
    </div>

    <template v-else>
      <p v-if="message" class="result" :class="{ 'result--bad': !message.ok }" role="status">
        {{ message.text }}
      </p>
      <div class="actions">
        <button v-if="!ready" type="button" class="btn btn--primary" @click="emit('connect')">
          Подключить гитару
        </button>
        <template v-else>
          <button
            v-if="calibration.outcome.value?.ok"
            type="button"
            class="btn btn--primary"
            @click="save"
          >
            Сохранить поправку
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': !calibration.outcome.value?.ok }"
            @click="calibration.start()"
          >
            {{ calibration.outcome.value ? 'Ещё раз' : 'Начать калибровку' }}
          </button>
        </template>
      </div>
      <p class="hint">
        16 щелчков на 90 bpm после 4 щелчков вступления. Лучше бить по заглушённой струне — так
        атака чётче.
      </p>
    </template>

    <label class="manual">
      <span class="caps-label">Поправка вручную · {{ offsetText }}</span>
      <input
        v-model.number="latencyOffsetMs"
        type="range"
        :min="-LATENCY_OFFSET_LIMIT / 2"
        :max="LATENCY_OFFSET_LIMIT / 2"
        step="1"
        aria-label="Поправка задержки, мс"
      />
      <span class="manual__scale"><span>раньше</span><span>0</span><span>позже</span></span>
    </label>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.panel__text,
.hint {
  font-size: 14px;
  color: var(--color-text-muted);
}

.run {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.run__beats {
  display: flex;
  gap: 6px;
}

.run__beats span {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--color-border-strong);
}

.run__beats .run__beat--past {
  border-color: transparent;
  background: rgba(255, 176, 32, 0.45);
}

.run__beats .run__beat--now {
  border-color: transparent;
  background: var(--grade-good);
  box-shadow: 0 0 14px var(--grade-good);
}

.run__text {
  font-weight: 700;
  color: var(--color-text-strong);
}

.run__heard {
  font-size: 13px;
  color: var(--color-text-muted);
}

.result {
  font-weight: 700;
  color: var(--grade-perfect-text);
}

.result--bad {
  color: var(--grade-good-text);
}

.actions {
  display: flex;
  gap: 10px;
}

.btn {
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

.manual {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.manual input {
  accent-color: var(--grade-good);
}

.manual__scale {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-dim);
}
</style>

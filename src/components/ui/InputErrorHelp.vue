<script setup lang="ts">
import { computed } from 'vue'
import type { AudioInputErrorCode } from '@/audio/audioInput'

// Ошибка звукового входа: что случилось, что проверить, и техническая причина от браузера

const props = defineProps<{
  code: AudioInputErrorCode | null
  detail: string | null
}>()

const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

const TITLE: Record<AudioInputErrorCode, string> = {
  denied: 'Доступ к звуковому входу запрещён.',
  'not-found': 'Браузер не видит ни одного звукового входа.',
  busy: 'Вход есть, но открыть его не удалось — он занят или заблокирован.',
  unsupported: 'Браузер не поддерживает захват звука. Открой STRUNA в Chrome или Edge.',
  unknown: 'Не удалось открыть звуковой вход.',
}

const hints = computed<string[]>(() => {
  switch (props.code) {
    case 'denied':
      return [
        'Значок замка в адресной строке → «Микрофон» → «Разрешить», затем обнови страницу.',
        ...(isWindows
          ? ['Windows: Параметры → Конфиденциальность → Микрофон → разреши доступ приложениям.']
          : ['macOS: Системные настройки → Конфиденциальность → Микрофон → включи браузер.']),
      ]
    case 'not-found':
      return isWindows
        ? [
            'Параметры → Конфиденциальность и защита → Микрофон: включи «Доступ к микрофону» и «Разрешить классическим приложениям доступ к микрофону» — без этого браузер не видит ни одного входа.',
            'Параметры → Система → Звук → Ввод: звуковая карта (например, Focusrite «Analogue 1 + 2») есть в списке и не отключена.',
            'Драйвер звуковой карты установлен (Focusrite Control / Focusrite USB Driver), карта подключена напрямую, не через хаб.',
            'chrome://settings/content/microphone — выбрана нужная карта, сайт не в списке запрещённых.',
          ]
        : [
            'Системные настройки → Звук → Вход: звуковая карта есть в списке.',
            'Переподключи карту и нажми «Попробовать снова».',
          ]
    case 'busy':
      return isWindows
        ? [
            'Закрой программы, которые держат карту (DAW через ASIO, Focusrite Control не мешает).',
            'Параметры звука → Панель управления звуком → Запись → свойства карты → Дополнительно: сними «Разрешить приложениям использовать устройство в монопольном режиме».',
          ]
        : ['Закрой программы, которые могут держать карту монопольно, и попробуй снова.']
    default:
      return []
  }
})
</script>

<template>
  <div class="help" role="alert">
    <p class="help__title">{{ TITLE[code ?? 'unknown'] }}</p>
    <ul v-if="hints.length" class="help__list">
      <li v-for="hint in hints" :key="hint">{{ hint }}</li>
    </ul>
    <p v-if="detail" class="help__detail">Причина от браузера: {{ detail }}</p>
  </div>
</template>

<style scoped>
.help {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.help__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-strong);
}

.help__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--color-text-soft);
}

.help__detail {
  font-size: 12px;
  color: var(--color-text-dim);
  word-break: break-word;
}
</style>

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

// Базовый путь: на GitHub Pages сайт живёт в подпапке (/struna/), локально — в корне
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      // Обновление — по согласию пользователя: автоперезагрузка посреди игры хуже
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'STRUNA — тренажёр для гитариста',
        short_name: 'STRUNA',
        description:
          'Играй на настоящей гитаре: ноты на дорожке, распознавание звука, тюнер, квинтовый круг, гриф и лады.',
        lang: 'ru',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        orientation: 'landscape',
        theme_color: '#07070B',
        background_color: '#07070B',
        categories: ['music', 'education', 'games'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Оболочка целиком, включая ленивые чанки, ворклет и шрифты — запуск без сети
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Чанк экрана игры (three + postprocessing) ~600 КБ
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // Ленивые тяжёлые чанки ожидаемы: экран игры (three + postprocessing ~600 КБ)
    // и alphaTab для Guitar Pro (~1.2 МБ, ~290 КБ gzip, только при открытии GP-файла)
    chunkSizeWarningLimit: 1300,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

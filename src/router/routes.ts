import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Заголовок вкладки браузера */
    title?: string
    /** Полноэкранный режим: без шапки и навигации (экран игры) */
    fullscreen?: boolean
  }
}

// Каждый раздел грузится лениво — у каждого свой чанк
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Главная' },
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('@/views/LibraryView.vue'),
    meta: { title: 'Библиотека' },
  },
  {
    path: '/play/:trackId',
    name: 'play',
    component: () => import('@/views/PlayView.vue'),
    props: true,
    meta: { title: 'Игра', fullscreen: true },
  },
  {
    path: '/results/:sessionId',
    name: 'results',
    component: () => import('@/views/ResultsView.vue'),
    props: true,
    meta: { title: 'Результаты' },
  },
  {
    path: '/tuner',
    name: 'tuner',
    component: () => import('@/views/TunerView.vue'),
    meta: { title: 'Тюнер' },
  },
  {
    path: '/theory',
    component: () => import('@/views/theory/TheoryLayout.vue'),
    children: [
      { path: '', redirect: { name: 'theory-circle' } },
      {
        path: 'circle',
        name: 'theory-circle',
        component: () => import('@/views/theory/CircleView.vue'),
        meta: { title: 'Квинтовый круг' },
      },
      {
        path: 'fretboard',
        name: 'theory-fretboard',
        component: () => import('@/views/theory/FretboardView.vue'),
        meta: { title: 'Гриф и лады' },
      },
    ],
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Настройки' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Не найдено' },
  },
]

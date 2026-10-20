import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'

const APP_NAME = 'STRUNA'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Ссылка с якорем (например, /settings#calibration) — к нужному блоку
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 24 } : { top: 0 }),
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ${APP_NAME}` : APP_NAME
})

export default router

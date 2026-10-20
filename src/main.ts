import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useLibraryStore } from './stores/library'
import { useResultsStore } from './stores/results'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

// Библиотека и рекорды — из IndexedDB, параллельно с первым экраном
void useLibraryStore(pinia).load()
void useResultsStore(pinia).load()

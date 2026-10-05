import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'

import App from './App.vue'
import router from './router'
import { getStoredToken } from './utils/token'

import './styles/reset.css'
import './styles/base.css'
import './styles/variables.css'

registerSW({
  immediate: true,
  onOfflineReady() {
    console.log('PWA: приложение доступно офлайн')
  },
})

if (import.meta.env.PROD) {
  // autoUpdate: перезагружаем страницу только при обновлении уже
  // контролируемой версии (иначе был бы лишний reload при первой установке)
  const wasControlled = !!navigator.serviceWorker.controller
  if (wasControlled) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
  }
}

// Сбрасываем протухший токен до инициализации стора, иначе приложение
// сочтёт пользователя авторизованным и покажет пустую защищённую страницу
getStoredToken()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

import { ref, computed, watchEffect } from 'vue'
import { defineStore } from 'pinia'

const APP_NAME = 'А-Сервис'

export const usePageStore = defineStore('page', () => {
  // Название раздела приходит из роутера (meta.title), уточнение — со страницы,
  // когда её данные загружены. Так заголовок не бывает ни пустым, ни устаревшим.
  const routeTitle = ref('')
  const entityName = ref('')

  const title = computed(() =>
    entityName.value ? `${routeTitle.value}: ${entityName.value}` : routeTitle.value,
  )

  const setRouteTitle = (name) => {
    routeTitle.value = name || ''
    entityName.value = ''
  }

  const setEntity = (name) => {
    entityName.value = name || ''
  }

  watchEffect(
    () => {
      document.title = title.value ? `${title.value} — ${APP_NAME}` : APP_NAME
    },
    { flush: 'sync' },
  )

  return { title, setRouteTitle, setEntity }
})

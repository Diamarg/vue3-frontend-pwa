import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const usePageStore = defineStore('page', () => {
  const pageInfo = ref({
    name: '',
    projectName: '',
  })

  return {
    pageInfo,
  }
})

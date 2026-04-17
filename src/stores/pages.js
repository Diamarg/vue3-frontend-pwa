import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'

export const usePageStore = defineStore('page', () => {
  const nowpage = ref('')

  return {
    nowpage,
  }
})

<script setup>
import Abutton from '@/components/Abutton.vue'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { onMounted } from 'vue'

const authStore = useAuthStore()
const pageStore = usePageStore()
const loading = ref(true)

onMounted(async () => {
  pageStore.nowpage = 'Проекты'
  await authStore.fetchMe()
  loading.value = false
})
</script>

<template>
  <div v-if="authStore.user" class="global-container">
    <h3>Проекты</h3>
    <div>
      <div>Пользователь - {{ authStore.user.fullName || 'Гость' }}</div>
      <div>Админ - {{ authStore.isAdmin || 'false' }}</div>
    </div>
  </div>
</template>

<style scoped>
.global-container {
  max-width: 1400px;
  margin-inline: auto;
  padding-inline: 20px;
  width: 100%;
}
</style>

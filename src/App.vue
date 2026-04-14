<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

onMounted(async () => {
  // Если токен есть, но пользователь не загружен — загружаем
  if (authStore.token && !authStore.user) {
    try {
      await authStore.fetchMe()
    } catch (error) {
      // Если токен невалидный, очищаем всё и отправляем на логин
      console.error('Не удалось восстановить сессию:', error)
      authStore.logout()
      // Опционально: редирект на /login, если вы не на странице логина
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  }
})
</script>

<template>
  <RouterView></RouterView>
</template>

<style scoped></style>

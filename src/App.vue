<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'

import GlobalToast from './components/GlobalToast.vue'
import NavBar from './components/NavBar.vue'

const authStore = useAuthStore()

// onMounted(async () => {
//   // Если токен есть, но пользователь не загружен — загружаем
//   if (authStore.token && !authStore.user) {
//     try {
//       await authStore.fetchMe()
//     } catch (error) {
//       // Если токен невалидный, очищаем всё и отправляем на логин
//       console.error('Не удалось восстановить сессию:', error)

//       authStore.logout()

//       // Опционально: редирект на /login, если вы не на странице логина
//       if (window.location.pathname !== '/login') {
//         window.location.href = '/login'
//       }
//     }
//   }
// })
</script>

<template>
  <nav-bar v-if="authStore.user" />
  <global-toast />
  <RouterView />
</template>

<style scoped></style>

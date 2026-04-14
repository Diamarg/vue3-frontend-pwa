<script setup>
import Abutton from '@/components/Abutton.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
  window.location.href = '/login'
}
</script>

<template>
  <h1>Проекты</h1>
  <div v-if="!authStore.user">Загрузка данных пользователя</div>
  <div v-else>
    <div>Пользователь - {{ authStore.user.fullName || 'Гость' }}</div>
    <div>Админ - {{ authStore.isAdmin || '' }}</div>
    <abutton @click="handleLogout">Выйти</abutton>
  </div>
</template>

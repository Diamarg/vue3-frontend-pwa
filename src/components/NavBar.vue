<template>
  <div class="navbar">
    <div class="navbar-pagename">{{ pageStore.pageInfo.name }}</div>
    <div class="navbar-navlinks">
      <a @click="router.push('/')">Проекты</a>
      <a v-if="authStore.isAdmin" @click="toAdminPanel">Админка</a>
    </div>

    <!-- Используем локальную переменную currentUser для безопасности отображения -->
    <div v-if="currentUser" class="navbar-logout">
      <div class="navbar-user" :class="{ admin: authStore.isAdmin }">
        {{ currentUser.fullName }}
      </div>
      <a @click="handleLogout">Выйти</a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue' // Используем computed вместо onMounted/ref
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { usePageStore } from '@/stores/pages'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const pageStore = usePageStore()

// Безопасное получение текущего пользователя через computed
const currentUser = computed(() => authStore.user)

const toAdminPanel = () => {
  router.push('/admin')
}

const handleLogout = () => {
  // 1. СОХРАНЯЕМ данные пользователя в локальную переменную ДО выхода
  const userName = authStore.user?.userName || 'Пользователь'
  const fullName = authStore.user?.fullName || ''

  // 2. Показываем тост с сохраненными данными
  toast.info(`${fullName} (${userName}) выходит из системы`)

  // 3. Выполняем выход (очищает стор)
  authStore.logout()

  // 4. Перенаправляем на логин
  router.push('/login')
}
</script>

<style scoped>
/* Стили остаются без изменений */
.navbar {
  display: grid;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  justify-items: center;
  height: 65px;
  border-color: rgba(0, 0, 0, 0);
  border-bottom-width: 1px;
  border-bottom-color: rgb(230, 230, 230);
  border-style: solid;
  background-color: rgb(255, 255, 255);
}

@media (max-width: 700px) {
  .navbar-user {
    display: none;
  }
}

.navbar-pagename {
  font-size: 20px;
  font-weight: 300;
  margin-left: 24px;
  justify-self: start;
}

.navbar-navlinks {
  display: flex;
  gap: 20px;
}

.navbar-logout {
  margin-right: 24px;
  justify-self: end;
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 1fr;
}

.navbar-user {
  font-weight: 400;
  text-align: center;
  color: rgb(99, 99, 99);
}

.admin {
  color: rgb(173, 0, 0);
}
</style>

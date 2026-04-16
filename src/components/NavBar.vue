<template>
  <div class="navbar">
    <div class="navbar-pagename">Проекты</div>
    <div class="navbar-navbuttons">Кнопки</div>
    <div v-if="authStore.user" class="navbar-logout">
      <div>{{ authStore.user.fullName }}</div>
      <abutton @click="handleLogout">Выйти</abutton>
    </div>
  </div>
</template>

<script setup>
import Abutton from './Abutton.vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.navbar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: center;
  justify-items: center;
  height: 60px;
  border-color: rgba(0, 0, 0, 0);
  border-bottom-width: 1px;
  border-bottom-color: rgb(165, 165, 165);
  border-style: solid;
  background-color: rgb(255, 255, 255);
}

.navbar-pagename {
  justify-self: start;
}

.navbar-logout {
  justify-self: end;
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
}
</style>

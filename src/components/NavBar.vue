<template>
  <div class="navbar">
    <div class="navbar-pagename">{{ pageStore.nowpage }}</div>
    <div class="navbar-navlinks">
      <a>Проекты</a>
      <a>Устройства</a>
    </div>
    <div v-if="authStore.user" class="navbar-logout">
      <div class="navbar-user" :class="{ admin: isAdmin }">{{ authStore.user.fullName }}</div>
      <a @click="handleLogout">Выйти</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { usePageStore } from '@/stores/pages'

const isAdmin = ref('false')

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const pageStore = usePageStore()

onMounted(() => {
  if (authStore.isAdmin) {
    isAdmin.value = true
  } else {
    isAdmin.value = false
  }
})

const handleLogout = () => {
  authStore.logout()
  toast.info('Вы вышли из системы')
  router.push('/login')
}
</script>

<style scoped>
.navbar {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  justify-items: center;
  height: 65px;
  border-color: rgba(0, 0, 0, 0);
  border-bottom-width: 1px;
  border-bottom-color: #d9d9d9;
  border-style: solid;
  background-color: rgb(255, 255, 255);
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
  color: rgb(99, 99, 99);
}

.admin {
  color: rgb(173, 0, 0);
}
</style>

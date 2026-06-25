<script setup>
import { useAuthStore } from '@/stores/auth'

import GlobalToast from './components/GlobalToast.vue'
import NavBar from './components/NavBar.vue'

const authStore = useAuthStore()
</script>

<template>
  <nav-bar v-if="authStore.isAuthenticated" />
  <global-toast />
  <RouterView />
</template>

<style scoped></style>

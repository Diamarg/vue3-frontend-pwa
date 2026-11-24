<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

import GlobalToast from './components/GlobalToast.vue'
import NavBar from './components/NavBar.vue'
import AppSplash from './components/AppSplash.vue'

const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()
const showSplash = ref(true)
let splashTimer = null

watch(
  () => authStore.token,
  async (token) => {
    if (token) {
      await authStore.fetchMe()
      chatStore.connect()
    } else {
      chatStore.stop()
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await Promise.all([
    router.isReady(),
    new Promise((resolve) => {
      splashTimer = setTimeout(resolve, 900)
    }),
  ])
  showSplash.value = false
})

onBeforeUnmount(() => {
  clearTimeout(splashTimer)
  chatStore.stop()
})
</script>

<template>
  <Transition name="app-splash">
    <AppSplash v-if="showSplash" />
  </Transition>

  <div class="app-view" :inert="showSplash" :aria-hidden="showSplash">
    <nav-bar v-if="authStore.isAuthenticated" />
    <global-toast />
    <RouterView />
  </div>
</template>

<style scoped></style>

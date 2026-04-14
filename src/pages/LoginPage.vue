<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Abutton from '@/components/Abutton.vue'
import Ainput from '@/components/Ainput.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isValid = ref(false)
const error = ref('')

const form = ref({
  userName: '',
  password: '',
})

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

const userNameRules = [
  (v) => !!v || 'Имя пользователя обязательно',
  (v) => v.length >= 5 || 'Имя пользователя должно быть не менее 5 символов',
  (v) =>
    /^[a-zA-Z][a-zA-Z0-9]*$/.test(v) ||
    'Имя пользователя должно начинаться с буквы и содержать только английские буквы и цифры',
]

const passwordRules = [
  (password) => !!password || 'Пароль обязателен',
  (password) => (password?.length || 0) > 8 || 'Пароль должен быть длиннее 8 символов',
  (password) =>
    (/[a-zA-Z]/.test(password) && /\d/.test(password)) ||
    'Пароль должен содержать английские буквы и цифры',
]

const handleLogin = async () => {
  console.log(form.value.userName)
  console.log(form.value.password)
  error.value = ''
  try {
    await authStore.login(form.value)
    const redirectPath = route.query.redirect || '/'
    router.push(redirectPath)
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <div class="login-container">
    <form class="login-form" @submit.prevent="handleLogin">
      <div class="login-form__header">
        <h2>Вход в систему</h2>
      </div>

      <div class="login-form__username">
        <ainput v-model="form.userName" placeholder="Имя пользователя" type="text"></ainput>
      </div>

      <div class="login-form__password">
        <ainput v-model="form.password" placeholder="Пароль" type="password"></ainput>
      </div>

      <div class="login-form__actions">
        <abutton variant="primary" type="submit">Вход</abutton>
        <abutton variant="secondary" @click="router.push('/register')">Регистрация</abutton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.login-container {
  margin: 0;
  min-height: 100vh;
  display: flex;
  justify-content: center; /* горизонталь */
  align-items: center; /* вертикаль */
  background-color: var(--md-sys-color-background);
}

.login-form {
  display: grid;
  gap: 10px;
}

.login-form__header {
  text-align: center;
}

.login-form__actions {
  display: grid;
  gap: 10px;
}
</style>

<!-- <template>
  <v-container class="h-screen d-flex align-center justify-center">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <h2>Вход в систему</h2>
        <v-form fast-fail @submit.prevent="handleLogin" v-model="isValid">
          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            v-model="form.userName"
            :rules="userNameRules"
            label="Имя пользователя"
            autocomplete="username"
          ></v-text-field>

          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            type="password"
            v-model="form.password"
            :rules="passwordRules"
            label="Пароль"
            autocomplete="password"
          ></v-text-field>

          <v-btn
            rounded
            :disabled="!isValid || authStore.loading"
            class="mt-2"
            color="primary"
            type="submit"
            block
            >Вход</v-btn
          >
          <v-btn
            rounded
            :disabled="authStore.loading"
            class="mt-2"
            color="secondary"
            block
            @click="router.push('/register')"
            >Регистрация</v-btn
          >
        </v-form>

        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mt-4"
          closable
          @click:close="error = ''"
        >
          {{ error }}
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template> -->

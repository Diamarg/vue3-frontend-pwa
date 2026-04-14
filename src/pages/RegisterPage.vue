<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  userName: '',
  email: '',
  fullName: '',
  password: '',
  confirmPassword: '',
})

const isValid = ref(false)
const error = ref('')

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

const userNameRules = [
  (userName) => !!userName || 'Имя пользователя обязательно',
  (userName) => userName.length >= 5 || 'Имя пользователя должно быть не менее 5 символов',
  (userName) =>
    /^[a-zA-Z][a-zA-Z0-9]*$/.test(userName) ||
    'Имя пользователя должно начинаться с буквы и содержать только английские буквы и цифры',
]

const fullNameRules = [(fullName) => !!fullName || 'Полное имя обязательно']

const passwordRules = [
  (password) => !!password || 'Пароль обязателен',
  (password) => password.length > 8 || 'Пароль должен быть длиннее 8 символов',
  (password) =>
    (/[a-zA-Z]/.test(password) && /\d/.test(password)) ||
    'Пароль должен содержать английские буквы и цифры',
]

const confirmPasswordRules = [
  (confirmPassword) => !!confirmPassword || 'Пароль обязателен',
  (confirmPassword) => confirmPassword.length > 8 || 'Пароль должен быть длиннее 8 символов',
  (confirmPassword) =>
    (/[a-zA-Z]/.test(confirmPassword) && /\d/.test(confirmPassword)) ||
    'Пароль должен содержать английские буквы и цифры',
  (confirmPassword) => confirmPassword === form.value.password || 'Пароли не совпадают',
]

const emailRules = [
  (email) => !!email || 'Email обязателен',
  (email) =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email) || 'Введите корректный email',
]

const handleRegister = async () => {
  error.value = ''
  try {
    await authStore.register({
      userName: form.value.userName,
      email: form.value.email,
      fullName: form.value.fullName,
      password: form.value.password,
    })
    router.push('/')
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <v-container class="h-screen d-flex align-center justify-center">
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <h2>Новый пользователь</h2>
        <v-form fast-fail @submit.prevent="handleRegister" v-model="isValid">
          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            v-model="form.userName"
            :rules="userNameRules"
            label="Имя пользователя"
            autocomplete="name"
          ></v-text-field>

          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            v-model="form.email"
            :rules="emailRules"
            label="Email"
            autocomplete="email"
          ></v-text-field>

          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            v-model="form.fullName"
            label="Полное имя"
            autocomplete="name"
            :rules="fullNameRules"
          ></v-text-field>

          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            type="password"
            v-model="form.password"
            :rules="passwordRules"
            label="Пароль"
            autocomplete="new-password"
          ></v-text-field>

          <v-text-field
            :loading="authStore.loading"
            :disabled="authStore.loading"
            type="password"
            v-model="form.confirmPassword"
            :rules="confirmPasswordRules"
            label="Повторите пароль"
            autocomplete="new-password"
          ></v-text-field>

          <v-btn
            rounded
            :disabled="!isValid || authStore.loading"
            class="mt-2"
            color="primary"
            type="submit"
            block
            >Регистрация</v-btn
          >
          <v-btn
            rounded
            :disabled="authStore.loading"
            class="mt-2"
            color="primary"
            type="submit"
            block
            @click="router.push('/')"
            >Отмена</v-btn
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
</template>

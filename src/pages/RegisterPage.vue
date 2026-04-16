<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Abutton from '@/components/Abutton.vue'
import Ainput from '@/components/Ainput.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const isValid = ref(false)
const error = ref('')

const toast = useToast()

const form = ref({
  userName: '',
  email: '',
  fullName: '',
  password: '',
  confirmPassword: '',
})

onMounted(() => {})

const handleRegister = async () => {
  error.value = ''
  try {
    await authStore.register({
      userName: form.value.userName,
      email: form.value.email,
      fullName: form.value.fullName,
      password: form.value.password,
    })
    toast.success(`Пользователь ${form.value.userName} успешно зарегистрирован`)
    router.push('/')
  } catch (err) {
    error.value = err.message
    toast.error(err)
  }
}
</script>

<template>
  <div class="register-container">
    <form class="register-form" @submit.prevent="handleRegister">
      <div class="register-form__header">
        <h3>Регистрация</h3>
      </div>
      <div class="register-form__inputs">
        <div class="register-form__input">
          <label for="name-input">Имя пользователя</label>
          <ainput
            v-model="form.userName"
            placeholder="Имя пользователя"
            type="text"
            id="name-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
        <div class="register-form__input">
          <label for="email-input">E-mail</label>
          <ainput
            v-model="form.email"
            placeholder="E-mail"
            type="email"
            id="email-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
        <div class="register-form__input">
          <label for="fullName-input">Полное имя</label>
          <ainput
            v-model="form.fullName"
            placeholder="Полное имя"
            type="text"
            id="fullName-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
        <div class="register-form__input">
          <label for="pass-input">Пароль</label>
          <ainput
            v-model="form.password"
            placeholder="Пароль"
            type="password"
            id="pass-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
        <div class="register-form__input">
          <label for="passConfirm-input">Повторите пароль</label>
          <ainput
            v-model="form.confirmPassword"
            placeholder="Повторите пароль"
            type="password"
            id="passConfirm-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
      </div>

      <div class="register-form__actions">
        <abutton variant="primary" type="submit" class="register-form__enter-button"
          >Новый пользователь</abutton
        >
        <a @click="router.push('/')" class="register-form__back-link">Назад</a>
      </div>
    </form>
  </div>
</template>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  justify-content: center; /* горизонталь */
  align-items: center; /* вертикаль */
}

.register-form {
  display: grid;
  gap: 24px;
  border-radius: 8px;
  border-color: #d9d9d9;
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  margin: 24px;
}

.register-form__header {
  text-align: center;
  font-size: 24px;
  color: rgb(114, 114, 114);
}

.register-form__inputs {
  display: grid;
  gap: 24px;
}

.register-form__input {
}

label {
  display: block;
  color: rgb(87, 87, 87);
  font-weight: 400;
  margin-bottom: 8px;
}

.register-form__actions {
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.register-form__back-link {
  align-self: center;
  padding: 0px 24px;
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

<!-- <script setup>
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
</template> -->

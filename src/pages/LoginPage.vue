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
  password: '',
})

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

const handleLogin = async () => {
  error.value = ''
  try {
    await authStore.login(form.value)
  } catch (err) {
    toast.error(err)
    error.value = err.message
  }
  const redirectPath = route.query.redirect || '/'
  router.push(redirectPath)
  toast.info(`${authStore.user.fullName} (${authStore.user.userName}) входит в систему`)
}
</script>

<template>
  <div class="login-container">
    <form class="login-form" @submit.prevent="handleLogin">
      <div class="login-form__header">
        <h3>Вход в систему</h3>
      </div>
      <div class="login-form__inputs">
        <div class="login-form__input">
          <label for="name-input">Имя пользователя</label>
          <ainput
            v-model="form.userName"
            placeholder="Имя пользователя"
            type="text"
            id="name-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
        <div class="login-form__input">
          <label for="pass-input">Пароль</label>
          <ainput
            v-model="form.password"
            placeholder="Пароль"
            type="password"
            id="pass-input"
            :loading="authStore.loading"
          ></ainput>
        </div>
      </div>

      <div class="login-form__actions">
        <abutton variant="primary" type="submit" class="login-form__enter-button">Вход</abutton>
        <a @click="router.push('/register')" class="login-form__register-link"
          >Создать учётную запись</a
        >
      </div>
    </form>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center; /* горизонталь */
  align-items: center; /* вертикаль */
}

.login-form {
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

.login-form__header {
  text-align: center;
  font-size: 24px;
  color: rgb(114, 114, 114);
}

.login-form__inputs {
  display: grid;
  gap: 24px;
}

.login-form__input {
}

label {
  display: block;
  color: rgb(87, 87, 87);
  font-weight: 400;
  margin-bottom: 8px;
}

.login-form__actions {
  display: flex;
  gap: 16px;
}

.login-form__register-link {
  align-self: center;
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

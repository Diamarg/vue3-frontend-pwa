<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Abutton from '@/components/Abutton.vue'
import Ainput from '@/components/Ainput.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

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

const userNameTouched = ref(false)
const userNameError = computed(() => {
  if (userNameTouched.value && form.value.userName.length < 1) {
    return 'Нужно заполнить'
  }
  return ''
})

const passwordTouched = ref(false)
const passwordError = computed(() => {
  if (passwordTouched.value && form.value.password.length < 1) {
    return 'Нужно заполнить'
  }
})

const disableLoginButton = computed(() => {
  if (
    form.value.userName.length < 1 ||
    form.value.password.length < 1 ||
    userNameError.value ||
    passwordError.value
  ) {
    return true
  } else {
    return false
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
            :invalid-message="userNameError"
            @input="userNameTouched = true"
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
            :invalid-message="passwordError"
            @input="passwordTouched = true"
          ></ainput>
        </div>
      </div>

      <div class="login-form__actions">
        <abutton
          variant="primary"
          type="submit"
          class="login-form__enter-button"
          :disabled="disableLoginButton"
          >Вход</abutton
        >
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
  max-width: 370px;
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

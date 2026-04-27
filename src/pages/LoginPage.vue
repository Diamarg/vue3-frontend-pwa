<script setup>
import { ref, onMounted, computed, watch, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Abutton from '@/components/A-button.vue'
import AInput from '@/components/A-input.vue'
import ALoader from '@/components/A-loader.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(false)

const error = ref('')

const toast = useToast()

const form = reactive({
  userName: {
    value: '',
    isValid: false,
  },
  password: {
    value: '',
    isValid: false,
  },
})

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

const userNameValidHandle = (e) => {
  form.userName.isValid = e
}

const passwordValidHandle = (e) => {
  form.password.isValid = e
}

const formReady = computed(() => {
  return form.userName.isValid && form.password.isValid
})

const sendForm = async () => {
  loading.value = true
  error.value = ''
  try {
    await authStore.login({ userName: form.userName.value, password: form.password.value })
  } catch (err) {
    toast.error(err)
    error.value = err.message
  }
  loading.value = false

  const redirectPath = route.query.redirect || '/'
  router.push(redirectPath)
  toast.info(`${authStore.user.fullName} (${authStore.user.userName}) входит в систему`)
}
</script>

<template>
  <div class="login-container">
    <form class="login-form">
      <div class="login-form__header">
        <h3>Вход в систему</h3>
      </div>
      <div class="login-form__inputs">
        <div class="login-form__input">
          <label for="name-input">Имя пользователя</label>
          <a-input
            v-model="form.userName.value"
            placeholder="Имя пользователя"
            type="text"
            id="name-input"
            :loading="authStore.loading"
            :validate="true"
            @on-valid="userNameValidHandle($event)"
            validation-message="Заполните имя пользователя"
          >
          </a-input>
        </div>
        <div class="login-form__input">
          <label for="pass-input">Пароль</label>
          <a-input
            v-model="form.password.value"
            placeholder="Пароль"
            type="password"
            id="pass-input"
            :loading="authStore.loading"
            :validate="true"
            @on-valid="passwordValidHandle($event)"
            validation-message="Заполните имя пароль"
          ></a-input>
        </div>
      </div>

      <div class="login-form__actions">
        <abutton
          @click="sendForm"
          variant="primary"
          type="button"
          class="login-form__enter-button"
          :disabled="!formReady"
          >Вход</abutton
        >
        <a @click="router.push('/register')" class="login-form__register-link"
          >Создать учётную запись</a
        >
      </div>
      <a-loader :enable="loading" />
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

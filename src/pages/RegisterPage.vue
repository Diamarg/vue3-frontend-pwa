<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Abutton from '@/components/A-button.vue'
import AInput from '@/components/A-input.vue'
import ALoader from '@/components/A-loader.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const error = ref(null)

const form = ref({
  userName: '',
  userNameTouched: false,
  email: '',
  emailTouched: false,
  fullName: '',
  fullNameTouched: false,
  password: '',
  passwordTouched: false,
  confirmPassword: '',
  confirmPasswordTouched: false,
})

const userNameValidation = computed(() => {
  const regexp = new RegExp(/^[a-zA-Z0-9_-]{3,30}$/)

  if (form.value.userNameTouched && !regexp.test(form.value.userName))
    return 'Не менее 3х символов англ. алфивита'
  return ''
})

const emailValidation = computed(() => {
  const regexp = new RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)
  if (form.value.emailTouched && !regexp.test(form.value.email)) return 'Введите корректный email'
  return ''
})

const fullNameValidation = computed(() => {
  const regexp = new RegExp(/^[a-zA-Zа-яА-ЯёЁ0-9_-]{3,30}$/u)
  if (form.value.fullNameTouched && !regexp.test(form.value.fullName)) return 'Не менее 3х символов'
  return ''
})

const passwordValidation = computed(() => {
  const regexp = new RegExp(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
  if (form.value.passwordTouched && !regexp.test(form.value.password))
    return 'Не менее 8 символов A-Z в любом регистре'
  return ''
})

const confirmPasswordValidation = computed(() => {
  if (!form.value.confirmPasswordTouched) return ''
  if (form.value.password === form.value.confirmPassword) return ''
  return 'Пароли не совпадают'
})

const formReady = computed(() => {
  return (
    form.value.userName !== '' &&
    form.value.email !== '' &&
    form.value.fullName !== '' &&
    form.value.password !== '' &&
    form.value.confirmPassword !== '' &&
    !userNameValidation.value &&
    !emailValidation.value &&
    !fullNameValidation.value &&
    !passwordValidation.value &&
    !confirmPasswordValidation.value
  )
})

const sendForm = async () => {
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
        <div>
          <label for="name-input">Имя пользователя</label>
          <a-input
            v-model="form.userName"
            placeholder="Ваше имя пользователя"
            type="text"
            id="name-input"
            @on-touch="form.userNameTouched = true"
          >
          </a-input>
          <p class="valid-error">{{ userNameValidation }}</p>
        </div>

        <div>
          <label for="email-input">E-mail</label>
          <a-input
            v-model="form.email"
            placeholder="E-mail"
            type="email"
            id="email-input"
            @on-touch="form.emailTouched = true"
          >
          </a-input>
          <p class="valid-error">{{ emailValidation }}</p>
        </div>

        <div>
          <label for="fullName-input">Полное имя</label>
          <a-input
            v-model="form.fullName"
            placeholder="Василий Петрович"
            type="text"
            id="fullName-input"
            @on-touch="form.fullNameTouched = true"
          >
          </a-input>
          <p class="valid-error">{{ fullNameValidation }}</p>
        </div>

        <div>
          <label for="pass-input">Пароль</label>
          <a-input
            v-model="form.password"
            placeholder="Ваш пароль"
            type="password"
            id="pass-input"
            @on-touch="form.passwordTouched = true"
          >
          </a-input>
          <p class="valid-error">{{ passwordValidation }}</p>
        </div>

        <div>
          <label for="passConfirm-input">Повторите пароль</label>
          <a-input
            v-model="form.confirmPassword"
            placeholder="Повторите ваш пароль"
            type="password"
            id="pass-input"
            @on-touch="form.confirmPasswordTouched = true"
          >
          </a-input>
          <p class="valid-error">{{ confirmPasswordValidation }}</p>
        </div>
      </div>

      <div class="register-form__actions">
        <abutton
          @click="sendForm"
          :disabled="!formReady"
          variant="primary"
          class="register-form__enter-button"
          >Новый пользователь</abutton
        >
        <a @click="router.push('/')" class="register-form__back-link">Назад</a>
      </div>
      <a-loader :enable="authStore.loading" />
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

.register-form__header {
  text-align: center;
  font-size: 24px;
  color: rgb(114, 114, 114);
}

.register-form__inputs {
  display: grid;
  gap: 24px;
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

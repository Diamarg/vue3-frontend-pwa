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
const toast = useToast()

const isValid = ref(false)
const error = ref('')

const form = ref({
  userName: '',
  email: '',
  fullName: '',
  password: '',
  confirmPassword: '',
})

const userNameTouched = ref(false)
const userNameError = computed(() => {
  if (userNameTouched.value && form.value.userName.length < 5) {
    return 'Имя пользователя не менее пяти символов'
  }
  return ''
})

const emailTouched = ref(false)
const emailError = computed(() => {
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/

  if (emailTouched.value && !regex.test(form.value.email)) {
    return 'Введите корректный email.'
  }
  return ''
})

const fullNameTouched = ref(false)
const fullNameError = computed(() => {
  if (fullNameTouched.value && form.value.fullName.length < 3) {
    return 'Полное имя не менее трёх символов'
  }
  return ''
})

const passwordTouched = ref(false)
const passwordError = computed(() => {
  const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/
  if (passwordTouched.value && !regex.test(form.value.password)) {
    return 'Пароль должен содержать не менее 6 букв английского алфавита и не менее одной цифры'
  }
})

const passConfirmTouched = ref(false)
const passConfirmError = computed(() => {
  if (passConfirmTouched.value && form.value.password !== form.value.confirmPassword) {
    return 'Пароли не совпадают'
  }
})

const formIsValid = computed(() => {
  return (
    !userNameError.value &&
    !emailError.value &&
    !fullNameError.value &&
    !passwordError.value &&
    !passConfirmError.value
  )
})

onMounted(() => {})

const handleRegister = async () => {
  console.log('submit form')
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
            @input="userNameTouched = true"
            :invalid-message="userNameError"
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
            @input="emailTouched = true"
            :invalid-message="emailError"
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
            @input="fullNameTouched = true"
            :invalid-message="fullNameError"
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
            @input="passwordTouched = true"
            :invalid-message="passwordError"
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
            @input="passConfirmTouched = true"
            :invalid-message="passConfirmError"
          ></ainput>
        </div>
      </div>

      <div class="register-form__actions">
        <abutton
          :disabled="!formIsValid"
          variant="primary"
          type="submit"
          class="register-form__enter-button"
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

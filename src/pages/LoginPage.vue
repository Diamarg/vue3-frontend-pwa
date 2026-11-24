<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AButton from '@/components/A-button.vue'
import AInput from '@/components/A-input.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(false)
const error = ref('')
const form = ref({
  userName: '',
  password: '',
})

const formReady = computed(() => Boolean(form.value.userName && form.value.password))

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

const sendForm = async () => {
  if (!formReady.value || loading.value) return

  loading.value = true
  error.value = ''
  try {
    await authStore.login({ userName: form.value.userName, password: form.value.password })
    router.push(route.query.redirect || '/')
    toast.info(`Вход выполнен: ${authStore.user.fullName}`)
  } catch (err) {
    error.value = err?.message || 'Не удалось войти. Проверьте имя пользователя и пароль.'
    toast.error(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-container">
    <form class="login-form" @submit.prevent="sendForm">
      <header class="login-form__header">
        <img src="/images/logo-a-service.png" alt="А-Сервис" class="login-form__logo" />
        <h1 class="login-form__title">Вход в систему</h1>
        <p class="login-form__subtitle">Введите данные учётной записи, чтобы продолжить работу.</p>
      </header>

      <div class="login-form__body">
        <div v-if="error" class="login-form__error" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 17h.01" />
          </svg>
          <span>{{ error }}</span>
        </div>

        <div class="login-form__inputs">
          <div class="login-form__field">
            <label for="name-input">Имя пользователя</label>
            <div class="login-form__control">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </svg>
              <a-input
                id="name-input"
                v-model="form.userName"
                name="userName"
                type="text"
                placeholder="Введите имя пользователя"
                autocomplete="username"
                :disabled="loading"
                @input="error = ''"
              />
            </div>
          </div>

          <div class="login-form__field">
            <label for="pass-input">Пароль</label>
            <div class="login-form__control">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
              </svg>
              <a-input
                id="pass-input"
                v-model="form.password"
                name="password"
                type="password"
                placeholder="Введите пароль"
                autocomplete="current-password"
                :disabled="loading"
                @input="error = ''"
              />
            </div>
          </div>
        </div>

        <a-button
          type="submit"
          variant="primary"
          class="login-form__submit"
          :disabled="!formReady || loading"
        >
          <span v-if="loading" class="login-form__spinner" aria-hidden="true"></span>
          <span>{{ loading ? 'Выполняем вход…' : 'Войти' }}</span>
          <svg
            v-if="!loading"
            class="login-form__submit-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            aria-hidden="true"
          >
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </a-button>

        <p class="login-form__note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Доступ только для авторизованных пользователей
        </p>
      </div>
    </form>
  </main>
</template>

<style scoped>
.login-container {
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  padding: max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px))
    max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px));
  background:
    radial-gradient(ellipse at 12% 8%, rgba(224, 231, 255, 0.65), transparent 45%),
    radial-gradient(ellipse at 88% 92%, rgba(237, 233, 254, 0.6), transparent 45%), #f8fafc;
}

.login-form {
  width: min(100%, 420px);
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 16px;
  background: #fff;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.25);
}

.login-form__header {
  padding: 28px 32px 24px;
  border-bottom: 1px solid #eceef1;
  background: linear-gradient(135deg, #fff 0%, #fff 65%, #f5f3ff 100%);
  text-align: center;
}

.login-form__logo {
  display: block;
  width: 148px;
  max-width: 100%;
  height: auto;
  margin: 0 auto 20px;
}

.login-form__title {
  margin: 0;
  color: #2d3748;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
}

.login-form__subtitle {
  max-width: 310px;
  margin: 8px auto 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.5;
}

.login-form__body {
  display: grid;
  gap: 20px;
  padding: 24px 32px 28px;
}

.login-form__error {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.45;
}

.login-form__error svg {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 1px;
}

.login-form__inputs {
  display: grid;
  gap: 18px;
}

.login-form__field label {
  display: block;
  margin-bottom: 7px;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.login-form__control {
  position: relative;
}

.login-form__control > svg {
  position: absolute;
  top: 50%;
  left: 13px;
  z-index: 1;
  width: 17px;
  height: 17px;
  color: #9298a1;
  pointer-events: none;
  transform: translateY(-50%);
}

.login-form__control :deep(.input) {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px 10px 40px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 14px;
  font-weight: 400;
  cursor: text;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.login-form__control :deep(.input)::placeholder {
  color: #a0aec0;
}

.login-form__control :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.login-form__control :deep(.input):disabled {
  background: #f8fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.login-form__submit.btn {
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid #4f46e5;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.login-form__submit.btn:hover:not(:disabled) {
  border-color: #4338ca;
  background: #4338ca;
  color: #fff;
}

.login-form__submit.btn:disabled,
.login-form__submit.btn.btn-disabled-true {
  border-color: #c7d2fe;
  background: #c7d2fe;
  color: #eef2ff;
  cursor: not-allowed;
}

.login-form__submit.btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.login-form__submit-icon {
  width: 17px;
  height: 17px;
}

.login-form__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: login-spin 0.7s linear infinite;
}

.login-form__note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: -2px 0 0;
  color: #8a8f98;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.login-form__note svg {
  flex: 0 0 13px;
  width: 13px;
  height: 13px;
}

@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
      max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  }

  .login-form {
    border-radius: 12px;
  }

  .login-form__header {
    padding: 24px 20px 20px;
  }

  .login-form__logo {
    width: 136px;
    margin-bottom: 16px;
  }

  .login-form__title {
    font-size: 22px;
  }

  .login-form__body {
    gap: 18px;
    padding: 20px;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .login-container {
    align-items: start;
    padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
      max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  }

  .login-form {
    display: grid;
    grid-template-columns: minmax(150px, 0.75fr) minmax(270px, 1.25fr);
    width: min(100%, 760px);
  }

  .login-form__header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 20px;
    border-right: 1px solid #eceef1;
    border-bottom: 0;
  }

  .login-form__logo {
    width: 96px;
    margin-bottom: 12px;
  }

  .login-form__title {
    font-size: 20px;
  }

  .login-form__subtitle {
    font-size: 12px;
  }

  .login-form__body {
    align-content: center;
    gap: 12px;
    padding: 16px 20px;
  }

  .login-form__inputs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .login-form__field label {
    margin-bottom: 5px;
  }

  .login-form__note {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-form__control :deep(.input),
  .login-form__submit.btn {
    transition: none;
  }

  .login-form__spinner {
    animation: none;
  }
}
</style>

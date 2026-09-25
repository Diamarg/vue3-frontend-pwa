import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import router from '@/router' // ✅ Импортируем роутер для принудительного редиректа

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || null)
  const user = ref(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.roles?.includes('Admin') || false)
  const isUser = computed(() => isAuthenticated.value)

  const setToken = (newToken) => {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  const clearToken = () => {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  const login = async (credentials) => {
    loading.value = true
    try {
      const response = await api.post('/auth/login', credentials)
      setToken(response.data.token)
      user.value = {
        userName: response.data.userName,
        email: response.data.email,
        fullName: response.data.fullName,
        roles: response.data.roles,
      }
      return true
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка входа'
      throw new Error(message, { cause: error })
    } finally {
      loading.value = false
    }
  }

  const register = async (data) => {
    loading.value = true
    try {
      const response = await api.post('/auth/register', data)
      setToken(response.data.token)
      user.value = {
        userName: response.data.userName,
        email: response.data.email,
        fullName: response.data.fullName,
        roles: response.data.roles,
      }
      return true
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка регистрации'
      throw new Error(message, { cause: error })
    } finally {
      loading.value = false
    }
  }

  // ✅ ИСПРАВЛЕННЫЙ LOGOUT
  const logout = async () => {
    try {
      // Если вы добавите endpoint /auth/logout на бэкенд, раскомментируйте эту строку:
      // await api.post('/auth/logout')
    } catch (error) {
      console.error('Ошибка при запросе выхода на сервер:', error)
    } finally {
      // 1. Очищаем данные
      clearToken()
      // 2. Принудительно перенаправляем на страницу входа, чтобы компонент уничтожился
      router.push('/login')
    }
  }

  const userFromToken = () => {
    try {
      const payload = JSON.parse(atob(token.value.split('.')[1]))
      const roles =
        payload.role || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
      return {
        userName: payload.name || payload.unique_name || payload.sub,
        email: payload.email,
        fullName: payload.fullName,
        roles: Array.isArray(roles) ? roles : roles ? [roles] : [],
      }
    } catch {
      return null
    }
  }

  const fetchMe = async () => {
    if (!token.value) return
    try {
      const response = await api.get('/auth/me')
      user.value = response.data
    } catch (error) {
      if (error.response?.status === 401) {
        clearToken()
      } else {
        // нет сети / сервер недоступен: восстанавливаем пользователя из JWT,
        // чтобы авторизованный пользователь мог войти в офлайн-оболочку
        user.value = userFromToken()
      }
    }
  }

  return {
    token,
    user,
    loading,
    isAuthenticated,
    isAdmin,
    isUser,
    login,
    register,
    logout,
    fetchMe,
  }
})

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'

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

  const logout = () => {
    clearToken()
  }

  const fetchMe = async () => {
    if (!token.value) return
    try {
      const response = await api.get('/auth/me')
      user.value = response.data
    } catch (error) {
      clearToken()
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

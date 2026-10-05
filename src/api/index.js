import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://178.72.171.164:7011/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // ✅ КРИТИЧЕСКИ ВАЖНО: разрешаем отправку Cookie
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    // 401 на логине/регистрации — это неверные данные, а не протухшая сессия
    const isCredentialsRequest = url.includes('/auth/login') || url.includes('/auth/register')

    if (error.response?.status === 401 && !isCredentialsRequest) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.assign(`/login?redirect=${redirect}`)
      }
    }
    console.error('API Error:', error)
    return Promise.reject(error)
  },
)

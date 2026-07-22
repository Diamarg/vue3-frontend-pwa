import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://178.72.171.164:7011/api',
  headers: { 'Content-Type': 'application/json' },
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
    // 401 = токен истёк / невалиден → чистим и даём компоненту решить, что делать
    if (error.response?.status === 401) {
      // Проверяем, что это не ошибка логина (нет тела ответа или специфичный код)
      const isAuthError =
        error.config?.url?.includes('/login') || error.config?.url?.includes('/auth')

      if (!isAuthError) {
        localStorage.removeItem('token')
        // Не делаем window.location! Пусть роутер обработает 401 глобально, если нужно
      }
    }

    console.error('API Error:', error)
    return Promise.reject(error) // 👈 Компонент получит ошибку в catch
  },
)

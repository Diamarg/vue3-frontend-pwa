const TOKEN_KEY = 'token'

const decodePayload = (token) => {
  const base64Url = token.split('.')[1]
  if (!base64Url) return null
  return JSON.parse(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')))
}

export const isTokenExpired = (token) => {
  if (!token) return true
  try {
    const { exp } = decodePayload(token)
    return !Number.isFinite(exp) || exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

// Возвращает токен только если он не просрочен; протухший удаляет из хранилища
export const getStoredToken = () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
  return token
}

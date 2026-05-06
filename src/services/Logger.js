export const logger = {
  log(action, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      url: window.location.href,
      userAgent: navigator.userAgent,
    }

    console.log('[LOG]', logEntry)

    // Отправка на сервер (опционально)
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify(logEntry) })
  },
}

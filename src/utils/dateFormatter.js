const formatShortDate = (timestamp) => {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  return isNaN(date.getTime()) ? '—' : shortDateFormatter.format(date)
}

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function convertDateFormat(dateStr) {
  // Разделяем строку по точке
  const [day, month, year] = dateStr.split('.')

  // Добавляем "20" к году (предполагаем 21 век)
  const fullYear = `20${year}`

  // Собираем в формате YYYY-MM-DD
  return `${fullYear}-${month}-${day}`
}
export { formatShortDate, shortDateFormatter, parseLocalDate, convertDateFormat }

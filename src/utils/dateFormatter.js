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

export { formatShortDate, shortDateFormatter, parseLocalDate }

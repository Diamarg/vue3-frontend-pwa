// Общие помощники TXT-отчётов проекта: заголовок, метки времени и скачивание файла

const pad2 = (n) => String(n).padStart(2, '0')

const formatReportStamp = (date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`

// В именах файлов Windows запрещает «:», поэтому время через дефис
export const formatFileNameStamp = (date) =>
  `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}_${pad2(date.getHours())}-${pad2(date.getMinutes())}`

// кодовое имя попадает в имя файла, а там слэши и пробелы недопустимы
export const safeFileNamePart = (s) => (s || '').replace(/[^\wА-Яа-яЁё.-]+/g, '_')

// Обязательные строки шапки: «Проект Заказчик», необязательная строка сборки
// (например «Сборка: ЩУ-1») и дата формирования
export const reportHeader = (project, date, subtitle) => [
  `${project?.codeName || '—'} ${project?.customer || '—'}`,
  ...(subtitle ? [subtitle] : []),
  `Дата формирования: ${formatReportStamp(date)}`,
  '',
]

export const downloadTxt = (fileName, lines) => {
  const content = lines.join('\r\n')
  const url = window.URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

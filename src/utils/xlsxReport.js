export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const FORCE_DOWNLOAD_MIME = 'application/octet-stream'

const HEADERS = [
  'Позиция',
  'Наименование',
  'Тип, марка',
  'Код оборудования',
  'Производитель',
  'Единица',
  'Кол-во',
  'Обозначение на схеме',
]

const BLACK = { argb: 'FF000000' }
const THIN = { style: 'thin', color: BLACK }
const MEDIUM = { style: 'medium', color: BLACK }

const bodyFont = { name: 'Arial', size: 11 }
const positionFont = { ...bodyFont, bold: true }
const headerFont = { ...bodyFont, bold: true, italic: true }

const MAX_COLUMN_PX = 600
const COLUMN_PADDING_PX = 20

const canvasFont = (font) =>
  `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${Math.round(
    (font.size * 96) / 72,
  )}px ${font.name}`

let measureContext

const measureTextPx = (value, font) => {
  const text = String(value ?? '')

  if (typeof document !== 'undefined') {
    measureContext ??= document.createElement('canvas').getContext('2d')

    if (measureContext) {
      measureContext.font = canvasFont(font)
      return measureContext.measureText(text).width
    }
  }

  return text.length * ((font.size * 96) / 72) * 0.6
}

const pxToColumnWidth = (px) => Math.round(((Math.min(px, MAX_COLUMN_PX) - 5) / 7) * 100) / 100

const autoColumnWidths = (rows) => {
  const table = [
    HEADERS,
    ...rows.map((item) => [
      item.num,
      item.deviceType,
      item.description,
      item.article,
      item.brand,
      'шт.',
      item.quantity,
      '',
    ]),
  ]

  return HEADERS.map((_, columnIndex) => {
    let maxPx = 0

    table.forEach((row, rowIndex) => {
      const font = rowIndex === 0 ? headerFont : columnIndex === 0 ? positionFont : bodyFont

      maxPx = Math.max(maxPx, measureTextPx(row[columnIndex], font))
    })

    return pxToColumnWidth(maxPx + COLUMN_PADDING_PX)
  })
}

const cellBorder = (rowNumber, columnNumber, lastRow) => ({
  top: rowNumber === 1 ? MEDIUM : rowNumber === 2 ? undefined : THIN,
  bottom: rowNumber === 1 ? MEDIUM : rowNumber === lastRow ? MEDIUM : THIN,
  left: columnNumber === 1 ? MEDIUM : THIN,
  right: columnNumber === HEADERS.length ? MEDIUM : THIN,
})

const centeredColumns = new Set([1, 6, 7, 8])

const ensureXlsxExtension = (fileName) => {
  const name = String(fileName || 'report')
  return /\.xlsx$/i.test(name) ? name : `${name}.xlsx`
}

export const buildDevicesXlsxBuffer = async (rows) => {
  const exceljs = await import('exceljs')
  const ExcelJS = exceljs.default ?? exceljs

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'А-Сервис'

  const sheet = workbook.addWorksheet('Устройства')

  autoColumnWidths(rows).forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  const lastRow = rows.length + 1

  const header = sheet.addRow(HEADERS)
  header.height = 26

  rows.forEach((item) => {
    const row = sheet.addRow([
      item.num,
      item.deviceType,
      item.description,
      item.article,
      item.brand,
      'шт.',
      item.quantity,
      null,
    ])

    row.height = 18
  })

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > lastRow) return

    for (let columnNumber = 1; columnNumber <= HEADERS.length; columnNumber += 1) {
      const cell = row.getCell(columnNumber)

      cell.font = rowNumber === 1 ? headerFont : columnNumber === 1 ? positionFont : bodyFont

      cell.border = cellBorder(rowNumber, columnNumber, lastRow)

      cell.alignment = {
        horizontal: rowNumber === 1 || centeredColumns.has(columnNumber) ? 'center' : 'left',
        vertical: 'middle',
      }
    }
  })

  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: false,
    fitToWidth: 0,
    fitToHeight: 0,
    margins: {
      left: 0.7875,
      right: 0.7875,
      top: 1.0528,
      bottom: 1.0528,
      header: 0.7875,
      footer: 0.7875,
    },
  }

  sheet.headerFooter.oddHeader = '&C&"Times New Roman,Regular"&A&"-,Regular"'

  sheet.headerFooter.oddFooter = '&C&"Times New Roman,Regular"Страница &P&"-,Regular"'

  return workbook.xlsx.writeBuffer()
}

const createBlob = (buffer, type) => new Blob([buffer], { type })

const getSaveFilePickerOptions = (fileName) => ({
  suggestedName: ensureXlsxExtension(fileName),
  types: [
    {
      description: 'Excel workbook (*.xlsx)',
      accept: {
        [XLSX_MIME]: ['.xlsx'],
      },
    },
  ],
})

const legacyDownload = (fileName, buffer) => {
  const name = ensureXlsxExtension(fileName)

  // Ключевой момент для Windows:
  // не отдаём браузеру xlsx MIME в fallback, иначе он может попытаться
  // передать файл внешнему обработчику и закрыть PWA.
  const blob = createBlob(buffer, FORCE_DOWNLOAD_MIME)

  const url = window.URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'

  link.style.position = 'fixed'
  link.style.left = '-10000px'
  link.style.top = '-10000px'
  link.style.width = '1px'
  link.style.height = '1px'
  link.style.opacity = '0'

  document.body.appendChild(link)
  link.click()

  window.setTimeout(() => {
    link.remove()
    window.URL.revokeObjectURL(url)
  }, 1000)
}

const writeBufferWithPicker = async (writable, buffer) => {
  await writable.write(createBlob(buffer, XLSX_MIME))
  await writable.close()
}

/**
 * Совместимый вариант, если у вас уже есть готовый buffer.
 *
 * Лучше использовать exportDevicesXlsx(), потому что showSaveFilePicker
 * нужно вызывать сразу по user click, до долгой генерации Excel.
 */
export const downloadXlsx = async (fileName, buffer) => {
  if (typeof window.showSaveFilePicker === 'function') {
    let writable = null

    try {
      const handle = await window.showSaveFilePicker(getSaveFilePickerOptions(fileName))

      writable = await handle.createWritable()
      await writeBufferWithPicker(writable, buffer)

      return
    } catch (error) {
      if (error?.name === 'AbortError') {
        return
      }

      if (writable) {
        try {
          await writable.abort?.()
        } catch {}
      }

      console.warn('showSaveFilePicker failed, fallback to download', error)
    }
  }

  legacyDownload(fileName, buffer)
}

/**
 * Рекомендуемая функция для вызова из кнопки.
 *
 * Сначала открывает save dialog, потом генерирует XLSX.
 * Это сохраняет user activation для showSaveFilePicker.
 */
export const exportDevicesXlsx = async (fileName, rows) => {
  const name = ensureXlsxExtension(fileName)

  if (typeof window.showSaveFilePicker === 'function') {
    let writable = null

    try {
      const handle = await window.showSaveFilePicker(getSaveFilePickerOptions(name))

      writable = await handle.createWritable()
    } catch (error) {
      if (error?.name === 'AbortError') {
        return
      }

      console.warn('Cannot open save dialog, fallback to download', error)
    }

    const buffer = await buildDevicesXlsxBuffer(rows)

    if (writable) {
      try {
        await writeBufferWithPicker(writable, buffer)
        return
      } catch (error) {
        try {
          await writable.abort?.()
        } catch {}

        console.warn('Write failed, fallback to download', error)
      }
    }

    legacyDownload(name, buffer)
    return
  }

  const buffer = await buildDevicesXlsxBuffer(rows)
  legacyDownload(name, buffer)
}

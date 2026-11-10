const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

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

const COLUMN_WIDTHS = [9.29, 58.43, 22.43, 19.86, 20.29, 9.29, 9, 27.86]

const BLACK = { argb: 'FF000000' }
const THIN = { style: 'thin', color: BLACK }
const MEDIUM = { style: 'medium', color: BLACK }

const bodyFont = { name: 'Arial', size: 10 }
const positionFont = { ...bodyFont, bold: true }
const headerFont = { ...bodyFont, bold: true, italic: true }

const cellBorder = (rowNumber, columnNumber, lastRow) => ({
  top: rowNumber === 1 ? MEDIUM : rowNumber === 2 ? undefined : THIN,
  bottom: rowNumber === 1 ? MEDIUM : rowNumber === lastRow ? MEDIUM : THIN,
  left: columnNumber === 1 ? MEDIUM : THIN,
  right: columnNumber === HEADERS.length ? MEDIUM : THIN,
})

const centeredColumns = new Set([1, 6, 7, 8])

export const buildDevicesXlsxBuffer = async (rows) => {
  const exceljs = await import('exceljs')
  const ExcelJS = exceljs.default ?? exceljs
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'А-Сервис'

  const sheet = workbook.addWorksheet('Устройства')
  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  const lastRow = rows.length + 1
  const header = sheet.addRow(HEADERS)
  header.height = 22.35

  rows.forEach((item) => {
    sheet.addRow([
      item.num,
      item.deviceType,
      item.description,
      item.article,
      item.brand,
      'шт.',
      item.quantity,
      null,
    ])
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

export const downloadXlsx = (fileName, buffer) => {
  const url = window.URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

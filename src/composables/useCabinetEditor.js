import { reactive, computed } from 'vue'

export function useCabinetEditor() {
  const state = reactive({
    // Выбранная панель
    panel: { width: 800, height: 600 },

    // Настройки
    settings: {
      defaultRowHeight: 90,
      defaultRowWidth: 300,
      gapBetweenDevices: 2,
      snapToRow: true, // можно отключить snap, если мешает
    },

    // Объекты на холсте
    rows: [],
    devices: [],
    ducts: [],

    // Счётчики ID
    nextId: 1,
  })

  // ===== ПАНЕЛЬ =====
  const setPanel = (panel) => {
    state.panel = { ...panel }
    // При смене панели очищаем всё (или можно оставить — на ваше усмотрение)
    state.rows = []
    state.devices = []
    state.ducts = []
  }

  // ===== ОБЩЕЕ: проверка выхода за границы =====
  const isInsidePanel = (rect) => {
    return (
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= state.panel.width &&
      rect.y + rect.height <= state.panel.height
    )
  }

  // ===== РЯДЫ =====
  const addRow = (x, y, width = null) => {
    const rowWidth = width || state.settings.defaultRowWidth
    const rect = { x, y, width: rowWidth, height: state.settings.defaultRowHeight }

    // Мягкая проверка: если выходит за края — не создаём
    if (!isInsidePanel(rect)) return false

    state.rows.push({
      id: state.nextId++,
      x,
      y,
      width: rowWidth,
    })
    return true
  }

  const removeRow = (rowId) => {
    state.devices = state.devices.filter((d) => d.rowId !== rowId)
    state.rows = state.rows.filter((r) => r.id !== rowId)
  }

  const resizeRow = (rowId, newWidth) => {
    const row = state.rows.find((r) => r.id === rowId)
    if (!row || newWidth < 50) return false

    const rect = { x: row.x, y: row.y, width: newWidth, height: state.settings.defaultRowHeight }
    if (!isInsidePanel(rect)) return false

    row.width = newWidth
    return true
  }

  // ===== КОРОБА =====
  const addDuct = (catalogItem, x, y) => {
    const rect = {
      x: x - catalogItem.width / 2,
      y: y - catalogItem.height / 2,
      width: catalogItem.width,
      height: catalogItem.height,
    }
    if (!isInsidePanel(rect)) return false

    state.ducts.push({
      id: state.nextId++,
      catalogId: catalogItem.id,
      name: catalogItem.name,
      x: rect.x,
      y: rect.y,
      width: catalogItem.width,
      height: catalogItem.height,
    })
    return true
  }

  const moveDuct = (id, newX, newY) => {
    const duct = state.ducts.find((d) => d.id === id)
    if (!duct) return false

    const rect = { x: newX, y: newY, width: duct.width, height: duct.height }
    if (!isInsidePanel(rect)) return false

    duct.x = newX
    duct.y = newY
    return true
  }

  const resizeDuct = (id, newWidth, newHeight) => {
    const duct = state.ducts.find((d) => d.id === id)
    if (!duct || newWidth < 20 || newHeight < 20) return false

    const rect = { x: duct.x, y: duct.y, width: newWidth, height: newHeight }
    if (!isInsidePanel(rect)) return false

    duct.width = newWidth
    duct.height = newHeight
    return true
  }

  const rotateDuct = (id) => {
    const duct = state.ducts.find((d) => d.id === id)
    if (!duct) return false

    const rect = { x: duct.x, y: duct.y, width: duct.height, height: duct.width }
    if (!isInsidePanel(rect)) return false
    ;[duct.width, duct.height] = [duct.height, duct.width]
    return true
  }

  const removeDuct = (id) => {
    state.ducts = state.ducts.filter((d) => d.id !== id)
  }

  // ===== УСТРОЙСТВА =====
  const findNearestRow = (x, y) => {
    if (!state.settings.snapToRow) return null

    let nearest = null
    let minDist = 30
    for (const row of state.rows) {
      if (x < row.x - 20 || x > row.x + row.width + 20) continue
      const dist = Math.abs(row.y - y)
      if (dist < minDist) {
        minDist = dist
        nearest = row
      }
    }
    return nearest
  }

  const findNextXInRow = (row, deviceWidth, excludeId = null) => {
    const devicesInRow = state.devices
      .filter((d) => d.rowId === row.id && d.id !== excludeId)
      .sort((a, b) => a.x - b.x)

    let x = row.x
    for (const d of devicesInRow) {
      if (x + deviceWidth <= d.x) break
      x = d.x + d.width + state.settings.gapBetweenDevices
    }
    if (x + deviceWidth > row.x + row.width) return null
    return x
  }

  const addDevice = (catalogItem, x, y) => {
    if (catalogItem.type === 'row') {
      const row = findNearestRow(x, y)
      if (!row) return false

      const nextX = findNextXInRow(row, catalogItem.width)
      if (nextX === null) return false

      state.devices.push({
        id: state.nextId++,
        catalogId: catalogItem.id,
        name: catalogItem.name,
        width: catalogItem.width,
        height: catalogItem.height,
        type: 'row',
        rowId: row.id,
        x: nextX,
        y: row.y,
      })
      return true
    } else {
      // Свободное размещение
      const rect = {
        x: x - catalogItem.width / 2,
        y: y - catalogItem.height / 2,
        width: catalogItem.width,
        height: catalogItem.height,
      }
      if (!isInsidePanel(rect)) return false

      state.devices.push({
        id: state.nextId++,
        catalogId: catalogItem.id,
        name: catalogItem.name,
        width: catalogItem.width,
        height: catalogItem.height,
        type: 'free',
        x: rect.x,
        y: rect.y,
      })
      return true
    }
  }

  const moveDevice = (id, newX, newY) => {
    const device = state.devices.find((d) => d.id === id)
    if (!device) return false

    if (device.type === 'row') {
      const row = findNearestRow(newX, newY)
      if (!row) return false

      const nextX = findNextXInRow(row, device.width, id)
      if (nextX === null) return false

      device.x = nextX
      device.y = row.y
      device.rowId = row.id
      return true
    } else {
      const rect = { x: newX, y: newY, width: device.width, height: device.height }
      if (!isInsidePanel(rect)) return false

      device.x = newX
      device.y = newY
      return true
    }
  }

  const removeDevice = (id) => {
    state.devices = state.devices.filter((d) => d.id !== id)
  }

  // ===== СТАТИСТИКА (опционально, для информации) =====
  const stats = computed(() => {
    const panelArea = state.panel.width * state.panel.height
    const devicesArea = state.devices.reduce((s, d) => s + d.width * d.height, 0)
    const ductsArea = state.ducts.reduce((s, d) => s + d.width * d.height, 0)
    const freePercent = ((panelArea - devicesArea - ductsArea) / panelArea) * 100

    return {
      panelArea,
      devicesArea,
      ductsArea,
      freePercent: Math.round(freePercent * 10) / 10,
      rowsCount: state.rows.length,
      devicesCount: state.devices.length,
      ductsCount: state.ducts.length,
    }
  })

  return {
    state,
    setPanel,
    addRow,
    removeRow,
    resizeRow,
    addDuct,
    moveDuct,
    resizeDuct,
    rotateDuct,
    removeDuct,
    addDevice,
    moveDevice,
    removeDevice,
    stats,
  }
}

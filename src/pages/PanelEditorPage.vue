<script setup>
import { useToast } from '@/composables/useToast'
import router from '@/router'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { projectsApi } from '@/api/projects'
import { panelLayoutsApi } from '@/api/panelLayouts'
import { useAuthStore } from '@/stores/auth'

const toast = useToast()
const route = useRoute()
const authStore = useAuthStore()

// --- КОНСТАНТЫ И НАСТРОЙКИ ---
const PIXELS_PER_MM = 2
const BASE_STEP_MM = 1
const RULER_SIZE = 30
const RULER_MARK_STEP_MM = 50

const DIN_RAIL_WIDTH_MM = 35
const DIN_RAIL_LENGTH_MM = 100
const SNAP_THRESHOLD_MM = 10

// --- СОСТОЯНИЕ РАБОТЫ С БД ---
const currentLayoutId = ref(null) // ID текущего загруженного макета
const layoutsList = ref([]) // Список всех макетов сборки
const isSavingToDb = ref(false)
const showLayoutsModal = ref(false)

// Макет правят только администраторы: остальные могут открыть панель и загрузить сохранённый макет
const canEdit = computed(() => authStore.isAdmin)

const panelMarginMm = ref(20)
const zoomPercent = ref(40)

// --- СОСТОЯНИЕ СЕТКИ ---
const isGridEnabled = ref(true)
const gridSizeMm = ref(10)

// --- МОДАЛЬНОЕ ОКНО УСТРОЙСТВ ---
const showDeviceModal = ref(false)

// ✅ ПРОВЕРКА: есть ли у устройства корректные размеры
const hasValidDimensions = (dev) => {
  return dev && dev.w > 0 && dev.h > 0
}

// Сохранить в БД (создать новый или обновить текущий)
const saveToDatabase = async (asNew = false) => {
  if (!canEdit.value) return
  if (isSavingToDb.value) return

  isSavingToDb.value = true
  try {
    const projectData = buildProjectData()
    const jsonString = JSON.stringify(projectData)

    if (currentLayoutId.value && !asNew) {
      // Обновляем существующий макет
      await panelLayoutsApi.update(currentLayoutId.value, {
        layoutData: jsonString,
      })
      toast.success('Макет сохранён')
    } else {
      // Создаём новый макет
      const created = await panelLayoutsApi.create({
        assemblyId: Number(route.params.assemblyId),
        layoutData: jsonString,
        isDefault: true,
      })
      currentLayoutId.value = created.id
      toast.success('Новый макет создан')
    }
  } catch (error) {
    console.error('Ошибка сохранения в БД:', error)
    toast.error('Не удалось сохранить макет')
  } finally {
    isSavingToDb.value = false
  }
}

// Загрузить макет из БД
const loadLayoutFromDb = async (layoutId) => {
  try {
    const layout = await panelLayoutsApi.getById(layoutId)
    const data = JSON.parse(layout.layoutData)

    // Используем ту же логику, что и для импорта из файла
    selectedPanelId.value = data.selectedPanelId || 1
    panelMarginMm.value = data.panelMarginMm ?? 20
    zoomPercent.value = data.zoomPercent ?? 40
    isGridEnabled.value = data.isGridEnabled ?? true
    gridSizeMm.value = data.gridSizeMm ?? 10
    items.value = data.items || []
    boxCounter = data.boxCounter || 1
    railCounter = data.railCounter || 1
    nextId =
      data.nextId || (items.value.length > 0 ? Math.max(...items.value.map((i) => i.id)) + 1 : 1)

    currentLayoutId.value = layout.id
    selectedItem.value = null
    selectedItems.value = []
    resetMeasure()

    toast.success('Макет загружен')
  } catch (error) {
    console.error('Ошибка загрузки макета:', error)
    toast.error('Не удалось загрузить макет')
  }
}

// Загрузить список макетов при открытии страницы
const loadLayoutsList = async () => {
  try {
    layoutsList.value = await panelLayoutsApi.getByAssembly(route.params.assemblyId)

    // Автоматически загружаем макет по умолчанию, если он есть
    const defaultLayout = layoutsList.value.find((l) => l.isDefault)
    if (defaultLayout) {
      await loadLayoutFromDb(defaultLayout.id)
    }
  } catch (error) {
    console.error('Ошибка загрузки списка макетов:', error)
  }
}

// Удалить макет из БД
const deleteLayout = async (layoutId) => {
  if (!canEdit.value) return
  if (!confirm('Удалить этот макет?')) return
  try {
    await panelLayoutsApi.delete(layoutId)
    layoutsList.value = layoutsList.value.filter((l) => l.id !== layoutId)
    if (currentLayoutId.value === layoutId) {
      currentLayoutId.value = null
    }
    toast.success('Макет удалён')
  } catch (error) {
    console.error('Ошибка удаления:', error)
    toast.error('Не удалось удалить макет')
  }
}

const openDeviceModal = () => {
  if (!canEdit.value) return
  devicePalette.value.forEach((dev) => {
    const available = getAvailableQuantity(dev.id)
    // Выбираем только если есть размеры и устройство доступно
    if (hasValidDimensions(dev) && available > 0) {
      selectedDevices.value[dev.id] = true
      deviceQuantities.value[dev.id] = available // Ставим максимум по умолчанию
    } else {
      selectedDevices.value[dev.id] = false
      deviceQuantities.value[dev.id] = 1
    }
  })
  showDeviceModal.value = true
}

const closeDeviceModal = () => {
  showDeviceModal.value = false
}

// --- ДАННЫЕ ---
const panels = [
  { id: 1, name: 'Микро', w: 200, h: 300 },
  { id: 2, name: 'Мини', w: 300, h: 400 },
  { id: 3, name: 'Небольшая', w: 400, h: 400 },
  { id: 4, name: 'Малая', w: 500, h: 500 },
  { id: 5, name: 'Средняя', w: 500, h: 600 },
  { id: 6, name: 'Широкая', w: 500, h: 700 },
  { id: 7, name: 'Большая', w: 600, h: 800 },
  { id: 8, name: 'Макси', w: 800, h: 1000 },
  { id: 9, name: 'Мега', w: 1000, h: 1200 },
]

// ИСПРАВЛЕНИЕ: используем ref для реактивности
const devicePalette = ref([])
const selectedDevices = ref({})
const deviceQuantities = ref({})

const selectedPanelId = ref(1)
const currentPanel = computed(() => panels.find((p) => p.id === selectedPanelId.value))

const currentScale = computed(() => zoomPercent.value / 50)

const panelWidthMm = computed(() => currentPanel.value.w)
const panelHeightMm = computed(() => currentPanel.value.h)

const panelWidthPx = computed(() => panelWidthMm.value * PIXELS_PER_MM)
const panelHeightPx = computed(() => panelHeightMm.value * PIXELS_PER_MM)

const scaledPanelWidthPx = computed(() => panelWidthPx.value * currentScale.value)

// Вписать панель целиком. Берём минимум из ширины и высоты: на широком экране
// узким местом почти всегда высота, а не ширина. Ограничения считаем по
// фактическим границам блока холста, а не по догадке о ширине сайдбара.
const fitZoomToScreen = () => {
  const el = canvasWrapper.value
  if (!el) return

  const pad = window.innerWidth <= 768 ? 12 : 24
  const rect = el.getBoundingClientRect()
  // на планшете блок холста не ограничен по высоте и растёт вместе с панелью,
  // поэтому в расчёт идёт только то, что действительно видно на экране
  const visibleTop = Math.max(rect.top, 0)
  const visibleBottom = Math.min(rect.bottom, window.innerHeight)
  const availW = rect.width - pad * 2
  const availH = visibleBottom - visibleTop - pad * 2
  if (availW <= 0 || availH <= 0) return

  // размер контейнера = масштаб × (линейка + панель в px при масштабе 100%)
  const spanX = RULER_SIZE + panelWidthPx.value
  const spanY = RULER_SIZE + panelHeightPx.value
  const scale = Math.min(availW / spanX, availH / spanY)

  zoomPercent.value = Math.max(10, Math.min(50, Math.round(scale * 50)))
}

// Автоподбор масштаба (открытие страницы, смена шкафа) — только на телефоне,
// чтобы не перебивать сохранённый пользователем масштаб на десктопе
const autoFitZoom = () => {
  if (window.innerWidth > 768) return
  fitZoomToScreen()
}

const zoomOut = () => {
  zoomPercent.value = Math.max(10, zoomPercent.value - 5)
}

const zoomIn = () => {
  zoomPercent.value = Math.min(50, zoomPercent.value + 5)
}
const scaledPanelHeightPx = computed(() => panelHeightPx.value * currentScale.value)
const scaledRulerSize = computed(() => RULER_SIZE * currentScale.value)

const items = ref([])
const selectedItem = ref(null)
const selectedItems = ref([])
let nextId = 1
let boxCounter = 1
let railCounter = 1

// --- ПОВОРОТ ---
const isRotated = (item) => !!item.rotated

const getDisplaySize = (item) => {
  return {
    w: item.rotated ? item.h : item.w,
    h: item.rotated ? item.w : item.h,
  }
}

// ✅ ИСПРАВЛЕНИЕ: надежный watch с учетом проверки размеров
watch(
  selectedDevices,
  (newVal) => {
    devicePalette.value.forEach((dev) => {
      // Принудительно снимаем галочку, если размеров нет
      if (!hasValidDimensions(dev)) {
        newVal[dev.id] = false
        return
      }

      if (newVal[dev.id]) {
        deviceQuantities.value[dev.id] = getAvailableQuantity(dev.id)
      } else {
        deviceQuantities.value[dev.id] = 1
      }
    })
  },
  { deep: true },
)

watch(
  items,
  () => {
    devicePalette.value.forEach((dev) => {
      if (selectedDevices.value[dev.id]) {
        const available = getAvailableQuantity(dev.id)
        if (deviceQuantities.value[dev.id] > available) {
          deviceQuantities.value[dev.id] = available
        }
        if (available === 0) {
          selectedDevices.value[dev.id] = false
        }
      }
    })
  },
  { deep: true },
)

const getAvailableQuantity = (devId) => {
  const dev = devicePalette.value.find((d) => d.id === devId)
  if (!dev) return 0
  return Math.max(0, dev.quantity - getDeviceUsedCount(devId))
}

// Сколько устройств сборки ещё ждёт своего места на панели
const devicesLeftToAdd = computed(() =>
  devicePalette.value.reduce((sum, dev) => sum + getAvailableQuantity(dev.id), 0),
)

// ✅ ИСПРАВЛЕНИЕ: учитываем hasValidDimensions в проверке возможности добавления
const canAddDevices = computed(() => {
  return devicePalette.value.some(
    (dev) =>
      hasValidDimensions(dev) &&
      selectedDevices.value[dev.id] &&
      getAvailableQuantity(dev.id) > 0 &&
      deviceQuantities.value[dev.id] > 0,
  )
})

const allDevicesAdded = computed(() => {
  if (devicePalette.value.length === 0) return false

  // Проверяем ВСЕ устройства в палитре.
  // Если у устройства нет размеров, оно не может быть добавлено,
  // getDeviceUsedCount для него вернет 0, и isDeviceFullyUsed вернет false.
  // Это корректно оставит статус "Не все устройства добавлены".
  return devicePalette.value.every((dev) => isDeviceFullyUsed(dev.id))
})

const incrementQuantity = (devId) => {
  const available = getAvailableQuantity(devId)
  if (deviceQuantities.value[devId] < available) {
    deviceQuantities.value[devId]++
  }
}

const decrementQuantity = (devId) => {
  if (deviceQuantities.value[devId] > 1) {
    deviceQuantities.value[devId]--
  }
}

// --- Функция для поиска центральной позиции в рабочей области ---
const findCenterPosition = (width, height) => {
  const margin = panelMarginMm.value
  const workAreaWidth = panelWidthMm.value - 2 * margin
  const workAreaHeight = panelHeightMm.value - 2 * margin

  const centerX = margin + (workAreaWidth - width) / 2
  const centerY = margin + (workAreaHeight - height) / 2

  return { x: centerX, y: centerY }
}

// --- Вспомогательная функция для поиска свободного места в рабочей зоне ---
const findFreePosition = (width, height, itemType = 'device') => {
  if (itemType === 'box' || itemType === 'din-rail') {
    return findCenterPosition(width, height)
  }

  const margin = panelMarginMm.value
  const gridStep = isGridEnabled.value ? gridSizeMm.value : BASE_STEP_MM

  let currentX = Math.ceil(margin / gridStep) * gridStep
  let currentY = Math.ceil(margin / gridStep) * gridStep

  const maxIterations = 10000
  let iterations = 0

  while (iterations < maxIterations) {
    iterations++

    if (currentX + width > panelWidthMm.value - margin) {
      currentX = Math.ceil(margin / gridStep) * gridStep
      currentY = Math.ceil((currentY + height) / gridStep) * gridStep
    }

    if (currentY + height > panelHeightMm.value - margin) {
      return null
    }

    const testItem = { x: currentX, y: currentY, w: width, h: height }
    let hasCollision = false
    let collisionItem = null

    for (const existingItem of items.value) {
      if (existingItem.type === 'din-rail') {
        continue
      }

      if (checkCollision(testItem, existingItem)) {
        hasCollision = true
        collisionItem = existingItem
        break
      }
    }

    if (!hasCollision) {
      return { x: currentX, y: currentY }
    }

    const { w: collisionW } = getDisplaySize(collisionItem)
    const endX = collisionItem.x + collisionW
    currentX = Math.ceil(endX / gridStep) * gridStep

    if (currentX <= endX) {
      currentX += gridStep
    }
  }

  return null
}

const checkCollision = (item1, item2) => {
  const { w: w1, h: h1 } = getDisplaySize(item1)
  const { w: w2, h: h2 } = getDisplaySize(item2)

  return !(
    item1.x + w1 <= item2.x ||
    item2.x + w2 <= item1.x ||
    item1.y + h1 <= item2.y ||
    item2.y + h2 <= item1.y
  )
}

const addSelectedDevices = () => {
  const devicesToAdd = []

  devicePalette.value.forEach((dev) => {
    // Дополнительная защита: добавляем только устройства с размерами
    if (
      hasValidDimensions(dev) &&
      selectedDevices.value[dev.id] &&
      deviceQuantities.value[dev.id] > 0
    ) {
      const qty = Math.min(deviceQuantities.value[dev.id], getAvailableQuantity(dev.id))
      for (let i = 0; i < qty; i++) {
        devicesToAdd.push({ ...dev })
      }
    }
  })

  if (devicesToAdd.length === 0) return

  devicesToAdd.forEach((dev) => {
    const itemWidth = dev.w
    const itemHeight = dev.h
    const pos = findFreePosition(itemWidth, itemHeight, 'device')

    if (!pos) {
      alert(`Не удалось разместить "${dev.name}". Нет свободного места.`)
      return
    }

    const newItem = {
      id: nextId++,
      type: 'device',
      deviceId: dev.id,
      name: dev.name,
      x: pos.x,
      y: pos.y,
      w: itemWidth,
      h: itemHeight,
      rotated: false,
    }

    items.value.push(newItem)
  })

  // Сброс состояний после добавления
  devicePalette.value.forEach((dev) => {
    selectedDevices.value[dev.id] = false
    deviceQuantities.value[dev.id] = 1
  })
}

const addSelectedDevicesAndClose = () => {
  addSelectedDevices()
  closeDeviceModal()
}

// --- СОСТОЯНИЕ ИЗМЕРЕНИЯ ---
const isMeasuring = ref(false)
const isOrthogonal = ref(false)
const pointA = ref(null)
const pointB = ref(null)
const previewPoint = ref(null)
const rawMousePoint = ref(null)

// --- СОСТОЯНИЕ ВЫДЕЛЕНИЯ РАМКОЙ ---
const isSelecting = ref(false)
const selectionStart = ref(null)
const selectionCurrent = ref(null)
const justFinishedSelection = ref(false)

// --- СОСТОЯНИЕ RESIZE ---
const mousePosition = ref(null)

const measureResult = computed(() => {
  if (!pointA.value || !pointB.value) return { distance: 0, dx: 0, dy: 0 }

  const dx = pointB.value.x - pointA.value.x
  const dy = pointB.value.y - pointA.value.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  return {
    distance: Math.round(distance * 100) / 100,
    dx: Math.round(dx * 100) / 100,
    dy: Math.round(dy * 100) / 100,
  }
})

// --- ПОДСЧЕТ ИСПОЛЬЗОВАННЫХ УСТРОЙСТВ ---
const getDeviceUsedCount = (devId) => {
  return items.value.filter((item) => item.type === 'device' && item.deviceId === devId).length
}

const isDeviceFullyUsed = (devId) => {
  const dev = devicePalette.value.find((d) => d.id === devId)
  if (!dev) return false
  return getDeviceUsedCount(devId) >= dev.quantity
}

const getItemTypeName = (type) => {
  const names = {
    device: 'Устройство',
    box: 'Короб',
    'din-rail': 'DIN-рейка',
  }
  return names[type] || type
}

// --- РАЗМЕТКА (ЛИНЕЙКИ) ---
const xMarks = computed(() => {
  const marks = []
  for (let i = 0; i <= panelWidthMm.value; i += RULER_MARK_STEP_MM) {
    marks.push({ id: `x-${i}`, value: i })
  }
  return marks
})

const yMarks = computed(() => {
  const marks = []
  for (let i = 0; i <= panelHeightMm.value; i += RULER_MARK_STEP_MM) {
    marks.push({ id: `y-${i}`, value: i })
  }
  return marks
})

// --- СТИЛИ ---
const containerStyle = computed(() => ({
  width: `${scaledRulerSize.value + scaledPanelWidthPx.value}px`,
  height: `${scaledRulerSize.value + scaledPanelHeightPx.value}px`,
}))

const rulerXStyle = computed(() => ({
  left: `${scaledRulerSize.value}px`,
  top: '0px',
  height: `${scaledRulerSize.value}px`,
  width: `${scaledPanelWidthPx.value}px`,
}))

const rulerYStyle = computed(() => ({
  left: '0px',
  top: `${scaledRulerSize.value}px`,
  width: `${scaledRulerSize.value}px`,
  height: `${scaledPanelHeightPx.value}px`,
}))

const canvasStyle = computed(() => ({
  width: `${scaledPanelWidthPx.value}px`,
  height: `${scaledPanelHeightPx.value}px`,
  left: `${scaledRulerSize.value}px`,
  top: `${scaledRulerSize.value}px`,
  backgroundSize: isGridEnabled.value
    ? `${gridSizeMm.value * PIXELS_PER_MM * currentScale.value}px ${gridSizeMm.value * PIXELS_PER_MM * currentScale.value}px`
    : 'none',
}))

const getItemStyle = (item) => {
  const isSelected = selectedItems.value.includes(item)
  const { w, h } = getDisplaySize(item)

  let zIndex = 15
  if (item.type === 'din-rail') {
    zIndex = 1
  } else if (item.type === 'device') {
    zIndex = 20
  }

  if (isSelected) {
    zIndex = 50
  }

  return {
    left: `${item.x * PIXELS_PER_MM * currentScale.value}px`,
    top: `${item.y * PIXELS_PER_MM * currentScale.value}px`,
    width: `${w * PIXELS_PER_MM * currentScale.value}px`,
    height: `${h * PIXELS_PER_MM * currentScale.value}px`,
    zIndex: zIndex,
  }
}

const getMarkStyle = (mmValue, axis) => {
  const scaledPos = mmValue * PIXELS_PER_MM * currentScale.value
  return axis === 'x' ? { left: `${scaledPos}px` } : { top: `${scaledPos}px` }
}

// --- ПЛАВАЮЩИЕ КНОПКИ ДЕЙСТВИЙ ---
const floatingActionsStyle = computed(() => {
  if (!selectedItem.value) return { display: 'none' }

  const item = selectedItem.value
  const { w, h } = getDisplaySize(item)
  const scale = currentScale.value
  const centerX = (item.x + w / 2) * PIXELS_PER_MM * scale
  const topY = item.y * PIXELS_PER_MM * scale

  const showBelow = item.y < 5
  const yOffset = showBelow ? h * PIXELS_PER_MM * scale + 8 : -44

  return {
    left: `${centerX}px`,
    top: `${topY + yOffset}px`,
  }
})

// --- TOOLTIP С РАЗМЕРАМИ ---
const tooltipStyle = computed(() => {
  if (!mousePosition.value) return { display: 'none' }

  return {
    left: `${mousePosition.value.x + 15}px`,
    top: `${mousePosition.value.y - 10}px`,
  }
})

// --- УТИЛИТЫ ---
const snapToGrid = (val) => {
  const step = isGridEnabled.value ? gridSizeMm.value : BASE_STEP_MM
  return Math.round(val / step) * step
}

const mmToPx = (mm) => mm * PIXELS_PER_MM * currentScale.value

const isOutOfBounds = (item) => {
  const margin = panelMarginMm.value
  const { w, h } = getDisplaySize(item)
  return (
    item.x < margin ||
    item.y < margin ||
    item.x + w > panelWidthMm.value - margin ||
    item.y + h > panelHeightMm.value - margin
  )
}

const isFullyInsideSelection = (item, start, current) => {
  const scale = currentScale.value
  const { w, h } = getDisplaySize(item)
  const itemLeft = item.x * PIXELS_PER_MM * scale
  const itemTop = item.y * PIXELS_PER_MM * scale
  const itemRight = itemLeft + w * PIXELS_PER_MM * scale
  const itemBottom = itemTop + h * PIXELS_PER_MM * scale

  const selectLeft = Math.min(start.x, current.x)
  const selectTop = Math.min(start.y, current.y)
  const selectRight = Math.max(start.x, current.x)
  const selectBottom = Math.max(start.y, current.y)

  return (
    itemLeft >= selectLeft &&
    itemTop >= selectTop &&
    itemRight <= selectRight &&
    itemBottom <= selectBottom
  )
}

// --- ПРИМАГНИЧИВАНИЕ К DIN-РЕЙКЕ ---
const findSnapPosition = (item, newX, newY) => {
  let snappedX = newX
  let snappedY = newY

  const { w: itemW, h: itemH } = getDisplaySize(item)
  const itemCenterX = newX + itemW / 2
  const itemCenterY = newY + itemH / 2

  for (const rail of items.value.filter((i) => i.type === 'din-rail')) {
    const { w: railW, h: railH } = getDisplaySize(rail)
    const railCenterX = rail.x + railW / 2
    const railCenterY = rail.y + railH / 2
    const isHorizontal = railW >= railH

    if (isHorizontal) {
      const isOverRail = itemCenterX >= rail.x && itemCenterX <= rail.x + railW
      const isCloseY = Math.abs(itemCenterY - railCenterY) <= SNAP_THRESHOLD_MM

      if (isOverRail && isCloseY) {
        snappedY = snapToGrid(railCenterY - itemH / 2)
      }
    } else {
      const isOverRail = itemCenterY >= rail.y && itemCenterY <= rail.y + railH
      const isCloseX = Math.abs(itemCenterX - railCenterX) <= SNAP_THRESHOLD_MM

      if (isOverRail && isCloseX) {
        snappedX = snapToGrid(railCenterX - itemW / 2)
      }
    }
  }

  return { x: snappedX, y: snappedY }
}

// --- КООРДИНАТЫ ---
const getMmFromEvent = (e) => {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const contentX = screenX - el.clientLeft
  const contentY = screenY - el.clientTop

  const scale = currentScale.value
  const mmX = contentX / (PIXELS_PER_MM * scale)
  const mmY = contentY / (PIXELS_PER_MM * scale)

  return {
    x: Math.round(mmX * 100) / 100,
    y: Math.round(mmY * 100) / 100,
  }
}

const getPxFromEvent = (e, el) => {
  const rect = el.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const contentX = screenX - el.clientLeft
  const contentY = screenY - el.clientTop

  return { x: contentX, y: contentY }
}

const applyOrthogonal = (point) => {
  if (!isOrthogonal.value || !pointA.value || !point) return point

  const dx = Math.abs(point.x - pointA.value.x)
  const dy = Math.abs(point.y - pointA.value.y)

  if (dx >= dy) {
    return { x: point.x, y: pointA.value.y }
  } else {
    return { x: pointA.value.x, y: point.y }
  }
}

// --- ЛОГИКА ИЗМЕРЕНИЯ ---
const toggleMeasureMode = () => {
  if (!canEdit.value) return
  isMeasuring.value = !isMeasuring.value
  if (!isMeasuring.value) {
    resetMeasure()
  }
}

const toggleOrthogonal = () => {
  isOrthogonal.value = !isOrthogonal.value
  if (isMeasuring.value && pointA.value && rawMousePoint.value) {
    previewPoint.value = applyOrthogonal(rawMousePoint.value)
  }
}

const resetMeasure = () => {
  pointA.value = null
  pointB.value = null
  previewPoint.value = null
  rawMousePoint.value = null
}

// --- ЛОГИКА ВЫДЕЛЕНИЯ РАМКОЙ ---
const onCanvasMouseDown = (e) => {
  if (e.target.closest('.panel-item')) return
  if (e.target.closest('.floating-actions')) return
  if (isMeasuring.value) return

  const el = e.currentTarget
  const px = getPxFromEvent(e, el)
  selectionStart.value = px
  selectionCurrent.value = px
  isSelecting.value = true
  justFinishedSelection.value = false

  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
}

const onWindowMouseMove = (e) => {
  if (!isSelecting.value || !selectionStart.value) return
  const canvas = document.querySelector('.canvas')
  if (canvas) {
    selectionCurrent.value = getPxFromEvent(e, canvas)
  }
}

const onWindowMouseUp = () => {
  if (!isSelecting.value) return

  if (selectionStart.value && selectionCurrent.value) {
    const newSelection = items.value.filter((item) =>
      isFullyInsideSelection(item, selectionStart.value, selectionCurrent.value),
    )

    if (newSelection.length > 0) {
      selectedItems.value = newSelection
      selectedItem.value = newSelection.length === 1 ? newSelection[0] : null
      justFinishedSelection.value = true

      setTimeout(() => {
        justFinishedSelection.value = false
      }, 0)
    }
  }

  isSelecting.value = false
  selectionStart.value = null
  selectionCurrent.value = null

  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
}

const onCanvasClick = (e) => {
  if (e.target.closest('.panel-item')) return
  if (e.target.closest('.floating-actions')) return

  if (justFinishedSelection.value) return

  if (isMeasuring.value) {
    const rawPoint = getMmFromEvent(e)
    const point = applyOrthogonal(rawPoint)

    if (!pointA.value) {
      pointA.value = point
      previewPoint.value = point
    } else if (!pointB.value) {
      pointB.value = point
      previewPoint.value = null
      rawMousePoint.value = null
    } else {
      pointA.value = point
      pointB.value = null
      previewPoint.value = point
    }
  } else {
    selectedItems.value = []
    selectedItem.value = null
  }
}

const onCanvasMouseMove = (e) => {
  if (!isMeasuring.value || !pointA.value || pointB.value) return
  const rawPoint = getMmFromEvent(e)
  rawMousePoint.value = rawPoint
  previewPoint.value = applyOrthogonal(rawPoint)
}

// --- ЛОГИКА ДОБАВЛЕНИЯ ---
const onPanelChange = () => {
  if (!canEdit.value) return
  selectedItem.value = null
  selectedItems.value = []
  resetMeasure()
  autoFitZoom()
}

const addBox = () => {
  if (!canEdit.value) return
  const newBox = {
    id: nextId++,
    type: 'box',
    name: `Короб ${boxCounter}`,
    x: panelMarginMm.value,
    y: panelMarginMm.value,
    w: 25,
    h: 25,
    rotated: false,
  }

  const pos = findFreePosition(newBox.w, newBox.h, 'box')
  if (pos) {
    newBox.x = pos.x
    newBox.y = pos.y
    items.value.push(newBox)
    selectedItems.value = [newBox]
    selectedItem.value = newBox
    boxCounter++
  } else {
    alert('Нет свободного места для нового короба!')
  }
}

const addDinRail = () => {
  if (!canEdit.value) return
  const newRail = {
    id: nextId++,
    type: 'din-rail',
    name: `DIN-рейка ${railCounter}`,
    x: panelMarginMm.value,
    y: panelMarginMm.value,
    w: DIN_RAIL_LENGTH_MM,
    h: DIN_RAIL_WIDTH_MM,
    rotated: false,
  }

  const pos = findFreePosition(newRail.w, newRail.h, 'din-rail')
  if (pos) {
    newRail.x = pos.x
    newRail.y = pos.y
    items.value.push(newRail)
    selectedItems.value = [newRail]
    selectedItem.value = newRail
    railCounter++
  } else {
    alert('Нет свободного места для новой DIN-рейки!')
  }
}

const copyItem = () => {
  if (!canEdit.value) return
  if (!selectedItem.value) return
  if (selectedItem.value.type !== 'box' && selectedItem.value.type !== 'din-rail') return

  const original = selectedItem.value
  const isBox = original.type === 'box'
  const { w, h } = getDisplaySize(original)

  const copiedItem = {
    id: nextId++,
    type: original.type,
    name: isBox ? `Короб ${boxCounter}` : `DIN-рейка ${railCounter}`,
    x: panelMarginMm.value,
    y: panelMarginMm.value,
    w: original.w,
    h: original.h,
    rotated: original.rotated,
  }

  const pos = findFreePosition(w, h, original.type)
  if (pos) {
    copiedItem.x = pos.x
    copiedItem.y = pos.y
    items.value.push(copiedItem)
    selectedItems.value = [copiedItem]
    selectedItem.value = copiedItem
    if (isBox) boxCounter++
    else railCounter++
  } else {
    alert('Нет свободного места для копирования!')
  }
}

const rotateItem = () => {
  if (!canEdit.value) return
  if (!selectedItem.value) return
  const item = selectedItem.value
  if (item.type !== 'device' && item.type !== 'din-rail') return

  item.rotated = !item.rotated

  if (isOutOfBounds(item)) {
    let adjustedX = item.x
    let adjustedY = item.y
    const margin = panelMarginMm.value
    const { w: newW, h: newH } = getDisplaySize(item)

    if (adjustedX + newW > panelWidthMm.value - margin) {
      adjustedX = panelWidthMm.value - margin - newW
    }
    if (adjustedY + newH > panelHeightMm.value - margin) {
      adjustedY = panelHeightMm.value - margin - newH
    }

    if (adjustedX < margin || adjustedY < margin) {
      item.rotated = !item.rotated
      return
    }

    item.x = adjustedX
    item.y = adjustedY
  }
}

const deleteSelectedItems = () => {
  if (!canEdit.value) return
  if (selectedItems.value.length === 0) return
  items.value = items.value.filter((i) => !selectedItems.value.includes(i))
  selectedItems.value = []
  selectedItem.value = null
}

// --- DRAG & RESIZE ---
// Пальцем элемент двигается только после долгого нажатия: короткий сдвиг означает
// «панорамируем холст», иначе любой промах пальца ломал бы раскладку
const LONG_PRESS_MS = 350
const TAP_SLOP_PX = 10

let dragState = null
let resizeState = null
let touchGesture = null
const isDragging = ref(false)

const beginDrag = (x, y, item, pointerId) => {
  if (!selectedItems.value.includes(item)) {
    selectedItems.value = [item]
    selectedItem.value = item
  }

  dragState = {
    type: 'move',
    pointerId,
    items: [...selectedItems.value],
    startPositions: selectedItems.value.map((i) => ({ x: i.x, y: i.y })),
    startMouseX: x,
    startMouseY: y,
  }
  isDragging.value = true
}

const attachDragListeners = () => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

const endTouchGesture = () => {
  if (touchGesture?.timer) clearTimeout(touchGesture.timer)
  touchGesture = null
  window.removeEventListener('pointermove', onTouchMove)
  window.removeEventListener('pointerup', endTouchGesture)
  window.removeEventListener('pointercancel', endTouchGesture)
}

const onTouchMove = (e) => {
  const g = touchGesture
  if (!g || e.pointerId !== g.pointerId || dragState) return

  const dx = e.clientX - g.startX
  const dy = e.clientY - g.startY
  if (!g.panning && Math.hypot(dx, dy) < TAP_SLOP_PX) return

  if (!g.panning) {
    clearTimeout(g.timer)
    g.panning = true
  }

  // touch-action: none на элементе отбирает у браузера право прокручивать холст
  // этим пальцем, поэтому сдвиг обрабатываем сами
  const el = canvasWrapper.value
  if (el) {
    el.scrollLeft = g.scrollLeft - dx
    el.scrollTop = g.scrollTop - dy
  }
}

const startDrag = (e, item) => {
  if (isMeasuring.value || isSelecting.value) return
  if (e.target.classList.contains('resize-handle')) return

  if (!selectedItems.value.includes(item)) {
    selectedItems.value = [item]
    selectedItem.value = item
  }

  if (!canEdit.value) return

  // Мышь и стилус двигают сразу, палец — только после долгого нажатия
  if (e.pointerType !== 'touch') {
    e.preventDefault()
    beginDrag(e.clientX, e.clientY, item, e.pointerId)
    attachDragListeners()
    return
  }

  // Второй палец означает щипок: снимаем ожидание долгого нажатия и активное
  // перетаскивание, иначе пошло бы за чужим пальцем
  if (touchGesture && touchGesture.pointerId !== e.pointerId) {
    endTouchGesture()
    onPointerUp()
    return
  }

  touchGesture = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    scrollLeft: canvasWrapper.value?.scrollLeft ?? 0,
    scrollTop: canvasWrapper.value?.scrollTop ?? 0,
    panning: false,
    timer: setTimeout(() => {
      if (!touchGesture) return
      navigator.vibrate?.(15)
      beginDrag(touchGesture.startX, touchGesture.startY, item, touchGesture.pointerId)
      attachDragListeners()
    }, LONG_PRESS_MS),
  }
  window.addEventListener('pointermove', onTouchMove)
  window.addEventListener('pointerup', endTouchGesture)
  window.addEventListener('pointercancel', endTouchGesture)
}

const startResize = (e, item, direction) => {
  if (!canEdit.value) return
  if (isMeasuring.value || isSelecting.value) return
  e.preventDefault()
  selectedItem.value = item

  const { w, h } = getDisplaySize(item)

  resizeState = {
    type: 'resize',
    pointerId: e.pointerId,
    item,
    direction,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startItemX: item.x,
    startItemY: item.y,
    startItemW: w,
    startItemH: h,
  }
  isDragging.value = true
  attachDragListeners()
}

const onPointerMove = (e) => {
  // жест ведёт только тот палец/мышь, на котором он начался
  const anchor = dragState || resizeState
  if (!anchor || e.pointerId !== anchor.pointerId) return

  const scale = currentScale.value
  const scaledPixelPerMm = PIXELS_PER_MM * scale
  const margin = panelMarginMm.value

  const rawDxMm = (e.clientX - anchor.startMouseX) / scaledPixelPerMm
  const rawDyMm = (e.clientY - anchor.startMouseY) / scaledPixelPerMm

  if (dragState) {
    dragState.startPositions.forEach((pos, idx) => {
      const item = dragState.items[idx]
      let newX = snapToGrid(pos.x + rawDxMm)
      let newY = snapToGrid(pos.y + rawDyMm)

      if (item.type === 'device') {
        const snapped = findSnapPosition(item, newX, newY)
        newX = snapped.x
        newY = snapped.y
      }

      const { w, h } = getDisplaySize(item)

      if (newX < margin) newX = margin
      if (newX + w > panelWidthMm.value - margin) newX = panelWidthMm.value - margin - w
      if (newY < margin) newY = margin
      if (newY + h > panelHeightMm.value - margin) newY = panelHeightMm.value - margin - h

      item.x = newX
      item.y = newY
    })
  }

  if (resizeState) {
    const { direction, startItemX, startItemY, startItemW, startItemH } = resizeState
    const item = resizeState.item

    let newX = startItemX
    let newY = startItemY
    let newW = startItemW
    let newH = startItemH

    if (item.type === 'din-rail') {
      const isHorizontal = startItemW >= startItemH

      if (isHorizontal) {
        if (direction.includes('e')) {
          newW = Math.max(DIN_RAIL_WIDTH_MM, snapToGrid(startItemW + rawDxMm))
          newH = DIN_RAIL_WIDTH_MM
        } else if (direction.includes('w')) {
          const snappedDx = snapToGrid(rawDxMm)
          const maxLeftShift = startItemW - DIN_RAIL_WIDTH_MM
          const clampedDx = Math.max(-maxLeftShift, snappedDx)
          newX = startItemX + clampedDx
          newW = startItemW - clampedDx
          newH = DIN_RAIL_WIDTH_MM
        }

        if (newX < margin) {
          const overflow = margin - newX
          newX = margin
          newW = newW - overflow
        }
        if (newX + newW > panelWidthMm.value - margin) {
          newW = panelWidthMm.value - margin - newX
        }
        if (newW < DIN_RAIL_WIDTH_MM) newW = DIN_RAIL_WIDTH_MM
      } else {
        if (direction.includes('s')) {
          newH = Math.max(DIN_RAIL_WIDTH_MM, snapToGrid(startItemH + rawDyMm))
          newW = DIN_RAIL_WIDTH_MM
        } else if (direction.includes('n')) {
          const snappedDy = snapToGrid(rawDyMm)
          const maxTopShift = startItemH - DIN_RAIL_WIDTH_MM
          const clampedDy = Math.max(-maxTopShift, snappedDy)
          newY = startItemY + clampedDy
          newH = startItemH - clampedDy
          newW = DIN_RAIL_WIDTH_MM
        }

        if (newY < margin) {
          const overflow = margin - newY
          newY = margin
          newH = newH - overflow
        }
        if (newY + newH > panelHeightMm.value - margin) {
          newH = panelHeightMm.value - margin - newY
        }
        if (newH < DIN_RAIL_WIDTH_MM) newH = DIN_RAIL_WIDTH_MM
      }
    } else {
      if (direction.includes('e')) {
        newW = Math.max(1, snapToGrid(startItemW + rawDxMm))
      } else if (direction.includes('w')) {
        const snappedDx = snapToGrid(rawDxMm)
        const maxLeftShift = startItemW - 1
        const clampedDx = Math.max(-maxLeftShift, snappedDx)
        newX = startItemX + clampedDx
        newW = startItemW - clampedDx
      }

      if (direction.includes('s')) {
        newH = Math.max(1, snapToGrid(startItemH + rawDyMm))
      } else if (direction.includes('n')) {
        const snappedDy = snapToGrid(rawDyMm)
        const maxTopShift = startItemH - 1
        const clampedDy = Math.max(-maxTopShift, snappedDy)
        newY = startItemY + clampedDy
        newH = startItemH - clampedDy
      }

      if (newX < margin) {
        newW = newW - (margin - newX)
        newX = margin
      }
      if (newX + newW > panelWidthMm.value - margin) {
        newW = panelWidthMm.value - margin - newX
      }
      if (newY < margin) {
        newH = newH - (margin - newY)
        newY = margin
      }
      if (newY + newH > panelHeightMm.value - margin) {
        newH = panelHeightMm.value - margin - newY
      }
    }

    if (item.rotated) {
      item.w = newH
      item.h = newW
    } else {
      item.w = newW
      item.h = newH
    }

    item.x = newX
    item.y = newY

    const canvas = document.querySelector('.canvas')
    if (canvas) {
      mousePosition.value = getPxFromEvent(e, canvas)
    }
  }
}

const onPointerUp = () => {
  dragState = null
  resizeState = null
  mousePosition.value = null
  isDragging.value = false
  endTouchGesture()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

// Точная доводка пальцем. Шаг не округляем к сетке: при сетке 10 мм смещение
// на 1 мм вернулось бы ровно на то же место
const nudgeStepMm = ref(1)

const moveSelectedItemBy = (dxMm, dyMm) => {
  if (!canEdit.value || selectedItems.value.length === 0) return
  const margin = panelMarginMm.value

  selectedItems.value.forEach((item) => {
    const { w, h } = getDisplaySize(item)
    let x = item.x + dxMm
    let y = item.y + dyMm
    if (x < margin) x = margin
    if (x + w > panelWidthMm.value - margin) x = panelWidthMm.value - margin - w
    if (y < margin) y = margin
    if (y + h > panelHeightMm.value - margin) y = panelHeightMm.value - margin - h
    item.x = x
    item.y = y
  })
}

const showTrueSize = (width, height) => {
  if (width >= height) return `${height} x ${width}`
  return `${width} x ${height}`
}

// --- СОХРАНЕНИЕ И ЗАГРУЗКА ПРОЕКТА ---
const fileInput = ref(null)
const canvasWrapper = ref(null)

const triggerImport = () => {
  if (!canEdit.value) return
  fileInput.value?.click()
}

const buildProjectData = () => {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    selectedPanelId: selectedPanelId.value,
    panelMarginMm: panelMarginMm.value,
    zoomPercent: zoomPercent.value,
    isGridEnabled: isGridEnabled.value,
    gridSizeMm: gridSizeMm.value,
    items: items.value.map((item) => ({ ...item })),
    boxCounter: boxCounter,
    railCounter: railCounter,
    nextId: nextId,
  }
}

const fallbackExport = () => {
  const projectData = buildProjectData()
  const jsonString = JSON.stringify(projectData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `panel-project-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const exportProject = async () => {
  if (!canEdit.value) return
  const projectData = buildProjectData()
  const jsonString = JSON.stringify(projectData, null, 2)

  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: `panel-project-${Date.now()}.json`,
        types: [{ description: 'Файл проекта панели', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await fileHandle.createWritable()
      await writable.write(jsonString)
      await writable.close()
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Ошибка при сохранении файла:', error)
        alert('Ошибка при сохранении файла: ' + error.message)
      }
    }
  } else {
    fallbackExport()
  }
}

const importProject = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (data.version !== '1.0') {
        alert('Неподдерживаемая версия формата проекта')
        return
      }

      selectedPanelId.value = data.selectedPanelId || 1
      panelMarginMm.value = data.panelMarginMm ?? 25
      zoomPercent.value = data.zoomPercent ?? 40
      isGridEnabled.value = data.isGridEnabled ?? true
      gridSizeMm.value = data.gridSizeMm ?? 10
      items.value = data.items || []
      boxCounter = data.boxCounter || 1
      railCounter = data.railCounter || 1
      nextId =
        data.nextId || (items.value.length > 0 ? Math.max(...items.value.map((i) => i.id)) + 1 : 1)

      selectedItem.value = null
      selectedItems.value = []
      resetMeasure()
    } catch (error) {
      alert('Ошибка при загрузке файла: ' + error.message)
    }
  }

  reader.onerror = () => {
    alert('Ошибка чтения файла')
  }

  reader.readAsText(file)
  event.target.value = ''
}

const clearProject = () => {
  if (!canEdit.value) return
  if (items.value.length === 0) return

  const confirmed = confirm(
    'Вы уверены, что хотите очистить проект?\n\nВсе элементы (короба, DIN-рейки, устройства) будут удалены. Это действие нельзя отменить.',
  )
  if (!confirmed) return

  items.value = []
  selectedItem.value = null
  selectedItems.value = []
  nextId = 1
  boxCounter = 1
  railCounter = 1
  resetMeasure()
}

const assemblyDevices = ref(null)

const loadAndCloseModal = async (layoutId) => {
  await loadLayoutFromDb(layoutId)
  showLayoutsModal.value = false
}

const loadAssemblyDevices = async () => {
  try {
    const rawDevices = await projectsApi.getAssemblyDevicesWithDetails(route.params.assemblyId)

    assemblyDevices.value = (rawDevices || []).map((item) => ({
      id: item.id,
      assemblyId: item.assemblyId,
      deviceId: item.deviceId,
      quantity: item.quantity ?? 1,
      article: item.article || '—',
      description: item.description || '—',
      width: item.width,
      height: item.height,
      depth: item.depth,
      brand: item.brand || '—',
      deviceType: item.deviceType || '—',
      properties: item.properties || [],
    }))

    devicePalette.value = (rawDevices || []).map((device) => ({
      id: device.id,
      name: device.description || `Устройство ${device.id}`,
      w: device.width || 0,
      h: device.height || 0,
      quantity: device.quantity ?? 1,
    }))

    // Инициализация состояний
    const newSelected = {}
    const newQuantities = {}
    devicePalette.value.forEach((dev) => {
      newSelected[dev.id] = false
      newQuantities[dev.id] = 1
    })

    selectedDevices.value = newSelected
    deviceQuantities.value = newQuantities
  } catch (error) {
    toast.error('Не удалось загрузить устройства сборки')
    console.error('Не удалось загрузить устройства сборки', error)
  }
}

// Быстрые инструменты внизу экрана для телефона — остальное есть в сайдбаре
const mobileTools = computed(() => [
  {
    icon: isSavingToDb.value ? '⏳' : '💾',
    label: 'Сохранить',
    run: () => saveToDatabase(false),
    disabled: () => isSavingToDb.value,
  },
  { icon: '⚡', label: 'Устройства', run: () => openDeviceModal() },
  {
    icon: '📏',
    label: 'Измерить',
    run: () => toggleMeasureMode(),
    active: () => isMeasuring.value,
  },
  { icon: '▢', label: 'Короб', run: () => addBox() },
  { icon: '═', label: 'Рейка', run: () => addDinRail() },
  {
    icon: '📋',
    label: 'Макеты',
    run: () => (showLayoutsModal.value = true),
  },
])

onMounted(async () => {
  // Палец, дёргающий панель, не должен случайно вызвать pull-to-refresh всей страницы
  document.documentElement.classList.add('panel-editor-page')

  // Без этого при прямом заходе на страницу user пустой и isAdmin=false даже у администратора
  await authStore.fetchMe()
  await loadAssemblyDevices()
  await loadLayoutsList()
  autoFitZoom()
})

onUnmounted(() => {
  document.documentElement.classList.remove('panel-editor-page')
  endTouchGesture()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})
</script>

<template>
  <div class="global-container">
    <div class="editor-layout">
      <!-- Боковая панель управления -->
      <aside class="editor-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header__text">
            <h2 class="sidebar-title">Монтажная панель</h2>
            <p class="sidebar-subtitle">
              Проект {{ route.params.projectId }} · Сборка {{ route.params.assemblyId }}
            </p>
          </div>
          <button class="sidebar-back" @click="router.back()" title="Назад к сборке">←</button>
        </div>

        <div class="status-chip" :class="allDevicesAdded ? 'status-chip--ok' : 'status-chip--warn'">
          <span class="status-chip__dot"></span>
          <span>{{
            allDevicesAdded ? 'Все устройства на панели' : 'Не все устройства добавлены'
          }}</span>
        </div>

        <p v-if="!canEdit" class="readonly-hint">
          Режим просмотра: изменять панель может только администратор. Макет загрузить можно.
        </p>

        <!-- Свойства выбранного элемента -->
        <div class="sidebar-section" v-if="selectedItem && selectedItems.length === 1">
          <h3 class="section-title">Свойства</h3>
          <div class="properties-grid">
            <div class="property-item">
              <span class="property-label">ID:</span>
              <span class="property-value">{{ selectedItem.id }}</span>
            </div>
            <div class="property-item">
              <span class="property-label">Тип:</span>
              <span class="property-value">{{ getItemTypeName(selectedItem.type) }}</span>
            </div>
            <div class="property-item">
              <span class="property-label">Размер:</span>
              <span class="property-value">
                Ш{{ selectedItem.w }}×В{{ selectedItem.h }} мм
                <span v-if="selectedItem.rotated" class="rotation-badge">(повёрнуто)</span>
              </span>
            </div>
            <div class="property-item">
              <span class="property-label">Позиция:</span>
              <span class="property-value"
                >X:{{ selectedItem.x }} мм, Y:{{ selectedItem.y }} мм</span
              >
            </div>
          </div>
        </div>

        <!-- Точная доводка: пальцем по холсту в 1 мм не попасть -->
        <div class="sidebar-section" v-if="canEdit && selectedItem && selectedItems.length === 1">
          <h3 class="section-title">Точное перемещение</h3>
          <div class="nudge">
            <div class="nudge__pad">
              <span></span>
              <button class="nudge__btn" @click="moveSelectedItemBy(0, -nudgeStepMm)">▲</button>
              <span></span>
              <button class="nudge__btn" @click="moveSelectedItemBy(-nudgeStepMm, 0)">◀</button>
              <span class="nudge__center">{{ selectedItem.x }},{{ selectedItem.y }}</span>
              <button class="nudge__btn" @click="moveSelectedItemBy(nudgeStepMm, 0)">▶</button>
              <span></span>
              <button class="nudge__btn" @click="moveSelectedItemBy(0, nudgeStepMm)">▼</button>
              <span></span>
            </div>
            <div class="nudge__steps">
              <button
                v-for="step in [1, 5, 10]"
                :key="step"
                :class="['step-chip', { active: nudgeStepMm === step }]"
                @click="nudgeStepMm = step"
              >
                {{ step }} мм
              </button>
            </div>
          </div>
          <p class="gesture-hint">
            Удержите палец на элементе около секунды — он «прилипнет» к пальцу. Короткий сдвиг
            перемещает сам холст.
          </p>
        </div>

        <!-- Множественный выбор -->
        <div class="sidebar-section" v-if="canEdit && selectedItems.length > 1">
          <h3 class="section-title">Выбрано элементов: {{ selectedItems.length }}</h3>
          <button @click="deleteSelectedItems" class="action-button action-button--danger">
            <span class="button-icon">🗑</span>
            <span>Удалить выбранные</span>
          </button>
        </div>

        <!-- Добавление элементов -->
        <div class="sidebar-section" v-if="canEdit">
          <h3 class="section-title">Добавить</h3>
          <div class="tool-grid">
            <button @click="addBox" class="tool-btn tool-btn--add">
              <span class="tool-btn__icon">▢</span>
              <span>Короб</span>
            </button>
            <button @click="addDinRail" class="tool-btn tool-btn--rail">
              <span class="tool-btn__icon">═</span>
              <span>DIN-рейка</span>
            </button>
            <button
              @click="openDeviceModal"
              class="tool-btn tool-btn--device tool-btn--wide"
              title="Устройства сборки, которые ещё не разложены на панели"
            >
              <span class="tool-btn__icon">⚡</span>
              <span>Устройства</span>
              <span class="tool-btn__count">{{ devicesLeftToAdd }}</span>
            </button>
          </div>
        </div>

        <!-- Работа с макетом -->
        <div class="sidebar-section">
          <h3 class="section-title">Макет</h3>
          <div class="tool-grid">
            <button
              @click="saveToDatabase(false)"
              class="tool-btn tool-btn--save"
              :disabled="isSavingToDb || !canEdit"
              :title="currentLayoutId ? 'Обновить текущий макет' : 'Создать новый макет в базе'"
            >
              <span class="tool-btn__icon">{{ isSavingToDb ? '⏳' : '💾' }}</span>
              <span>{{ currentLayoutId ? 'Сохранить' : 'Создать' }}</span>
            </button>
            <button
              @click="saveToDatabase(true)"
              class="tool-btn tool-btn--save"
              :disabled="isSavingToDb || !canEdit"
            >
              <span class="tool-btn__icon">📝</span>
              <span>Сохранить как</span>
            </button>
            <button @click="showLayoutsModal = true" class="tool-btn tool-btn--load tool-btn--wide">
              <span class="tool-btn__icon">📋</span>
              <span>Загрузить макет</span>
              <span class="tool-btn__count">{{ layoutsList.length }}</span>
            </button>
            <button @click="exportProject" class="tool-btn" :disabled="!canEdit">
              <span class="tool-btn__icon">⬇️</span>
              <span>Скачать JSON</span>
            </button>
            <button @click="triggerImport" class="tool-btn" :disabled="!canEdit">
              <span class="tool-btn__icon">📂</span>
              <span>Загрузить из файла</span>
            </button>
            <button
              @click="clearProject"
              class="tool-btn tool-btn--danger tool-btn--wide"
              :disabled="!canEdit"
            >
              <span class="tool-btn__icon">🧹</span>
              <span>Очистить панель</span>
            </button>
          </div>
        </div>

        <!-- Измерение -->
        <div class="sidebar-section" v-if="canEdit">
          <h3 class="section-title">Измерение</h3>
          <div class="tool-grid">
            <button
              @click="toggleMeasureMode"
              :class="['tool-btn', 'tool-btn--measure', 'tool-btn--wide', { active: isMeasuring }]"
            >
              <span class="tool-btn__icon">📏</span>
              <span>{{ isMeasuring ? 'Выход из измерения' : 'Измерить расстояние' }}</span>
            </button>
            <button
              v-if="isMeasuring"
              @click="toggleOrthogonal"
              :class="['tool-btn', 'tool-btn--ortho', 'tool-btn--wide', { active: isOrthogonal }]"
            >
              <span class="tool-btn__icon">⊞</span>
              <span>Ортогональный режим</span>
            </button>
          </div>

          <div v-if="pointA && pointB" class="measure-result">
            <p v-if="isOrthogonal" class="mode-hint"><span class="hint-icon">📐</span> Орто</p>
            <div class="result-grid">
              <div class="result-item">
                <span class="result-label">L:</span>
                <span class="result-value">{{ measureResult.distance }} мм</span>
              </div>
              <div class="result-item">
                <span class="result-label">ΔX:</span>
                <span class="result-value">{{ measureResult.dx }} мм</span>
              </div>
              <div class="result-item">
                <span class="result-label">ΔY:</span>
                <span class="result-value">{{ measureResult.dy }} мм</span>
              </div>
            </div>
            <div class="coords-grid">
              <div class="coord-item">
                <span class="coord-label">A:</span>
                <span class="coord-value">({{ pointA.x }}, {{ pointA.y }})</span>
              </div>
              <div class="coord-item">
                <span class="coord-label">B:</span>
                <span class="coord-value">({{ pointB.x }}, {{ pointB.y }})</span>
              </div>
            </div>
          </div>
          <p v-else class="measure-hint">
            {{
              isMeasuring
                ? pointA
                  ? 'Теперь кликните точку B'
                  : 'Кликните на панели точку A'
                : 'Расстояние между двумя точками панели'
            }}
          </p>
        </div>

        <!-- Параметры панели -->
        <div class="sidebar-section">
          <h3 class="section-title">Размер шкафа</h3>
          <div class="form-group">
            <label for="panel-select">В х Ш</label>
            <select
              id="panel-select"
              v-model="selectedPanelId"
              @change="onPanelChange"
              :disabled="!canEdit"
              class="form-select"
            >
              <option v-for="p in panels" :key="p.id" :value="p.id">
                {{ p.h }} × {{ p.w }} мм
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="panel-margin">Зона пустоты, мм</label>
            <input
              id="panel-margin"
              type="number"
              min="10"
              max="50"
              step="10"
              v-model.number="panelMarginMm"
              :disabled="!canEdit"
              class="form-input"
            />
          </div>
        </div>

        <!-- Вид: масштаб и сетка -->
        <div class="sidebar-section">
          <h3 class="section-title">Вид</h3>
          <div class="zoom-row">
            <button class="zoom-btn" @click="zoomOut" title="Уменьшить">−</button>
            <span class="zoom-value">{{ zoomPercent * 2 }}%</span>
            <button class="zoom-btn" @click="zoomIn" title="Увеличить">+</button>
            <button class="zoom-btn zoom-btn--fit" @click="fitZoomToScreen">По размеру</button>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            step="1"
            v-model.number="zoomPercent"
            class="zoom-slider"
            aria-label="Масштаб"
          />
          <div class="grid-controls">
            <label class="grid-toggle">
              <input type="checkbox" v-model="isGridEnabled" class="grid-checkbox" />
              <span class="grid-label">Сетка</span>
            </label>
            <select
              v-if="isGridEnabled"
              v-model.number="gridSizeMm"
              class="form-select grid-size-select"
            >
              <option :value="1">1 мм</option>
              <option :value="2">2 мм</option>
              <option :value="4">4 мм</option>
              <option :value="5">5 мм</option>
              <option :value="10">10 мм</option>
              <option :value="20">20 мм</option>
            </select>
          </div>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="visually-hidden"
          @change="importProject"
        />
      </aside>

      <!-- Основная область (Холст) -->
      <main class="editor-canvas-wrapper" ref="canvasWrapper">
        <div class="canvas-container" :style="containerStyle">
          <div class="ruler ruler-y" :style="rulerYStyle">
            <div
              v-for="mark in yMarks"
              :key="mark.id"
              class="ruler-mark"
              :style="getMarkStyle(mark.value, 'y')"
            >
              <span class="mark-label">{{ mark.value }}</span>
            </div>
          </div>

          <div class="ruler ruler-x" :style="rulerXStyle">
            <div
              v-for="mark in xMarks"
              :key="mark.id"
              class="ruler-mark"
              :style="getMarkStyle(mark.value, 'x')"
            >
              <span class="mark-label">{{ mark.value }}</span>
            </div>
          </div>

          <div
            class="canvas"
            :class="{
              'measure-mode': isMeasuring,
              'select-mode': isSelecting,
              'grid-enabled': isGridEnabled,
              'read-only': !canEdit,
            }"
            :style="canvasStyle"
            @click="onCanvasClick"
            @mousemove="onCanvasMouseMove"
            @mousedown="onCanvasMouseDown"
          >
            <svg class="measure-svg" :width="panelWidthPx" :height="panelHeightPx">
              <g v-if="panelMarginMm > 0" class="margin-zone">
                <rect
                  x="0"
                  y="0"
                  :width="panelWidthPx"
                  :height="panelMarginMm * PIXELS_PER_MM * currentScale"
                  fill="rgba(239, 68, 68, 0.1)"
                />
                <rect
                  x="0"
                  :y="(panelHeightMm - panelMarginMm) * PIXELS_PER_MM * currentScale"
                  :width="panelWidthPx"
                  :height="panelMarginMm * PIXELS_PER_MM * currentScale"
                  fill="rgba(239, 68, 68, 0.1)"
                />
                <rect
                  x="0"
                  :y="panelMarginMm * PIXELS_PER_MM * currentScale"
                  :width="panelMarginMm * PIXELS_PER_MM * currentScale"
                  :height="(panelHeightMm - 2 * panelMarginMm) * PIXELS_PER_MM * currentScale"
                  fill="rgba(239, 68, 68, 0.1)"
                />
                <rect
                  :x="(panelWidthMm - panelMarginMm) * PIXELS_PER_MM * currentScale"
                  :y="panelMarginMm * PIXELS_PER_MM * currentScale"
                  :width="panelMarginMm * PIXELS_PER_MM * currentScale"
                  :height="(panelHeightMm - 2 * panelMarginMm) * PIXELS_PER_MM * currentScale"
                  fill="rgba(239, 68, 68, 0.1)"
                />
                <rect
                  :x="panelMarginMm * PIXELS_PER_MM * currentScale"
                  :y="panelMarginMm * PIXELS_PER_MM * currentScale"
                  :width="(panelWidthMm - 2 * panelMarginMm) * PIXELS_PER_MM * currentScale"
                  :height="(panelHeightMm - 2 * panelMarginMm) * PIXELS_PER_MM * currentScale"
                  fill="none"
                  stroke="rgba(239, 68, 68, 0.3)"
                  stroke-width="1"
                  stroke-dasharray="4 4"
                />
              </g>

              <rect
                v-if="isSelecting && selectionStart && selectionCurrent"
                :x="Math.min(selectionStart.x, selectionCurrent.x)"
                :y="Math.min(selectionStart.y, selectionCurrent.y)"
                :width="Math.abs(selectionCurrent.x - selectionStart.x)"
                :height="Math.abs(selectionCurrent.y - selectionStart.y)"
                fill="rgba(59, 130, 246, 0.15)"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-dasharray="4 4"
              />
              <line
                v-if="isMeasuring && pointA && previewPoint"
                :x1="mmToPx(pointA.x)"
                :y1="mmToPx(pointA.y)"
                :x2="mmToPx(previewPoint.x)"
                :y2="mmToPx(previewPoint.y)"
                stroke="#6366f1"
                stroke-width="1.5"
                stroke-dasharray="4 4"
                opacity="0.7"
              />
              <line
                v-if="pointA && pointB"
                :x1="mmToPx(pointA.x)"
                :y1="mmToPx(pointA.y)"
                :x2="mmToPx(pointB.x)"
                :y2="mmToPx(pointB.y)"
                stroke="#6366f1"
                stroke-width="2"
                stroke-dasharray="6 3"
              />
              <circle
                v-if="pointA"
                :cx="mmToPx(pointA.x)"
                :cy="mmToPx(pointA.y)"
                r="5"
                fill="#6366f1"
                stroke="white"
                stroke-width="2"
              />
              <circle
                v-if="pointB"
                :cx="mmToPx(pointB.x)"
                :cy="mmToPx(pointB.y)"
                r="5"
                fill="#6366f1"
                stroke="white"
                stroke-width="2"
              />
            </svg>

            <div
              v-if="canEdit && selectedItems.length === 1 && selectedItem"
              class="floating-actions"
              :style="floatingActionsStyle"
            >
              <button
                v-if="selectedItem?.type === 'device' || selectedItem?.type === 'din-rail'"
                @pointerdown.stop="rotateItem"
                class="floating-btn floating-btn--rotate"
                title="Повернуть на 90°"
              >
                ↻
              </button>
              <button
                v-if="selectedItem?.type === 'box' || selectedItem?.type === 'din-rail'"
                @pointerdown.stop="copyItem"
                class="floating-btn floating-btn--copy"
                title="Копировать"
              >
                📋
              </button>
              <button
                @pointerdown.stop="deleteSelectedItems"
                class="floating-btn floating-btn--delete"
                title="Удалить"
              >
                🗑
              </button>
            </div>

            <div v-if="resizeState && mousePosition" class="size-tooltip" :style="tooltipStyle">
              {{ resizeState.item.w }} × {{ resizeState.item.h }} мм
            </div>

            <div
              v-for="item in items"
              :key="item.id"
              :class="[
                'panel-item',
                item.type,
                { selected: selectedItems.includes(item) },
                { dragging: isDragging && selectedItems.includes(item) },
                { 'din-rail-vertical': item.type === 'din-rail' && isRotated(item) },
              ]"
              :style="getItemStyle(item)"
              @pointerdown="startDrag($event, item)"
            >
              <div class="item-label">
                {{
                  item.type === 'din-rail' || item.type === 'box'
                    ? showTrueSize(item.w, item.h)
                    : item.name
                }}
              </div>

              <template
                v-if="
                  canEdit &&
                  item.type === 'box' &&
                  selectedItems.length === 1 &&
                  selectedItems[0] === item
                "
              >
                <div
                  class="resize-handle resize-nw"
                  @pointerdown.stop="startResize($event, item, 'nw')"
                ></div>
                <div
                  class="resize-handle resize-n"
                  @pointerdown.stop="startResize($event, item, 'n')"
                ></div>
                <div
                  class="resize-handle resize-ne"
                  @pointerdown.stop="startResize($event, item, 'ne')"
                ></div>
                <div
                  class="resize-handle resize-e"
                  @pointerdown.stop="startResize($event, item, 'e')"
                ></div>
                <div
                  class="resize-handle resize-se"
                  @pointerdown.stop="startResize($event, item, 'se')"
                ></div>
                <div
                  class="resize-handle resize-s"
                  @pointerdown.stop="startResize($event, item, 's')"
                ></div>
                <div
                  class="resize-handle resize-sw"
                  @pointerdown.stop="startResize($event, item, 'sw')"
                ></div>
                <div
                  class="resize-handle resize-w"
                  @pointerdown.stop="startResize($event, item, 'w')"
                ></div>
              </template>

              <template
                v-if="
                  canEdit &&
                  item.type === 'din-rail' &&
                  selectedItems.length === 1 &&
                  selectedItems[0] === item
                "
              >
                <template v-if="!isRotated(item)">
                  <div
                    class="resize-handle resize-w din-rail-handle"
                    @pointerdown.stop="startResize($event, item, 'w')"
                  ></div>
                  <div
                    class="resize-handle resize-e din-rail-handle"
                    @pointerdown.stop="startResize($event, item, 'e')"
                  ></div>
                </template>
                <template v-else>
                  <div
                    class="resize-handle resize-n din-rail-handle"
                    @pointerdown.stop="startResize($event, item, 'n')"
                  ></div>
                  <div
                    class="resize-handle resize-s din-rail-handle"
                    @pointerdown.stop="startResize($event, item, 's')"
                  ></div>
                </template>
              </template>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Быстрые инструменты внизу экрана: на телефоне холст сверху, до сайдбара далеко тянуться -->
    <nav class="mobile-toolbar" v-if="canEdit">
      <button
        v-for="tool in mobileTools"
        :key="tool.label"
        class="mtool"
        :class="{ 'mtool--active': tool.active && tool.active() }"
        :disabled="tool.disabled && tool.disabled()"
        @click="tool.run()"
      >
        <span class="mtool__icon">{{ tool.icon }}</span>
        <span class="mtool__label">{{ tool.label }}</span>
      </button>
    </nav>

    <!-- Модальное окно добавления устройств -->
    <Teleport to="body">
      <div v-if="showDeviceModal" class="modal-overlay" @click.self="closeDeviceModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Добавить устройства</h3>
            <button @click="closeDeviceModal" class="modal-close" title="Закрыть">✕</button>
          </div>

          <div class="modal-body">
            <!-- Список устройств -->
            <div class="device-selection-list">
              <div
                v-for="dev in devicePalette"
                :key="dev.id"
                :class="[
                  'device-selection-item',
                  { 'device-selection-item--complete': isDeviceFullyUsed(dev.id) },
                  { 'device-selection-item--invalid': !hasValidDimensions(dev) },
                ]"
              >
                <!-- ВАРИАНТ А: У устройства НЕТ размеров (Показываем предупреждение) -->
                <div v-if="!hasValidDimensions(dev)" class="device-invalid-info">
                  <span class="warning-icon">⚠️</span>
                  <div class="device-invalid-text">
                    <span class="device-selection-name">{{ dev.name }}</span>
                    <span class="invalid-reason">Нельзя добавить: не заданы размеры (Ш×В)</span>
                  </div>
                </div>

                <!-- ВАРИАНТ Б: У устройства ЕСТЬ размеры (Стандартная логика) -->
                <div v-else>
                  <div class="device-selection-info">
                    <input
                      type="checkbox"
                      :id="`modal-dev-check-${dev.id}`"
                      v-model="selectedDevices[dev.id]"
                      :disabled="isDeviceFullyUsed(dev.id)"
                      class="device-checkbox"
                    />
                    <label :for="`modal-dev-check-${dev.id}`" class="device-selection-name">
                      {{ dev.name }}
                    </label>
                    <span class="device-selection-size">{{ dev.w }}×{{ dev.h }}</span>
                  </div>

                  <div class="device-selection-controls" v-if="!isDeviceFullyUsed(dev.id)">
                    <span class="device-selection-available">
                      На панели: {{ getDeviceUsedCount(dev.id) }}/{{ dev.quantity }}
                    </span>
                    <div class="quantity-control">
                      <button
                        @click="decrementQuantity(dev.id)"
                        class="qty-btn"
                        :disabled="!selectedDevices[dev.id]"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        v-model.number="deviceQuantities[dev.id]"
                        class="qty-input"
                        :min="1"
                        :max="getAvailableQuantity(dev.id)"
                        :disabled="!selectedDevices[dev.id]"
                      />
                      <button
                        @click="incrementQuantity(dev.id)"
                        class="qty-btn"
                        :disabled="!selectedDevices[dev.id]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <span v-else class="fully-used-label">✓ Все добавлены</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button
              @click="addSelectedDevicesAndClose"
              class="modal-btn modal-btn--primary"
              :disabled="!canAddDevices"
            >
              <span class="button-icon">⚡</span>
              <span>Добавить выбранные</span>
            </button>
            <button @click="closeDeviceModal" class="modal-btn modal-btn--secondary">Отмена</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Модальное окно со списком макетов -->
    <Teleport to="body">
      <div v-if="showLayoutsModal" class="modal-overlay" @click.self="showLayoutsModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Макеты панели</h3>
            <button @click="showLayoutsModal = false" class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="layoutsList.length === 0" class="admin-empty">Нет сохранённых макетов</div>
            <div v-else class="layouts-list">
              <div
                v-for="layout in layoutsList"
                :key="layout.id"
                :class="['layout-item', { 'layout-item--active': layout.id === currentLayoutId }]"
              >
                <div class="layout-item__info">
                  <span class="layout-item__name">
                    {{ layout.name }}
                    <span v-if="layout.isDefault" class="layout-item__badge">По умолчанию</span>
                  </span>
                  <span class="layout-item__date">
                    {{ new Date(layout.updatedAt).toLocaleString('ru-RU') }}
                  </span>
                </div>
                <div class="layout-item__actions">
                  <button @click="loadAndCloseModal(layout.id)" class="layout-btn layout-btn--load">
                    Загрузить
                  </button>
                  <button
                    v-if="canEdit"
                    @click="deleteLayout(layout.id)"
                    class="layout-btn layout-btn--delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Глобальный контейнер */
.global-container {
  min-height: 100vh;
  padding: 16px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #2d3748;
}

/* Основной layout */
.editor-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 16px;
  height: calc(100vh - 32px);
}

@media (max-width: 1024px) {
  .editor-layout {
    grid-template-columns: 1fr;
    height: auto;
  }
}

/* Боковая панель */
.editor-sidebar {
  background-color: rgb(255, 255, 255);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  padding: 16px;
  overflow-y: auto;
  display: grid;
  gap: 16px;
  align-content: start;
}

.sidebar-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.sidebar-header__text {
  min-width: 0;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #2d3748;
}

.sidebar-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #718096;
}

.sidebar-back {
  margin-left: auto;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: white;
  color: #4a5568;
  font-size: 16px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.sidebar-back:hover {
  border-color: #cbd5e0;
  background-color: #f7fafc;
}

/* Проверка комплектности: все ли устройства сборки разложены на панели */
.status-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.status-chip--ok {
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.status-chip--warn {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
}

.status-chip__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: currentColor;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #718096;
  margin: 0 0 8px 0;
  letter-spacing: 0.5px;
}

.sidebar-section {
  display: grid;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(230, 230, 230);
}

.sidebar-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* Формы */
.form-group {
  display: grid;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}

.form-select,
.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  background-color: white;
  font-size: 13px;
  color: #2d3748;
  cursor: pointer;
  transition: all 0.3s;
}

.form-input {
  cursor: text;
}

.form-select:hover,
.form-input:hover {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.3);
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.zoom-slider {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6366f1;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.zoom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.zoom-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6366f1;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Быстрые инструменты */
.readonly-hint {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #92400e;
  font-size: 13px;
  margin: 0;
  padding: 10px 12px;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: white;
  color: #2d3748;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.tool-btn:hover:not(:disabled) {
  background-color: #f7fafc;
  border-color: #cbd5e0;
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.3);
}

.tool-btn:disabled {
  border-color: rgb(230, 230, 230);
  cursor: default;
  opacity: 0.45;
}

.tool-btn__icon {
  flex: none;
  width: 18px;
  font-size: 16px;
  text-align: center;
}

.tool-btn__count {
  flex: none;
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 999px;
  background-color: #edf2f7;
  color: #718096;
  font-size: 11px;
  font-weight: 600;
}

.tool-btn--wide {
  grid-column: 1 / -1;
}

.tool-btn--add .tool-btn__icon {
  color: #d97706;
}

.tool-btn--rail .tool-btn__icon {
  color: #475569;
}

.tool-btn--device .tool-btn__icon {
  color: #8b5cf6;
}

.tool-btn--save .tool-btn__icon {
  color: #059669;
}

.tool-btn--load .tool-btn__icon {
  color: #2563eb;
}

.tool-btn--measure .tool-btn__icon {
  color: #6366f1;
}

.tool-btn--ortho .tool-btn__icon {
  color: #10b981;
}

.tool-btn--danger {
  color: #ef4444;
}

.tool-btn--danger:hover:not(:disabled) {
  border-color: #ef4444;
  background-color: #fef2f2;
}

.tool-btn.active {
  border-color: #6366f1;
  background-color: #6366f1;
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.tool-btn.active .tool-btn__icon,
.tool-btn.active .tool-btn__count {
  color: white;
}

.tool-btn--ortho.active {
  border-color: #10b981;
  background-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* Масштаб */
.zoom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  min-width: 32px;
  padding: 0 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: white;
  color: #4a5568;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.zoom-btn:hover {
  border-color: #cbd5e0;
  background-color: #f7fafc;
}

.zoom-btn--fit {
  margin-left: auto;
}

.zoom-value {
  min-width: 48px;
  color: #2d3748;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

/* Сетка */
.grid-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.grid-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  margin-bottom: 0px;
}

.grid-checkbox {
  width: 18px;
  height: 18px;
  accent-color: #6366f1;
  cursor: pointer;
}

.grid-label {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
}

.grid-size-select {
  width: 100px;
  padding: 6px 8px;
  font-size: 12px;
}

/* Результат измерения */
.measure-hint {
  margin: 0;
  font-size: 12px;
  color: #718096;
}

.measure-result {
  display: grid;
  gap: 8px;
  padding: 12px;
  background-color: #f7fafc;
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
}

.mode-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background-color: #d1fae5;
  color: #065f46;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.hint-icon {
  font-size: 13px;
}

.result-grid {
  display: grid;
  gap: 4px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.result-label {
  font-size: 12px;
  color: #718096;
  font-weight: 500;
}

.result-value {
  font-size: 13px;
  color: #2d3748;
  font-weight: 600;
}

.coords-grid {
  display: grid;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid rgb(230, 230, 230);
}

.coord-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.coord-label {
  color: #718096;
}

.coord-value {
  color: #4a5568;
  font-family: 'Courier New', monospace;
}

/* Свойства */
.properties-grid {
  display: grid;
  gap: 6px;
  padding: 10px;
  background-color: #f7fafc;
  border-radius: 6px;
  border: 1px solid rgb(230, 230, 230);
}

.property-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.property-label {
  color: #718096;
  font-weight: 500;
}

.property-value {
  color: #2d3748;
  font-weight: 600;
}

.rotation-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 6px;
  background-color: #e0e7ff;
  color: #4338ca;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
}

/* Двойной тап по кнопке не должен ещё и зумить страницу */
.tool-btn,
.zoom-btn,
.sidebar-back,
.mtool,
.nudge__btn,
.step-chip,
.floating-btn {
  touch-action: manipulation;
}

/* Точное перемещение */
.nudge {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nudge__pad {
  display: grid;
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(3, 44px);
  gap: 4px;
}

.nudge__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: white;
  color: #4a5568;
  font-size: 15px;
  cursor: pointer;
}

.nudge__btn:hover {
  border-color: #cbd5e0;
  background-color: #f7fafc;
}

.nudge__btn:active {
  border-color: #6366f1;
  background-color: #eef2ff;
  color: #6366f1;
}

.nudge__center {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #718096;
  font-size: 11px;
}

.nudge__steps {
  display: grid;
  gap: 6px;
}

.step-chip {
  padding: 7px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 999px;
  background-color: white;
  color: #4a5568;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.step-chip.active {
  border-color: #6366f1;
  background-color: #eef2ff;
  color: #4338ca;
}

.gesture-hint {
  margin: 0;
  color: #718096;
  font-size: 12px;
}

/* Кнопки действий */
.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 6px;
  background-color: #6366f1;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.action-button:hover:not(:disabled) {
  background-color: #4f46e5;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.action-button:disabled {
  background-color: #cbd5e0;
  cursor: not-allowed;
}

.action-button--danger {
  background-color: #ef4444;
}

.action-button--danger:hover {
  background-color: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.button-icon {
  font-size: 15px;
}

/* Холст */
.editor-canvas-wrapper {
  background-color: rgb(255, 255, 255);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  padding: 24px;
  overflow: auto;
  /* упёрся холст в край — прокрутка не должна уезжать в страницу */
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
}

.canvas-container {
  position: relative;
}

/* Линейки */
.ruler {
  position: absolute;
  background-color: #f7fafc;
  border: 1px solid rgb(230, 230, 230);
  overflow: visible;
}

.ruler-x {
  border-bottom: 2px solid #cbd5e0;
}

.ruler-y {
  border-right: 2px solid #cbd5e0;
}

.ruler-mark {
  position: absolute;
}

.ruler-x .ruler-mark {
  top: 0;
  width: 1px;
  height: 100%;
  border-left: 1px solid #cbd5e0;
}

.ruler-y .ruler-mark {
  left: 0;
  height: 1px;
  width: 100%;
  border-top: 1px solid #cbd5e0;
}

.mark-label {
  position: absolute;
  font-size: 11px;
  color: #718096;
  font-weight: 500;
  white-space: nowrap;
}

.ruler-x .mark-label {
  bottom: 4px;
  left: 4px;
}

.ruler-y .mark-label {
  top: 4px;
  left: 6px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

/* Холст */
.canvas {
  position: absolute;
  background-color: #f7fafc;
  border: 2px solid #cbd5e0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.canvas.grid-enabled {
  background-image:
    linear-gradient(to right, #e2e8f0 1px, transparent 1px),
    linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
}

.canvas:not(.grid-enabled) {
  background-image: none;
}

.canvas.measure-mode {
  cursor: crosshair;
}

.canvas.select-mode {
  cursor: crosshair;
}

.canvas.measure-mode .panel-item,
.canvas.select-mode .panel-item {
  pointer-events: none;
}

.measure-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 5;
}

/* Плавающие кнопки действий */
.floating-actions {
  position: absolute;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  border: 1px solid rgb(230, 230, 230);
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: auto;
}

.floating-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: white;
}

.floating-btn--copy {
  background-color: #10b981;
}

.floating-btn--copy:hover {
  background-color: #059669;
  transform: scale(1.05);
}

.floating-btn--delete {
  background-color: #ef4444;
}

.floating-btn--delete:hover {
  background-color: #dc2626;
  transform: scale(1.05);
}

.floating-btn--rotate {
  background-color: #8b5cf6;
}

.floating-btn--rotate:hover {
  background-color: #7c3aed;
  transform: scale(1.05);
}

/* Элементы на панели */
.panel-item {
  position: absolute;
  border: 1px solid #cbd5e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  user-select: none;
  /* палец на элементе — это жест редактора, а не прокрутка холста */
  touch-action: none;
  -webkit-touch-callout: none;
  transition: all 0.2s;
  overflow: visible;
}

.panel-item.dragging {
  border-color: #6366f1;
  box-shadow: 0 10px 24px -8px rgba(99, 102, 241, 0.55);
  cursor: grabbing;
  opacity: 0.92;
  /* переход для координат иначе тащит элемент на 200ms позади пальца */
  transition: none;
}

.canvas.read-only .panel-item {
  cursor: default;
}

.panel-item.device {
  background-color: rgba(99, 102, 241, 0.95);
  color: white;
  border-color: #6366f1;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  mix-blend-mode: normal;
}

.panel-item.box {
  background-color: rgba(251, 191, 36, 0.3);
  border: 2px dashed #f59e0b;
  border-radius: 2px;
  mix-blend-mode: multiply;
}

/* DIN-рейка */
.panel-item.din-rail {
  background: linear-gradient(180deg, #d4d4d8 0%, #a1a1aa 50%, #d4d4d8 100%);
  border: 1px solid #71717a;
  border-radius: 1px;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.5),
    0 1px 2px rgba(0, 0, 0, 0.1);
  mix-blend-mode: normal;
}

.panel-item.din-rail.din-rail-vertical {
  background: linear-gradient(90deg, #d4d4d8 0%, #a1a1aa 50%, #d4d4d8 100%);
}

.panel-item.din-rail .item-label {
  color: #3f3f46;
  font-size: 10px;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
}

.panel-item.selected {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
  z-index: 50 !important;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.item-label {
  font-size: 11px;
  font-weight: 500;
  pointer-events: none;
  text-align: center;
  padding: 4px;
  line-height: 1.2;
}

/* Tooltip с размерами */
.size-tooltip {
  position: absolute;
  background: rgba(45, 55, 72, 0.95);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 30;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Ручки изменения размера */
.resize-handle {
  position: absolute;
  background: #f59e0b;
  border: 2px solid white;
  z-index: 20;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  width: 10px;
  height: 10px;
  border-radius: 2px;
  mix-blend-mode: normal;
  transition: all 0.2s;
}

.resize-handle:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.din-rail-handle {
  background: #64748b;
  width: 10px;
  height: 10px;
}

.resize-nw {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.resize-ne {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.resize-sw {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}
.resize-se {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}

.resize-n {
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.resize-s {
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.resize-w {
  left: -5px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.resize-e {
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

/* ==================== МОДАЛЬНОЕ ОКНО ==================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgb(230, 230, 230);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #2d3748;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #718096;
}

.modal-close:hover {
  background: #f7fafc;
  color: #2d3748;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgb(230, 230, 230);
}

.modal-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn--primary {
  background: #6366f1;
  color: white;
}

.modal-btn--primary:hover:not(:disabled) {
  background: #4f46e5;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.modal-btn--primary:disabled {
  background: #cbd5e0;
  cursor: not-allowed;
}

.modal-btn--secondary {
  background: #f7fafc;
  color: #4a5568;
  border: 1px solid rgb(230, 230, 230);
}

.modal-btn--secondary:hover {
  background: #edf2f7;
}

/* Список устройств в модалке */
.device-selection-list {
  display: grid;
  gap: 8px;
}

.device-selection-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  transition: all 0.2s;
}

.device-selection-item:hover {
  border-color: #cbd5e0;
  background: #f7fafc;
}

.device-selection-item--complete {
  background-color: #f0fdf4;
  border-color: #86efac;
}

/* ✅ НОВЫЕ СТИЛИ: для устройств без размеров */
.device-selection-item--invalid {
  background-color: #fffbeb;
  border-color: #fcd34d;
  cursor: not-allowed;
}

.device-invalid-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.warning-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.device-invalid-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-invalid-text .device-selection-name {
  font-size: 13px;
  font-weight: 500;
  color: #92400e;
}

.invalid-reason {
  font-size: 11px;
  color: #b45309;
  font-style: italic;
}
/* ======================================================== */

.device-selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #6366f1;
  cursor: pointer;
}

.device-selection-name {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
  cursor: pointer;
  flex: 1;
}

.device-selection-size {
  font-size: 11px;
  color: #718096;
}

.device-selection-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 24px;
}

.device-selection-available {
  font-size: 11px;
  color: #718096;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.qty-btn {
  width: 24px;
  height: 24px;
  border: 1px solid rgb(230, 230, 230);
  background: white;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #4a5568;
}

.qty-btn:hover:not(:disabled) {
  background: #f7fafc;
  border-color: #cbd5e0;
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-input {
  width: 45px;
  height: 24px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #2d3748;
}

.qty-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.qty-input:disabled {
  background: #f7fafc;
  opacity: 0.6;
}

.fully-used-label {
  font-size: 11px;
  color: #10b981;
  font-weight: 600;
  padding-left: 24px;
}

/* Стили для списка макетов */
.admin-empty {
  padding: 40px;
  text-align: center;
  color: #718096;
  font-weight: 300;
}

.layouts-list {
  display: grid;
  gap: 8px;
}

.layout-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  transition: all 0.2s;
}

.layout-item:hover {
  border-color: #cbd5e0;
  background: #f7fafc;
}

.layout-item--active {
  border-color: #6366f1;
  background: #eef2ff;
}

.layout-item__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layout-item__name {
  font-size: 14px;
  font-weight: 500;
  color: #2d3748;
}

.layout-item__badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background-color: #10b981;
  color: white;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.layout-item__date {
  font-size: 11px;
  color: #718096;
}

.layout-item__actions {
  display: flex;
  gap: 8px;
}

.layout-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.layout-btn--load {
  background: #6366f1;
  color: white;
}

.layout-btn--load:hover {
  background: #4f46e5;
}

.layout-btn--delete {
  background: #ef4444;
  color: white;
}

.layout-btn--delete:hover {
  background: #dc2626;
}

/* Импорт файла: input нужен только как ref, на экране его быть не должно */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Нижняя панель быстрых инструментов — видна только на телефоне */
.mobile-toolbar {
  display: none;
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  gap: 4px;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  background-color: rgb(255, 255, 255);
  border-top: 1px solid rgb(230, 230, 230);
  box-shadow: 0 -4px 20px -10px rgba(34, 60, 80, 0.3);
}

.mtool {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 50px;
  padding: 6px 2px;
  border: none;
  border-radius: 8px;
  background-color: transparent;
  color: #4a5568;
  cursor: pointer;
}

.mtool:active:not(:disabled) {
  background-color: #edf2f7;
}

.mtool--active {
  background-color: #eef2ff;
  color: #6366f1;
}

.mtool:disabled {
  opacity: 0.45;
  cursor: default;
}

.mtool__icon {
  font-size: 18px;
  line-height: 1;
}

.mtool__label {
  font-size: 10px;
  font-weight: 500;
}

/* ===================== МОБИЛЬНАЯ ВЕРСИЯ ===================== */
@media (max-width: 768px) {
  /* flex вместо grid: sticky работает только внутри высокого контейнера,
     в grid-ячейке холст прилипал бы к границам собственной строки */
  .editor-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: auto;
  }

  /* Компенсируем высоту нижней панели, чтобы последний блок сайдбара не залезал под неё */
  .global-container {
    padding-bottom: 84px;
  }

  .mobile-toolbar {
    display: flex;
  }

  /* Холст наверху и фиксированной высотой — инструменты под ним */
  .editor-canvas-wrapper {
    order: -1;
    position: sticky;
    top: 8px;
    z-index: 5;
    height: 55dvh;
    padding: 12px;
    -webkit-overflow-scrolling: touch;
  }

  /* Ручки ресайза под палец: 10px попадать невозможно */
  .resize-handle {
    width: 22px;
    height: 22px;
    border-radius: 5px;
  }

  .resize-nw,
  .resize-ne {
    top: -11px;
  }

  .resize-sw,
  .resize-se {
    bottom: -11px;
  }

  .resize-nw,
  .resize-sw {
    left: -11px;
  }

  .resize-ne,
  .resize-se {
    right: -11px;
  }

  .resize-n {
    top: -11px;
  }

  .resize-s {
    bottom: -11px;
  }

  .resize-w {
    left: -11px;
  }

  .resize-e {
    right: -11px;
  }

  .editor-sidebar {
    padding: 12px;
  }

  .sidebar-section {
    padding: 10px 0;
  }

  .action-button {
    min-height: 40px;
    font-size: 13px;
  }

  .form-select,
  .zoom-slider {
    min-height: 40px;
  }

  /* Под пальцем кнопки должны быть не меньше 44px */
  .tool-btn,
  .zoom-btn,
  .sidebar-back {
    min-height: 44px;
  }

  .sidebar-back {
    width: 44px;
  }

  .tool-btn {
    font-size: 14px;
  }

  .floating-btn {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  /* Долгое нажатие не должно выделять текст на элементах панели */
  .panel-item {
    -webkit-user-select: none;
    user-select: none;
  }
}
</style>

<style>
/* Только на странице редактора: палец, дёргающий холст, не должен провоцировать
   pull-to-refresh всей страницы */
html.panel-editor-page {
  overscroll-behavior-y: none;
}
</style>

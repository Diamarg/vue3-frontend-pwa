<script setup>
import { useToast } from '@/composables/useToast'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { projectsApi } from '@/api/projects'
import { panelLayoutsApi } from '@/api/panelLayouts'
import AButton from '@/components/A-button.vue'
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
// Пока подтягивается сохранённый макет по умолчанию, холст закрывает заглушка.
// Стартует с true: пустой холст мелькает хуже, чем честный спиннер
const loadingLayout = ref(true)
const layoutLoadError = ref(false)

// В шапке полезнее имя проекта и сборки, а не их id: номера ничего заказчику не говорят
const projectName = ref('')
const assemblyName = ref('')

// Макет правят только администраторы: остальные могут открыть панель и загрузить сохранённый макет
const canEdit = computed(() => authStore.isAdmin)

const panelMarginMm = ref(20)
const zoomPercent = ref(40)

// --- СОСТОЯНИЕ СЕТКИ ---
const isGridEnabled = ref(true)
const gridSizeMm = ref(10)
const showItemLabels = ref(true)

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
      // Обновляем существующий макет. isDefault обязательно шлём и тут: PUT принимает
      // bool, поэтому без поля бэкенд снимал бы флаг «по умолчанию» с сохранённого макета
      await panelLayoutsApi.update(currentLayoutId.value, {
        layoutData: jsonString,
        isDefault: true,
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

    // Бэкенд при isDefault=true сбрасывает флаг у остальных макетов сборки,
    // поэтому список здесь просто перечитываем — значок «По умолчанию» обновится сразу
    await refreshLayoutsList()
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
    showItemLabels.value = data.showItemLabels ?? true
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
    layoutLoadError.value = false
    return true
  } catch (error) {
    console.error('Ошибка загрузки макета:', error)
    toast.error('Не удалось загрузить макет')
    return false
  }
}

const loadNames = async () => {
  try {
    const [project, assembly] = await Promise.all([
      projectsApi.getProjectById(route.params.projectId),
      projectsApi.getAssemblyById(route.params.assemblyId),
    ])
    projectName.value = project?.codeName || ''
    assemblyName.value = assembly?.codeName || ''
  } catch (error) {
    console.error('Ошибка загрузки названия проекта и сборки:', error)
  }
}

// Список макетов нужен и для модалки, и для автозагрузки; ошибки тут не показываем —
// это только список, сама раскладка уже лежит в БД
const refreshLayoutsList = async () => {
  try {
    layoutsList.value = await panelLayoutsApi.getByAssembly(route.params.assemblyId)
  } catch (error) {
    console.error('Ошибка загрузки списка макетов:', error)
  }
}

// Автоматически загружаем макет по умолчанию, если он есть
const loadDefaultLayout = async () => {
  loadingLayout.value = true
  layoutLoadError.value = false
  try {
    const defaultLayout = layoutsList.value.find((l) => l.isDefault)
    if (!defaultLayout) return
    const ok = await loadLayoutFromDb(defaultLayout.id)
    layoutLoadError.value = !ok
  } finally {
    loadingLayout.value = false
  }
}

// Загрузить список макетов при открытии страницы
const loadLayoutsList = async () => {
  await refreshLayoutsList()
  await loadDefaultLayout()
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
  { id: 10, name: 'Стойка', w: 600, h: 1800 },
  { id: 11, name: 'Стойка2', w: 600, h: 2000 },
  { id: 12, name: 'Стойка3', w: 800, h: 1800 },
  { id: 13, name: 'Стойка4', w: 800, h: 2000 },
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
  // Навбар прилипает к верху и перекрывает холст, поэтому верхним краем
  // видимой области считается его нижняя граница, а не ноль экрана
  const navbarBottom = document.querySelector('.navbar')?.getBoundingClientRect().bottom ?? 0
  // на планшете блок холста не ограничен по высоте и растёт вместе с панелью,
  // поэтому в расчёт идёт только то, что действительно видно на экране
  const visibleTop = Math.max(rect.top, navbarBottom)
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

// Справа полезнее данные из справочника устройств, а не только геометрия элемента на холсте
const selectedDevice = computed(() => {
  const item = selectedItem.value
  if (!item || item.type !== 'device') return null
  return devicePalette.value.find((dev) => dev.id === item.deviceId) ?? null
})

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
  // этим пальцем, поэтому сдвиг обрабатываем сами внутри канваса
  const el = canvasWrapper.value
  if (el) {
    const stepX = g.lastX - e.clientX
    const stepY = g.lastY - e.clientY
    el.scrollLeft += stepX
    el.scrollTop += stepY
  }

  g.lastX = e.clientX
  g.lastY = e.clientY
}

const startTouchGesture = (e, item) => {
  if (touchGesture && touchGesture.pointerId !== e.pointerId) {
    endTouchGesture()
    onPointerUp()
    return
  }

  const gesture = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    panning: false,
    item,
    timer: null,
  }

  if (item) {
    gesture.timer = setTimeout(() => {
      if (touchGesture !== gesture) return
      navigator.vibrate?.(15)
      beginDrag(gesture.startX, gesture.startY, item, gesture.pointerId)
      attachDragListeners()
    }, LONG_PRESS_MS)
  }

  touchGesture = gesture
  window.addEventListener('pointermove', onTouchMove)
  window.addEventListener('pointerup', endTouchGesture)
  window.addEventListener('pointercancel', endTouchGesture)
}

const onCanvasWrapperPointerDown = (e) => {
  if (e.pointerType !== 'touch' || !e.isPrimary) return
  if (touchGesture || dragState || resizeState) return
  if (
    e.target.closest('.resize-handle, .floating-actions, button, input, select, .layout-loading')
  ) {
    return
  }
  startTouchGesture(e, null)
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

  startTouchGesture(e, item)
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
    showItemLabels: showItemLabels.value,
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
      showItemLabels.value = data.showItemLabels ?? true
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
  loadingLayout.value = true
  try {
    await loadLayoutFromDb(layoutId)
  } finally {
    loadingLayout.value = false
  }
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

    // В раскладку попадают только устройства с флагом «для монтажной панели»:
    // в сборку обычно входит и то, что на рейку не ставится
    devicePalette.value = (rawDevices || [])
      .filter((device) => device.showOnPanel)
      .map((device) => ({
        id: device.id,
        name: device.description || `Устройство ${device.id}`,
        w: device.width || 0,
        h: device.height || 0,
        quantity: device.quantity ?? 1,
        article: device.article || '',
        brand: device.brand || '',
        deviceType: device.deviceType || '',
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
  await loadNames()
  await loadAssemblyDevices()
  await loadLayoutsList()
  autoFitZoom()
})

onUnmounted(() => {
  document.documentElement.classList.remove('panel-editor-page')
  printPageStyle?.remove()
  endTouchGesture()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})

// ===================== ПЕЧАТЬ A4 =====================
// Холст уходит на печать как DOM, а не как картинка: браузер рисует чертёж
// вектором, поэтому разрешение равно разрешению принтера
const PRINT_MARGIN_MM = 10
const A4_MM = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } }
const CSS_PX_PER_MM = 96 / 25.4

// широкая панель — на альбомный лист, узкая — на книжный
const printLandscape = computed(() => panelWidthMm.value > panelHeightMm.value)

// во сколько раз раздуть холст, чтобы панель заняла всю печатную область;
// на экране он уже умножен на currentScale, поэтому масштаба экрана не касается
const printZoom = computed(() => {
  const page = printLandscape.value ? A4_MM.landscape : A4_MM.portrait
  const fitWidth =
    ((page.w - 2 * PRINT_MARGIN_MM) * CSS_PX_PER_MM) / (panelWidthPx.value * currentScale.value)
  const fitHeight =
    ((page.h - 2 * PRINT_MARGIN_MM) * CSS_PX_PER_MM) / (panelHeightPx.value * currentScale.value)
  return Math.min(fitWidth, fitHeight)
})

// @page не опишешь в scoped-стилях страницы (он действовал бы на всё приложение)
// и он не знает про размеры панели, поэтому правило живёт в отдельном теге в head
let printPageStyle = null

const syncPrintPageRule = () => {
  if (!printPageStyle) {
    printPageStyle = document.createElement('style')
    document.head.appendChild(printPageStyle)
  }
  const orientation = printLandscape.value ? 'landscape' : 'portrait'
  printPageStyle.textContent = `@page { size: A4 ${orientation}; margin: ${PRINT_MARGIN_MM}mm }`
}

// immediate: чтобы Ctrl+P без нажатия кнопки тоже попал на правильный лист
watch(printLandscape, syncPrintPageRule, { immediate: true })

// Подпись на холсте в 11 px, а холст при печати сжимается в printZoom раз: у
// панели в 1200 мм буквы выходят ~1.3 мм и не читаются. Здесь задаём кегль
// именно на листе: 7 pt — это ~2.5 мм, заглавная буква получается около 1.8 мм.
// Чем крупнее ставим, тем сильнее подписи залезают за пределы узких приборов
const PRINT_LABEL_PT = 7
const PRINT_LABEL_BASE_PX = 11
// в CSS 1 pt = 1/72 дюйма, а дюйм — 96 px: значит в 1 pt ровно 96/72 px
const PX_PER_PT = 96 / 72

const printLabelPx = computed(() => {
  const neededPx = (PRINT_LABEL_PT * PX_PER_PT) / printZoom.value
  // подписи только растём: уменьшать то, что и так читается, незачем
  return Math.max(PRINT_LABEL_BASE_PX, neededPx)
})

const printPanel = () => {
  syncPrintPageRule()
  window.print()
}
</script>

<template>
  <div
    class="global-container"
    :class="{ 'global-container--no-mobile-tools': !canEdit }"
    :style="{ '--print-zoom': printZoom, '--print-label-px': `${printLabelPx}px` }"
  >
    <div class="editor-layout">
      <!-- Боковая панель управления -->
      <aside class="editor-sidebar">
        <header class="sidebar-header">
          <div class="sidebar-header__main">
            <span class="sidebar-header__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <rect x="4" y="3" width="16" height="18" rx="2"></rect>
                <path d="M8 7h8M8 11h3M13 11h3M8 15h3M13 15h3"></path>
              </svg>
            </span>
            <div class="sidebar-header__heading">
              <span class="sidebar-header__eyebrow">Редактор раскладки</span>
              <h2 class="sidebar-title">Монтажная панель</h2>
            </div>
          </div>
          <p class="sidebar-subtitle">
            <span>Проект {{ projectName || route.params.projectId }}</span>
            <span class="sidebar-subtitle__separator">·</span>
            <span>Сборка {{ assemblyName || route.params.assemblyId }}</span>
          </p>
        </header>

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
            <div class="property-item" v-if="selectedDevice">
              <span class="property-label">Артикул:</span>
              <span class="property-value">{{ selectedDevice.article || '—' }}</span>
            </div>
            <div class="property-item" v-if="selectedDevice">
              <span class="property-label">Бренд:</span>
              <span class="property-value">{{ selectedDevice.brand || '—' }}</span>
            </div>
            <div class="property-item" v-if="selectedDevice">
              <span class="property-label">Тип устройства:</span>
              <span class="property-value">{{ selectedDevice.deviceType || '—' }}</span>
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
              class="tool-btn tool-btn--save tool-btn--primary"
              :disabled="isSavingToDb || !canEdit"
              :title="
                currentLayoutId
                  ? 'Обновить текущий макет и открыть его при следующем заходе'
                  : 'Создать новый макет в базе'
              "
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
              @click="printPanel"
              class="tool-btn tool-btn--wide"
              :title="`Панель целиком на одном листе A4 (${printLandscape ? 'альбом' : 'книжная'})`"
            >
              <span class="tool-btn__icon">🖨</span>
              <span>Печать A4</span>
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
          <label class="grid-toggle">
            <input
              type="checkbox"
              v-model="showItemLabels"
              class="grid-checkbox"
              aria-label="Показывать подписи элементов"
            />
            <span class="grid-label">Показывать подписи</span>
          </label>
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
      <main
        class="editor-canvas-wrapper"
        ref="canvasWrapper"
        @pointerdown="onCanvasWrapperPointerDown"
      >
        <div v-if="loadingLayout" class="layout-loading">
          <span class="layout-loading__spinner"></span>
          <p>Загрузка сохранённого макета...</p>
        </div>

        <div v-else-if="layoutLoadError" class="layout-loading layout-loading--error">
          <span class="layout-loading__icon" aria-hidden="true">!</span>
          <p>Не удалось загрузить сохранённый макет</p>
          <AButton @click="loadDefaultLayout">Повторить</AButton>
        </div>
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
              'labels-hidden': !showItemLabels,
              'read-only': !canEdit,
            }"
            :style="canvasStyle"
            @click="onCanvasClick"
            @mousemove="onCanvasMouseMove"
            @mousedown="onCanvasMouseDown"
          >
            <svg class="measure-svg" :width="scaledPanelWidthPx" :height="scaledPanelHeightPx">
              <g v-if="panelMarginMm > 0" class="margin-zone">
                <rect
                  x="0"
                  y="0"
                  :width="scaledPanelWidthPx"
                  :height="panelMarginMm * PIXELS_PER_MM * currentScale"
                  fill="rgba(239, 68, 68, 0.1)"
                />
                <rect
                  x="0"
                  :y="(panelHeightMm - panelMarginMm) * PIXELS_PER_MM * currentScale"
                  :width="scaledPanelWidthPx"
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
    <nav class="mobile-toolbar" v-if="canEdit" aria-label="Быстрые инструменты редактора">
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
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="device-modal-title"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <h3 id="device-modal-title" class="modal-title">Добавить устройства</h3>
              <p class="modal-subtitle">
                Выберите устройства и количество для размещения на панели.
              </p>
            </div>
            <button
              @click="closeDeviceModal"
              class="modal-close"
              title="Закрыть"
              aria-label="Закрыть"
            >
              ✕
            </button>
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
                  { 'device-selection-item--selected': selectedDevices[dev.id] },
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
        <div
          class="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="layouts-modal-title"
        >
          <div class="modal-header">
            <div class="modal-heading">
              <h3 id="layouts-modal-title" class="modal-title">Макеты панели</h3>
              <p class="modal-subtitle">Сохранённые раскладки этой сборки.</p>
            </div>
            <button
              @click="showLayoutsModal = false"
              class="modal-close"
              title="Закрыть"
              aria-label="Закрыть"
            >
              ✕
            </button>
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
                    title="Удалить макет"
                    aria-label="Удалить макет"
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
.global-container {
  width: 100%;
  max-width: 1400px;
  min-height: calc(100vh - var(--navbar-height));
  min-height: calc(100dvh - var(--navbar-height));
  margin-inline: auto;
  padding: 16px max(16px, env(safe-area-inset-right, 0px))
    max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  box-sizing: border-box;
  background: #f8fafc;
  color: #2d3748;
  font-family: inherit;
}

.editor-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - var(--navbar-height) - 32px);
  height: calc(100dvh - var(--navbar-height) - 32px);
}

.editor-layout > * {
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1024px) {
  .editor-layout {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .editor-canvas-wrapper {
    order: -1;
    height: min(58dvh, 560px);
    min-height: 380px;
  }

  .editor-sidebar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .sidebar-header,
  .status-chip,
  .readonly-hint {
    grid-column: 1 / -1;
  }
}

.editor-sidebar {
  display: grid;
  align-content: start;
  gap: 12px;
  padding-right: 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: #cbd5e1 transparent;
  scrollbar-width: thin;
}

.editor-sidebar::-webkit-scrollbar,
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.editor-sidebar::-webkit-scrollbar-thumb,
.modal-body::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: #cbd5e1;
  background-clip: padding-box;
}

.sidebar-header {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e0e7ff;
  border-radius: 14px;
  background: linear-gradient(135deg, #fff 0%, #fff 58%, #f5f3ff 100%);
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.28);
}

.sidebar-header__main {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.sidebar-header__icon {
  display: grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f46e5;
}

.sidebar-header__icon svg {
  width: 23px;
  height: 23px;
}

.sidebar-header__heading {
  min-width: 0;
}

.sidebar-header__eyebrow {
  display: block;
  margin-bottom: 3px;
  color: #8a8f98;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sidebar-title {
  margin: 0;
  color: #2d3748;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.2;
}

.sidebar-subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  min-width: 0;
  margin: 0;
  color: #8a8f98;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.sidebar-subtitle__separator {
  color: #cbd5e1;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 8px 11px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}

.status-chip--ok {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.status-chip--warn {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #a16207;
}

.status-chip__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px rgb(255 255 255 / 65%);
}

.readonly-hint {
  margin: 0;
  padding: 11px 12px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
  line-height: 1.5;
}

.section-title {
  margin: 0;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.sidebar-section {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -18px rgba(34, 60, 80, 0.3);
}

.sidebar-section:last-child {
  padding-bottom: 12px;
}

.form-group {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.form-group label {
  margin: 0;
  color: #4b5563;
  font-size: 12px;
  font-weight: 500;
}

.form-select,
.form-input {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.form-select {
  cursor: pointer;
}

.form-input {
  cursor: text;
}

.form-select:hover:not(:disabled),
.form-input:hover:not(:disabled) {
  border-color: #c7d2fe;
}

.form-select:focus,
.form-input:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgb(99 102 241 / 12%);
}

.form-select:disabled,
.form-input:disabled {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.zoom-slider {
  width: 100%;
  height: 5px;
  margin: 5px 0;
  border-radius: 999px;
  outline: none;
  background: #e2e8f0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.zoom-slider::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  border: 3px solid #fff;
  border-radius: 50%;
  outline: 1px solid #c7d2fe;
  background: #6366f1;
  box-shadow: 0 2px 5px rgb(79 70 229 / 22%);
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.zoom-slider::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border: 3px solid #fff;
  border-radius: 50%;
  outline: 1px solid #c7d2fe;
  background: #6366f1;
  box-shadow: 0 2px 5px rgb(79 70 229 / 22%);
  cursor: pointer;
}

.zoom-slider:hover::-webkit-slider-thumb {
  transform: scale(1.1);
}

.zoom-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid #6366f1;
  outline-offset: 3px;
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
  min-width: 0;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.tool-btn:hover:not(:disabled) {
  border-color: #c7d2fe;
  background: #f5f3ff;
  color: #4f46e5;
  box-shadow: 0 4px 12px -8px rgb(79 70 229 / 45%);
  transform: translateY(-1px);
}

.tool-btn:active:not(:disabled) {
  box-shadow: none;
  transform: translateY(0);
}

.tool-btn:disabled {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #a0aec0;
  cursor: not-allowed;
  opacity: 0.72;
}

.tool-btn__icon {
  display: inline-grid;
  flex: 0 0 20px;
  width: 20px;
  place-items: center;
  color: #8a8f98;
  font-size: 15px;
  line-height: 1;
}

.tool-btn__count {
  flex: none;
  min-width: 23px;
  margin-left: auto;
  padding: 2px 7px;
  border: 1px solid #e0e7ff;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.tool-btn--wide {
  grid-column: 1 / -1;
}

.tool-btn--add .tool-btn__icon {
  color: #d97706;
}

.tool-btn--rail .tool-btn__icon {
  color: #64748b;
}

.tool-btn--device .tool-btn__icon {
  color: #7c3aed;
}

.tool-btn--save .tool-btn__icon {
  color: #059669;
}

.tool-btn--load .tool-btn__icon {
  color: #4f46e5;
}

.tool-btn--measure .tool-btn__icon {
  color: #6366f1;
}

.tool-btn--ortho .tool-btn__icon {
  color: #059669;
}

.tool-btn--primary {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #fff;
  font-weight: 600;
}

.tool-btn--primary .tool-btn__icon {
  color: #fff;
}

.tool-btn--primary:hover:not(:disabled) {
  border-color: #4338ca;
  background: #4338ca;
  color: #fff;
}

.tool-btn--primary:disabled {
  border-color: #c7d2fe;
  background: #c7d2fe;
  color: #eef2ff;
}

.tool-btn--danger {
  color: #dc2626;
}

.tool-btn--danger .tool-btn__icon {
  color: #dc2626;
}

.tool-btn--danger:hover:not(:disabled) {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  box-shadow: 0 4px 12px -8px rgb(220 38 38 / 35%);
}

.tool-btn.active {
  border-color: #6366f1;
  background: #eef2ff;
  color: #4338ca;
  box-shadow: inset 0 0 0 1px rgb(99 102 241 / 12%);
}

.tool-btn.active .tool-btn__icon,
.tool-btn.active .tool-btn__count {
  color: #4f46e5;
}

.tool-btn--ortho.active {
  border-color: #6ee7b7;
  background: #ecfdf5;
  color: #047857;
}

.tool-btn--ortho.active .tool-btn__icon {
  color: #059669;
}

.tool-btn:focus-visible,
.zoom-btn:focus-visible,
.mtool:focus-visible,
.nudge__btn:focus-visible,
.step-chip:focus-visible,
.floating-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.zoom-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zoom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.zoom-btn:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}

.zoom-btn--fit {
  margin-left: auto;
  padding-inline: 10px;
  font-size: 11px;
}

.zoom-value {
  min-width: 44px;
  color: #374151;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.grid-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.grid-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #4b5563;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}

.grid-checkbox,
.device-checkbox {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: #6366f1;
  cursor: pointer;
}

.grid-checkbox:focus-visible,
.device-checkbox:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.grid-label {
  color: #4b5563;
  font-size: 12px;
  font-weight: 500;
}

.grid-size-select {
  width: 94px;
  min-height: 34px;
  padding: 6px 8px;
  font-size: 12px;
}

.measure-hint {
  margin: 0;
  color: #8a8f98;
  font-size: 12px;
  line-height: 1.45;
}

.measure-result {
  display: grid;
  gap: 9px;
  padding: 11px;
  border: 1px solid #e0e7ff;
  border-radius: 10px;
  background: #f5f3ff;
}

.mode-hint {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #d1fae5;
  color: #047857;
  font-size: 11px;
  font-weight: 600;
}

.hint-icon {
  font-size: 12px;
}

.result-grid,
.coords-grid {
  display: grid;
  gap: 4px;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.result-label {
  color: #8a8f98;
  font-size: 11px;
  font-weight: 500;
}

.result-value {
  color: #4338ca;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.coords-grid {
  padding-top: 7px;
  border-top: 1px solid #ddd6fe;
}

.coord-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 10px;
}

.coord-label {
  color: #8a8f98;
}

.coord-value {
  color: #6b7280;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.properties-grid {
  display: grid;
  gap: 7px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
}

.property-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  line-height: 1.4;
}

.property-label {
  flex: none;
  color: #8a8f98;
  font-weight: 500;
}

.property-value {
  min-width: 0;
  color: #374151;
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}

.rotation-badge {
  display: inline-block;
  margin-left: 3px;
  padding: 1px 5px;
  border-radius: 5px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 9px;
  font-weight: 600;
}

.tool-btn,
.zoom-btn,
.mtool,
.nudge__btn,
.step-chip,
.floating-btn {
  touch-action: manipulation;
}

.nudge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.nudge__pad {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, 42px);
  grid-template-rows: repeat(3, 42px);
  gap: 4px;
}

.nudge__btn {
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.nudge__btn:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}

.nudge__btn:active {
  border-color: #a5b4fc;
  background: #e0e7ff;
  color: #4338ca;
}

.nudge__center {
  display: grid;
  place-items: center;
  color: #8a8f98;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.nudge__steps {
  display: grid;
  gap: 6px;
}

.step-chip {
  min-height: 30px;
  padding: 5px 9px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.step-chip:hover {
  border-color: #c7d2fe;
  color: #4f46e5;
}

.step-chip.active {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4338ca;
}

.gesture-hint {
  margin: 0;
  color: #8a8f98;
  font-size: 11px;
  line-height: 1.5;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-height: 38px;
  padding: 9px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.action-button:hover:not(:disabled) {
  border-color: #fca5a5;
  background: #fee2e2;
  color: #b91c1c;
}

.action-button:focus-visible {
  outline: 2px solid #dc2626;
  outline-offset: 2px;
}

.action-button:disabled {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #a0aec0;
  cursor: not-allowed;
}

.button-icon {
  font-size: 14px;
  line-height: 1;
}

/* Холст */
.editor-canvas-wrapper {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 24px;
  overflow: auto;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 14px;
  background: #f8fafc;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.28);
  overscroll-behavior: contain;
  scrollbar-color: #cbd5e1 #f1f5f9;
  scrollbar-width: thin;
  touch-action: none;
  -webkit-overflow-scrolling: touch;
}

.editor-canvas-wrapper::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.editor-canvas-wrapper::-webkit-scrollbar-thumb {
  border: 2px solid #f1f5f9;
  border-radius: 999px;
  background: #cbd5e1;
}

.layout-loading {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  border-radius: inherit;
  background: rgb(248 250 252 / 94%);
  color: #64748b;
  font-size: 13px;
  text-align: center;
}

.layout-loading p {
  margin: 0;
}

.layout-loading__spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #e0e7ff;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: layout-loading-spin 0.8s linear infinite;
}

.layout-loading__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid #fde68a;
  border-radius: 12px;
  background: #fffbeb;
  color: #d97706;
  font-size: 22px;
  font-weight: 600;
}

.layout-loading :deep(.btn) {
  min-height: 38px;
  padding: 8px 16px;
  border: 1px solid #4f46e5;
  border-radius: 8px;
  background: #4f46e5;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.layout-loading :deep(.btn):hover:not(:disabled) {
  border-color: #4338ca;
  background: #4338ca;
  color: #fff;
}

.layout-loading :deep(.btn):focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

@keyframes layout-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.canvas-container {
  position: relative;
}

.ruler {
  position: absolute;
  z-index: 2;
  overflow: visible;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
}

.ruler-x {
  border-bottom-color: #cbd5e1;
}

.ruler-y {
  border-right-color: #cbd5e1;
}

.ruler-mark {
  position: absolute;
}

.ruler-x .ruler-mark {
  top: 0;
  width: 1px;
  height: 100%;
  border-left: 1px solid #cbd5e1;
}

.ruler-y .ruler-mark {
  left: 0;
  width: 100%;
  height: 1px;
  border-top: 1px solid #cbd5e1;
}

.mark-label {
  position: absolute;
  color: #64748b;
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.ruler-x .mark-label {
  bottom: 4px;
  left: 4px;
}

.ruler-y .mark-label {
  top: 4px;
  left: 5px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.canvas {
  position: absolute;
  border: 2px solid #cbd5e1;
  background: #fff;
  box-shadow: 0 8px 24px -14px rgb(15 23 42 / 28%);
  touch-action: none;
}

.canvas.grid-enabled {
  background-image:
    linear-gradient(to right, #e2e8f0 1px, transparent 1px),
    linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
}

.canvas:not(.grid-enabled) {
  background-image: none;
}

.canvas.labels-hidden .item-label {
  display: none;
}

.canvas.measure-mode,
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
  z-index: 5;
  width: 100%;
  height: 100%;
  max-width: none;
  overflow: hidden;
  pointer-events: none;
}

/* Плавающие кнопки действий */
.floating-actions {
  position: absolute;
  z-index: 100;
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px -10px rgb(15 23 42 / 30%);
  pointer-events: auto;
  transform: translateX(-50%);
}

.floating-btn {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.floating-btn--copy {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.floating-btn--copy:hover {
  border-color: #86efac;
  background: #dcfce7;
  color: #166534;
  transform: translateY(-1px);
}

.floating-btn--delete {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.floating-btn--delete:hover {
  border-color: #fca5a5;
  background: #fee2e2;
  color: #b91c1c;
  transform: translateY(-1px);
}

.floating-btn--rotate {
  border-color: #e0e7ff;
  background: #eef2ff;
  color: #4f46e5;
}

.floating-btn--rotate:hover {
  border-color: #c7d2fe;
  background: #e0e7ff;
  color: #4338ca;
  transform: translateY(-1px);
}

/* Элементы на панели */
.panel-item {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  border: 1px solid #cbd5e1;
  cursor: move;
  user-select: none;
  touch-action: none;
  -webkit-touch-callout: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
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
  touch-action: none;
}

.panel-item.device {
  background-color: rgb(79 70 229 / 95%);
  color: white;
  border-color: #4f46e5;
  border-radius: 5px;
  box-shadow: 0 2px 6px rgb(49 46 129 / 20%);
  mix-blend-mode: normal;
}

.panel-item.box {
  background-color: rgb(251 191 36 / 28%);
  border: 2px dashed #f59e0b;
  border-radius: 3px;
  mix-blend-mode: multiply;
}

/* DIN-рейка */
.panel-item.din-rail {
  background: linear-gradient(180deg, #e4e4e7 0%, #a1a1aa 50%, #e4e4e7 100%);
  border: 1px solid #71717a;
  border-radius: 2px;
  box-shadow:
    inset 0 1px 2px rgb(255 255 255 / 55%),
    0 1px 2px rgb(0 0 0 / 10%);
  mix-blend-mode: normal;
}

.panel-item.din-rail.din-rail-vertical {
  background: linear-gradient(90deg, #e4e4e7 0%, #a1a1aa 50%, #e4e4e7 100%);
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
  z-index: 30;
  padding: 6px 10px;
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 7px;
  background: rgb(30 41 59 / 95%);
  box-shadow: 0 4px 12px rgb(15 23 42 / 20%);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}

/* Ручки изменения размера */
.resize-handle {
  position: absolute;
  z-index: 20;
  width: 10px;
  height: 10px;
  border: 2px solid #6366f1;
  border-radius: 3px;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 20%);
  mix-blend-mode: normal;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.resize-handle:hover {
  border-color: #4338ca;
  box-shadow: 0 2px 7px rgb(79 70 229 / 35%);
}

.din-rail-handle {
  border-color: #64748b;
  background: #fff;
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
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
    max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  background: rgb(15 23 42 / 46%);
  animation: fadeIn 0.18s ease;
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
  display: flex;
  flex-direction: column;
  width: min(640px, 100%);
  max-height: 88vh;
  max-height: 88dvh;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 70px -20px rgb(15 23 42 / 45%);
  animation: slideUp 0.22s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #fff 0%, #fff 62%, #f5f3ff 100%);
}

.modal-heading {
  min-width: 0;
}

.modal-title {
  margin: 0;
  color: #2d3748;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
}

.modal-subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 12px;
  line-height: 1.45;
}

.modal-close {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  outline: none;
  background: transparent;
  color: #8a8f98;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.modal-close:hover {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #374151;
}

.modal-close:focus-visible {
  border-color: #818cf8;
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.modal-body {
  flex: 1;
  min-height: 0;
  padding: 18px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #f8fafc;
  scrollbar-color: #cbd5e1 transparent;
  scrollbar-width: thin;
}

.modal-footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.modal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  padding: 9px 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.modal-btn--primary {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #fff;
}

.modal-btn--primary:hover:not(:disabled) {
  border-color: #4338ca;
  background: #4338ca;
  box-shadow: 0 5px 14px -8px rgb(79 70 229 / 60%);
}

.modal-btn--primary:disabled {
  border-color: #c7d2fe;
  background: #c7d2fe;
  color: #eef2ff;
  cursor: not-allowed;
}

.modal-btn--secondary {
  border-color: #e5e7eb;
  background: #fff;
  color: #4b5563;
}

.modal-btn--secondary:hover {
  border-color: #c7d2fe;
  background: #f5f3ff;
  color: #4f46e5;
}

.modal-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

/* Список устройств в модалке */
.device-selection-list {
  display: grid;
  gap: 9px;
}

.device-selection-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px -6px rgb(15 23 42 / 16%);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.device-selection-item:hover {
  border-color: #c7d2fe;
  background: #fafaff;
}

.device-selection-item--selected {
  border-color: #a5b4fc;
  background: #f5f3ff;
  box-shadow: inset 3px 0 #6366f1;
}

.device-selection-item--complete {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.device-selection-item--invalid {
  border-color: #fde68a;
  background: #fffbeb;
  cursor: not-allowed;
}

.device-invalid-info {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 2px 0;
}

.warning-icon {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: #fef3c7;
  font-size: 17px;
}

.device-invalid-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.device-invalid-text .device-selection-name {
  color: #92400e;
  font-size: 13px;
  font-weight: 600;
}

.invalid-reason {
  color: #b45309;
  font-size: 11px;
  line-height: 1.4;
}

.device-selection-info {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.device-checkbox {
  flex: none;
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: #6366f1;
  cursor: pointer;
}

.device-selection-name {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.device-selection-size {
  flex: none;
  padding: 3px 7px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  color: #64748b;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.device-selection-item--selected .device-selection-size {
  border-color: #ddd6fe;
  background: #ede9fe;
  color: #6d28d9;
}

.device-selection-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-left: 26px;
}

.device-selection-available {
  color: #8a8f98;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.quantity-control {
  display: flex;
  flex: none;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #f8fafc;
}

.qty-btn {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #4f46e5;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}

.qty-btn:hover:not(:disabled) {
  border-color: #c7d2fe;
  background: #eef2ff;
}

.qty-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.qty-btn:disabled {
  border-color: #eff1f4;
  background: #f8fafc;
  color: #cbd5e1;
  cursor: not-allowed;
}

.qty-input {
  width: 42px;
  height: 28px;
  padding: 2px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  outline: none;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  appearance: textfield;
  -moz-appearance: textfield;
}

.qty-input::-webkit-inner-spin-button,
.qty-input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
}

.qty-input:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgb(99 102 241 / 12%);
}

.qty-input:disabled {
  background: #f8fafc;
  color: #94a3b8;
  opacity: 0.7;
}

.fully-used-label {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  margin-left: 26px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 10px;
  font-weight: 600;
}

/* Стили для списка макетов */
.admin-empty {
  padding: 42px 20px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #fff;
  color: #8a8f98;
  font-size: 13px;
  text-align: center;
}

.layouts-list {
  display: grid;
  gap: 9px;
}

.layout-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding: 13px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px -6px rgb(15 23 42 / 16%);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.layout-item:hover {
  border-color: #c7d2fe;
  background: #fafaff;
}

.layout-item--active {
  border-color: #a5b4fc;
  background: #eef2ff;
  box-shadow: inset 3px 0 #6366f1;
}

.layout-item__info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.layout-item__name {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.layout-item__badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 9px;
  font-weight: 600;
  vertical-align: middle;
}

.layout-item__date {
  color: #8a8f98;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.layout-item__actions {
  display: flex;
  flex: none;
  gap: 7px;
}

.layout-btn {
  display: inline-grid;
  min-width: 34px;
  height: 34px;
  place-items: center;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}

.layout-btn--load {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #fff;
}

.layout-btn--load:hover {
  border-color: #4338ca;
  background: #4338ca;
}

.layout-btn--delete {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
  font-size: 14px;
}

.layout-btn--delete:hover {
  border-color: #fca5a5;
  background: #fee2e2;
  color: #b91c1c;
}

.layout-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
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
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  display: none;
  gap: 4px;
  padding: 6px max(8px, env(safe-area-inset-right, 0px))
    calc(6px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
  border-top: 1px solid #e5e7eb;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 -8px 24px -16px rgb(15 23 42 / 35%);
}

.mtool {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 52px;
  padding: 6px 2px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  font: inherit;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.mtool:active:not(:disabled) {
  border-color: #e0e7ff;
  background: #eef2ff;
  color: #4f46e5;
}

.mtool--active {
  border-color: #e0e7ff;
  background: #eef2ff;
  color: #4f46e5;
}

.mtool:disabled {
  color: #cbd5e1;
  cursor: default;
  opacity: 0.65;
}

.mtool__icon {
  font-size: 18px;
  line-height: 1;
}

.mtool__label {
  max-width: 100%;
  overflow: hidden;
  font-size: 10px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===================== МОБИЛЬНАЯ ВЕРСИЯ ===================== */
@media (max-width: 768px) {
  .sidebar-header {
    display: none;
  }

  .editor-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
  }

  .global-container {
    height: calc(100vh - var(--navbar-height));
    height: calc(100dvh - var(--navbar-height));
    min-height: 0;
    padding-bottom: calc(65px + env(safe-area-inset-bottom, 0px));
  }

  .global-container--no-mobile-tools {
    padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
  }

  .mobile-toolbar {
    display: flex;
  }

  .editor-canvas-wrapper {
    flex: 0 0 55%;
    position: relative;
    top: auto;
    z-index: auto;
    height: auto;
    min-height: 0;
    max-height: none;
    padding: 12px;
    border-radius: 12px;
    overscroll-behavior: contain;
    touch-action: none;
    -webkit-overflow-scrolling: touch;
  }

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
    flex: 1;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
    padding: 0 2px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .sidebar-header {
    gap: 10px;
    padding: 14px;
  }

  .sidebar-header__icon {
    flex-basis: 38px;
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .sidebar-header__icon svg {
    width: 21px;
    height: 21px;
  }

  .sidebar-title {
    font-size: 18px;
  }

  .sidebar-section {
    gap: 10px;
    padding: 12px;
  }

  .action-button {
    min-height: 44px;
    font-size: 13px;
  }

  .form-select,
  .form-input {
    min-height: 44px;
    font-size: 14px;
  }

  .zoom-slider {
    height: 6px;
    margin: 12px 0;
  }

  .zoom-slider::-webkit-slider-thumb {
    width: 20px;
    height: 20px;
  }

  .tool-btn,
  .zoom-btn,
  .nudge__btn {
    min-height: 44px;
  }

  .tool-btn {
    font-size: 13px;
  }

  .nudge__pad {
    grid-template-columns: repeat(3, 44px);
    grid-template-rows: repeat(3, 44px);
  }

  .step-chip {
    min-height: 34px;
  }

  .floating-actions {
    gap: 3px;
    margin-top: -6px;
    padding: 3px;
  }

  .floating-btn {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .modal-overlay {
    padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
      max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  }

  .modal-content {
    max-height: calc(
      100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px
    );
    border-radius: 14px;
  }

  .modal-header {
    padding: 16px;
  }

  .modal-body {
    padding: 14px 16px;
  }

  .modal-footer {
    padding: 12px 16px;
  }

  .device-selection-item {
    padding: 11px;
  }

  .qty-btn {
    width: 34px;
    height: 34px;
  }

  .qty-input {
    width: 44px;
    height: 34px;
  }

  .layout-btn {
    height: 38px;
  }

  .panel-item {
    -webkit-user-select: none;
    user-select: none;
  }
}

@media (max-width: 480px) {
  .sidebar-header__eyebrow {
    font-size: 9px;
  }

  .sidebar-title {
    font-size: 17px;
  }

  .device-selection-info {
    align-items: flex-start;
  }

  .device-checkbox {
    margin-top: 2px;
  }

  .device-selection-size {
    margin-top: 1px;
  }

  .device-selection-controls {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding-left: 26px;
  }

  .quantity-control {
    align-self: flex-end;
  }

  .modal-footer {
    gap: 8px;
  }

  .modal-btn {
    flex: 1;
    padding-inline: 12px;
    font-size: 12px;
  }

  .layout-item {
    align-items: stretch;
    flex-direction: column;
    gap: 11px;
  }

  .layout-item__actions {
    justify-content: flex-end;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .sidebar-header {
    display: none;
  }

  .global-container {
    height: calc(100vh - var(--navbar-height));
    height: calc(100dvh - var(--navbar-height));
    min-height: 0;
    padding: 8px max(8px, env(safe-area-inset-right, 0px))
      max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
  }

  .editor-layout {
    display: grid;
    grid-template-columns: minmax(210px, 250px) minmax(0, 1fr);
    gap: 8px;
    height: calc(100dvh - var(--navbar-height) - 16px);
  }

  .editor-sidebar {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
    min-height: 0;
    padding: 0 2px;
  }

  .sidebar-header {
    gap: 8px;
    padding: 10px;
    border-radius: 11px;
  }

  .sidebar-header__main {
    gap: 8px;
  }

  .sidebar-header__icon {
    flex-basis: 34px;
    width: 34px;
    height: 34px;
    border-radius: 9px;
  }

  .sidebar-header__icon svg {
    width: 19px;
    height: 19px;
  }

  .sidebar-header__eyebrow {
    display: none;
  }

  .sidebar-title {
    font-size: 16px;
  }

  .sidebar-subtitle {
    gap: 3px 5px;
    font-size: 10px;
  }

  .status-chip {
    min-height: 31px;
    padding: 6px 9px;
    border-radius: 8px;
    font-size: 10px;
  }

  .readonly-hint {
    padding: 8px 9px;
    font-size: 10px;
  }

  .sidebar-section {
    gap: 7px;
    padding: 8px;
    border-radius: 10px;
  }

  .section-title {
    font-size: 10px;
  }

  .form-group {
    gap: 4px;
  }

  .form-group label {
    font-size: 11px;
  }

  .form-select,
  .form-input {
    min-height: 34px;
    padding: 6px 8px;
    font-size: 12px;
  }

  .tool-grid {
    gap: 6px;
  }

  .tool-btn {
    min-height: 34px;
    padding: 6px 8px;
    border-radius: 7px;
    font-size: 11px;
  }

  .tool-btn__icon {
    flex-basis: 16px;
    width: 16px;
    font-size: 13px;
  }

  .tool-btn__count {
    min-width: 20px;
    padding: 1px 5px;
    font-size: 9px;
  }

  .zoom-row {
    gap: 5px;
  }

  .zoom-btn {
    min-width: 30px;
    height: 30px;
    padding-inline: 8px;
    font-size: 11px;
  }

  .zoom-btn--fit {
    font-size: 10px;
  }

  .zoom-value {
    min-width: 38px;
    font-size: 11px;
  }

  .zoom-slider {
    margin-block: 3px;
  }

  .grid-size-select {
    min-height: 32px;
    padding-block: 5px;
  }

  .properties-grid {
    gap: 5px;
    padding: 8px;
  }

  .property-item {
    font-size: 10px;
  }

  .nudge {
    gap: 8px;
  }

  .nudge__pad {
    grid-template-columns: repeat(3, 34px);
    grid-template-rows: repeat(3, 34px);
    gap: 3px;
  }

  .nudge__btn {
    min-height: 34px;
    border-radius: 7px;
    font-size: 12px;
  }

  .nudge__center {
    font-size: 9px;
  }

  .step-chip {
    min-height: 27px;
    padding: 4px 8px;
    font-size: 10px;
  }

  .gesture-hint {
    display: none;
  }

  .measure-result {
    gap: 6px;
    padding: 8px;
  }

  .measure-hint {
    font-size: 10px;
  }

  .editor-canvas-wrapper {
    position: relative;
    top: auto;
    z-index: auto;
    order: 0;
    height: 100%;
    min-height: 0;
    max-height: none;
    padding: 8px;
    border-radius: 12px;
  }

  .floating-actions {
    gap: 3px;
    margin-top: 0;
    padding: 3px;
  }

  .floating-btn {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .mobile-toolbar {
    display: none;
  }

  .modal-overlay {
    padding: max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px))
      max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
  }

  .modal-content {
    width: min(760px, 100%);
    max-height: calc(
      100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 16px
    );
    border-radius: 12px;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 10px 14px;
  }

  .modal-title {
    font-size: 16px;
  }

  .modal-subtitle {
    display: none;
  }

  .modal-close {
    flex-basis: 30px;
    width: 30px;
    height: 30px;
  }

  .modal-body {
    min-height: 0;
  }

  .modal-btn {
    min-height: 36px;
    padding: 7px 13px;
    font-size: 12px;
  }

  .device-selection-list {
    gap: 7px;
  }

  .device-selection-item {
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
  }

  .device-selection-name {
    font-size: 12px;
  }

  .device-selection-controls {
    align-items: center;
    flex-direction: row;
    padding-left: 25px;
  }

  .quantity-control {
    padding: 2px;
  }

  .qty-btn {
    width: 26px;
    height: 26px;
  }

  .qty-input {
    width: 38px;
    height: 26px;
  }

  .admin-empty {
    padding: 26px 18px;
  }

  .layout-item {
    align-items: center;
    flex-direction: row;
    gap: 12px;
    padding: 10px 12px;
  }

  .layout-btn {
    height: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .editor-sidebar *,
  .editor-canvas-wrapper *,
  .mobile-toolbar *,
  .modal-content * {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ===================== ПЕЧАТЬ ===================== */
/* На лист отправляется только холст: линейки, сетка, красная зона отступа и весь
   интерфейс редактора нужны на экране, а не на монтажной схеме */
@media print {
  .editor-sidebar,
  .mobile-toolbar,
  .layout-loading,
  .modal-overlay,
  .ruler,
  .measure-svg,
  .floating-actions,
  .size-tooltip,
  .resize-handle {
    display: none !important;
  }

  .global-container,
  .editor-layout,
  .editor-canvas-wrapper,
  .canvas-container {
    display: block;
    position: static;
    width: auto;
    max-width: none;
    height: auto;
    min-height: 0;
    padding: 0;
    margin: 0;
    border: 0;
    overflow: visible;
    box-shadow: none;
    background: none;
  }

  .canvas {
    position: static;
    left: auto;
    top: auto;
    background-color: #fff;
    border: 1px solid #cbd5e0;
    box-shadow: none;
    /* zoom, а не transform: он пересчитывает поток, и холст не вылезает за лист */
    zoom: var(--print-zoom);
    /* цвета рейок и приборов помогают читать чертёж */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .canvas.grid-enabled {
    background-image: none;
  }

  /* Холст сжимается в printZoom раз, и 11 px подписей сжимаются вместе с ним:
     на широкой панели остаются долями миллиметра. Здесь кегль задан от размера
     буквы на бумаге, а не от экранного размера шрифта */
  .item-label,
  .panel-item.din-rail .item-label {
    font-size: var(--print-label-px);
  }

  .panel-item.selected {
    outline: 0;
    box-shadow: none;
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

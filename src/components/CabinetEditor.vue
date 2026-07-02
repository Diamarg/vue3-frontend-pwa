<template>
  <div class="global-container">
    <div class="editor-layout">
      <!-- Боковая панель управления -->
      <aside class="editor-sidebar">
        <div class="sidebar-section">
          <h2 class="sidebar-title">Редактор панелей</h2>
        </div>

        <div class="sidebar-section">
          <div class="form-group">
            <label for="panel-select">Панель</label>
            <select
              id="panel-select"
              v-model="selectedPanelId"
              @change="onPanelChange"
              class="form-select"
            >
              <option v-for="p in panels" :key="p.id" :value="p.id">
                {{ p.name }} ({{ p.h }}x{{ p.w }})
              </option>
            </select>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="form-group">
            <label>Масштаб: {{ zoomPercent }}%</label>
            <input
              type="range"
              min="30"
              max="200"
              step="5"
              v-model.number="zoomPercent"
              class="zoom-slider"
            />
          </div>
        </div>

        <div class="sidebar-section">
          <h3 class="section-title">Инструменты</h3>
          <div class="tools-grid">
            <button
              @click="toggleMeasureMode"
              :class="['icon-button', { active: isMeasuring }]"
              title="Измерить расстояние"
            >
              📏
            </button>
            <button
              v-if="isMeasuring"
              @click="toggleOrthogonal"
              :class="['icon-button', 'icon-button--ortho', { active: isOrthogonal }]"
              title="Ортогональный режим"
            >
              ⊞
            </button>
            <button @click="addBox" class="icon-button icon-button--add" title="Добавить короб">
              ▢
            </button>
          </div>
        </div>

        <div class="sidebar-section" v-if="pointA && pointB">
          <h3 class="section-title">Измерение</h3>
          <div class="measure-result">
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
        </div>

        <div class="sidebar-section">
          <h3 class="section-title">Устройства</h3>
          <div class="device-list">
            <div
              v-for="dev in devicePalette"
              :key="dev.id"
              :class="['device-item', { used: isDeviceFullyUsed(dev.id) }]"
              :draggable="!isDeviceFullyUsed(dev.id)"
              @dragstart="onDragStart($event, dev)"
            >
              <div class="device-info">
                <span class="device-name">{{ dev.name }}</span>
                <span class="device-size">{{ dev.w }}×{{ dev.h }}</span>
              </div>
              <div class="device-meta">
                <span class="quantity-badge">
                  {{ getDeviceUsedCount(dev.id) }}/{{ dev.quantity }}
                </span>
                <span v-if="isDeviceFullyUsed(dev.id)" class="used-badge">✓</span>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-section" v-if="selectedItems.length > 1">
          <h3 class="section-title">Выбрано: {{ selectedItems.length }}</h3>
          <button @click="deleteSelectedItems" class="action-button action-button--danger">
            <span class="button-icon">🗑</span>
            <span>Удалить выбранные</span>
          </button>
        </div>

        <div class="sidebar-section" v-if="selectedItem && selectedItems.length === 1">
          <h3 class="section-title">Свойства</h3>
          <div class="properties-grid">
            <div class="property-item">
              <span class="property-label">Тип:</span>
              <span class="property-value">{{
                selectedItem.type === 'device' ? 'Устройство' : 'Короб'
              }}</span>
            </div>
            <div class="property-item">
              <span class="property-label">Размер:</span>
              <span class="property-value"
                >{{ selectedItem.w * GRID_STEP_MM }}×{{ selectedItem.h * GRID_STEP_MM }} мм</span
              >
            </div>
            <div class="property-item">
              <span class="property-label">Позиция:</span>
              <span class="property-value"
                >X:{{ selectedItem.x * GRID_STEP_MM }}, Y:{{ selectedItem.y * GRID_STEP_MM }}</span
              >
            </div>
          </div>
        </div>
      </aside>

      <!-- Основная область (Холст) -->
      <main class="editor-canvas-wrapper" ref="canvasWrapper">
        <div class="canvas-scaler" :style="canvasScalerStyle">
          <div class="canvas-container" :style="containerStyle">
            <!-- Разметка по оси Y (слева) -->
            <div class="ruler ruler-y">
              <div
                v-for="mark in yMarks"
                :key="mark.id"
                class="ruler-mark"
                :style="getMarkStyle(mark.value, 'y')"
              >
                <span class="mark-label">{{ mark.value * GRID_STEP_MM }}</span>
              </div>
            </div>

            <!-- Разметка по оси X (сверху) -->
            <div class="ruler ruler-x">
              <div
                v-for="mark in xMarks"
                :key="mark.id"
                class="ruler-mark"
                :style="getMarkStyle(mark.value, 'x')"
              >
                <span class="mark-label">{{ mark.value * GRID_STEP_MM }}</span>
              </div>
            </div>

            <!-- Холст с панелью -->
            <div
              class="canvas"
              :class="{ 'measure-mode': isMeasuring, 'select-mode': isSelecting }"
              :style="canvasStyle"
              @drop="onDrop"
              @dragover.prevent
              @click="onCanvasClick"
              @mousemove="onCanvasMouseMove"
              @mousedown="onCanvasMouseDown"
            >
              <!-- SVG для отрисовки линии измерения и рамки выделения -->
              <svg
                v-if="pointA || isMeasuring || (isSelecting && selectionStart)"
                class="measure-svg"
                :width="panelGridW * PIXELS_PER_GRID_UNIT"
                :height="panelGridH * PIXELS_PER_GRID_UNIT"
              >
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

              <!-- Плавающие кнопки действий для выделенного элемента -->
              <div
                v-if="selectedItems.length === 1 && selectedItem"
                class="floating-actions"
                :style="floatingActionsStyle"
              >
                <button
                  v-if="selectedItem?.type === 'box'"
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

              <!-- Tooltip с размерами рядом с курсором -->
              <div v-if="resizeState && mousePosition" class="size-tooltip" :style="tooltipStyle">
                {{ resizeState.item.w * GRID_STEP_MM }} × {{ resizeState.item.h * GRID_STEP_MM }} мм
              </div>

              <!-- Элементы на панели -->
              <div
                v-for="item in items"
                :key="item.id"
                :class="['panel-item', item.type, { selected: selectedItems.includes(item) }]"
                :style="getItemStyle(item)"
                @pointerdown="startDrag($event, item)"
              >
                <div class="item-label">{{ item.name }}</div>

                <template
                  v-if="
                    item.type === 'box' && selectedItems.length === 1 && selectedItems[0] === item
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

// --- КОНСТАНТЫ И НАСТРОЙКИ ---
const GRID_STEP_MM = 5
const PIXELS_PER_GRID_UNIT = 10
const RULER_SIZE = 30
const RULER_MARK_STEP_MM = 50

const zoomPercent = ref(80)

// --- ДАННЫЕ ---
const panels = [
  { id: 1, name: 'Малая', w: 500, h: 500 },
  { id: 2, name: 'Средняя', w: 500, h: 600 },
  { id: 3, name: 'Широкая', w: 500, h: 700 },
  { id: 4, name: 'Большая', w: 600, h: 800 },
  { id: 5, name: 'Макси', w: 800, h: 1000 },
]

const devicePalette = [
  { id: 'dev1', name: 'Автомат 1P', w: 18, h: 70, quantity: 5 },
  { id: 'dev2', name: 'Контактор', w: 36, h: 70, quantity: 3 },
  { id: 'dev3', name: 'Реле', w: 50, h: 50, quantity: 4 },
  { id: 'dev4', name: 'Блок питания', w: 90, h: 90, quantity: 2 },
]

const selectedPanelId = ref(1)
const currentPanel = computed(() => panels.find((p) => p.id === selectedPanelId.value))
const currentScale = computed(() => zoomPercent.value / 100)

const panelGridW = computed(() => Math.floor(currentPanel.value.w / GRID_STEP_MM))
const panelGridH = computed(() => Math.floor(currentPanel.value.h / GRID_STEP_MM))

const items = ref([])
const selectedItem = ref(null)
const selectedItems = ref([])
let nextId = 1
let boxCounter = 1

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
  const dev = devicePalette.find((d) => d.id === devId)
  if (!dev) return false
  return getDeviceUsedCount(devId) >= dev.quantity
}

// --- РАЗМЕТКА (ЛИНЕЙКИ) ---
const xMarks = computed(() => {
  const marks = []
  const stepUnits = RULER_MARK_STEP_MM / GRID_STEP_MM
  for (let i = 0; i <= panelGridW.value; i += stepUnits) {
    marks.push({ id: `x-${i}`, value: i })
  }
  return marks
})

const yMarks = computed(() => {
  const marks = []
  const stepUnits = RULER_MARK_STEP_MM / GRID_STEP_MM
  for (let i = 0; i <= panelGridH.value; i += stepUnits) {
    marks.push({ id: `y-${i}`, value: i })
  }
  return marks
})

// --- СТИЛИ ---
const canvasScalerStyle = computed(() => ({
  width: `${(RULER_SIZE + panelGridW.value * PIXELS_PER_GRID_UNIT) * currentScale.value}px`,
  height: `${(RULER_SIZE + panelGridH.value * PIXELS_PER_GRID_UNIT) * currentScale.value}px`,
}))

const containerStyle = computed(() => ({
  width: `${RULER_SIZE + panelGridW.value * PIXELS_PER_GRID_UNIT}px`,
  height: `${RULER_SIZE + panelGridH.value * PIXELS_PER_GRID_UNIT}px`,
  transform: `scale(${currentScale.value})`,
  transformOrigin: 'top left',
}))

const canvasStyle = computed(() => ({
  width: `${panelGridW.value * PIXELS_PER_GRID_UNIT}px`,
  height: `${panelGridH.value * PIXELS_PER_GRID_UNIT}px`,
  left: `${RULER_SIZE}px`,
  top: `${RULER_SIZE}px`,
  backgroundSize: `${PIXELS_PER_GRID_UNIT}px ${PIXELS_PER_GRID_UNIT}px`,
}))

const getItemStyle = (item) => ({
  left: `${item.x * PIXELS_PER_GRID_UNIT}px`,
  top: `${item.y * PIXELS_PER_GRID_UNIT}px`,
  width: `${item.w * PIXELS_PER_GRID_UNIT}px`,
  height: `${item.h * PIXELS_PER_GRID_UNIT}px`,
})

const getMarkStyle = (cellValue, axis) => {
  return axis === 'x'
    ? { left: `${cellValue * PIXELS_PER_GRID_UNIT}px` }
    : { top: `${cellValue * PIXELS_PER_GRID_UNIT}px` }
}

// --- ПЛАВАЮЩИЕ КНОПКИ ДЕЙСТВИЙ ---
const floatingActionsStyle = computed(() => {
  // Показываем для любого одиночного выделенного элемента (и устройства, и короба)
  if (!selectedItem.value) return { display: 'none' }

  const item = selectedItem.value
  const centerX = (item.x + item.w / 2) * PIXELS_PER_GRID_UNIT
  const topY = item.y * PIXELS_PER_GRID_UNIT

  const showBelow = item.y < 5
  const yOffset = showBelow ? item.h * PIXELS_PER_GRID_UNIT + 8 : -44

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
const mmToCells = (mm) => Math.round(mm / GRID_STEP_MM)
const snapToGrid = (val) => Math.round(val)
const mmToPx = (mm) => (mm / GRID_STEP_MM) * PIXELS_PER_GRID_UNIT

const isOutOfBounds = (item) => {
  return (
    item.x < 0 ||
    item.y < 0 ||
    item.x + item.w > panelGridW.value ||
    item.y + item.h > panelGridH.value
  )
}

const isValidPosition = (item) => {
  return !isOutOfBounds(item)
}

const isFullyInsideSelection = (item, start, current) => {
  const itemLeft = item.x * PIXELS_PER_GRID_UNIT
  const itemTop = item.y * PIXELS_PER_GRID_UNIT
  const itemRight = itemLeft + item.w * PIXELS_PER_GRID_UNIT
  const itemBottom = itemTop + item.h * PIXELS_PER_GRID_UNIT

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

// --- КООРДИНАТЫ ---
const getMmFromEvent = (e) => {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const scale = currentScale.value

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const nativeX = screenX / scale
  const nativeY = screenY / scale

  const contentX = nativeX - el.clientLeft
  const contentY = nativeY - el.clientTop

  const mmX = (contentX / PIXELS_PER_GRID_UNIT) * GRID_STEP_MM
  const mmY = (contentY / PIXELS_PER_GRID_UNIT) * GRID_STEP_MM

  return {
    x: Math.round(mmX * 100) / 100,
    y: Math.round(mmY * 100) / 100,
  }
}

const getPxFromEvent = (e, el) => {
  const rect = el.getBoundingClientRect()
  const scale = currentScale.value

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const nativeX = screenX / scale
  const nativeY = screenY / scale

  const contentX = nativeX - el.clientLeft
  const contentY = nativeY - el.clientTop

  return {
    x: contentX,
    y: contentY,
  }
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

const getCellsFromEvent = (e) => {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const scale = currentScale.value

  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top

  const nativeX = screenX / scale
  const nativeY = screenY / scale

  const contentX = nativeX - el.clientLeft
  const contentY = nativeY - el.clientTop

  const cellX = contentX / PIXELS_PER_GRID_UNIT
  const cellY = contentY / PIXELS_PER_GRID_UNIT

  return {
    x: snapToGrid(cellX),
    y: snapToGrid(cellY),
  }
}

// --- ЛОГИКА ИЗМЕРЕНИЯ ---
const toggleMeasureMode = () => {
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

  if (justFinishedSelection.value) {
    return
  }

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
  selectedItem.value = null
  selectedItems.value = []
  resetMeasure()
}

let draggingFromPalette = null
const onDragStart = (e, dev) => {
  if (isDeviceFullyUsed(dev.id)) {
    e.preventDefault()
    return
  }

  draggingFromPalette = dev
  e.dataTransfer.effectAllowed = 'copy'
}

const onDrop = (e) => {
  if (!draggingFromPalette || isMeasuring.value) return

  if (isDeviceFullyUsed(draggingFromPalette.id)) {
    draggingFromPalette = null
    return
  }

  const { x, y } = getCellsFromEvent(e)

  const newItem = {
    id: nextId++,
    type: 'device',
    deviceId: draggingFromPalette.id,
    name: draggingFromPalette.name,
    x: x,
    y: y,
    w: mmToCells(draggingFromPalette.w),
    h: mmToCells(draggingFromPalette.h),
  }

  if (isValidPosition(newItem)) {
    items.value.push(newItem)
  }
  draggingFromPalette = null
}

const addBox = () => {
  const offset = (boxCounter - 1) * 10
  const newBox = {
    id: nextId++,
    type: 'box',
    name: `Короб ${boxCounter}`,
    x: offset,
    y: offset,
    w: mmToCells(25),
    h: mmToCells(25),
  }

  if (isValidPosition(newBox)) {
    items.value.push(newBox)
    selectedItems.value = [newBox]
    selectedItem.value = newBox
    boxCounter++
  } else {
    let placed = false
    for (let y = 0; y <= panelGridH.value - newBox.h && !placed; y++) {
      for (let x = 0; x <= panelGridW.value - newBox.w && !placed; x++) {
        const testBox = { ...newBox, x, y }
        if (isValidPosition(testBox)) {
          newBox.x = x
          newBox.y = y
          items.value.push(newBox)
          selectedItems.value = [newBox]
          selectedItem.value = newBox
          boxCounter++
          placed = true
        }
      }
    }
    if (!placed) alert('Нет свободного места для нового короба!')
  }
}

const copyItem = () => {
  if (!selectedItem.value || selectedItem.value.type !== 'box') return

  const original = selectedItem.value

  const offset = 10
  let newX = original.x + offset
  let newY = original.y + offset

  const copiedBox = {
    id: nextId++,
    type: 'box',
    name: `${original.name} (копия)`,
    x: newX,
    y: newY,
    w: original.w,
    h: original.h,
  }

  if (isValidPosition(copiedBox)) {
    items.value.push(copiedBox)
    selectedItems.value = [copiedBox]
    selectedItem.value = copiedBox
  } else {
    let placed = false
    for (let y = 0; y <= panelGridH.value - copiedBox.h && !placed; y++) {
      for (let x = 0; x <= panelGridW.value - copiedBox.w && !placed; x++) {
        const testBox = { ...copiedBox, x, y }
        if (isValidPosition(testBox)) {
          copiedBox.x = x
          copiedBox.y = y
          items.value.push(copiedBox)
          selectedItems.value = [copiedBox]
          selectedItem.value = copiedBox
          placed = true
        }
      }
    }

    if (!placed) {
      alert('Нет свободного места для копирования короба!')
    }
  }
}

const deleteSelectedItems = () => {
  if (selectedItems.value.length === 0) return
  items.value = items.value.filter((i) => !selectedItems.value.includes(i))
  selectedItems.value = []
  selectedItem.value = null
}

// --- DRAG & RESIZE ---
let dragState = null
let resizeState = null

const startDrag = (e, item) => {
  if (isMeasuring.value || isSelecting.value) return
  if (e.target.classList.contains('resize-handle')) return
  e.preventDefault()

  if (!selectedItems.value.includes(item)) {
    selectedItems.value = [item]
    selectedItem.value = item
  }

  dragState = {
    type: 'move',
    items: [...selectedItems.value],
    startPositions: selectedItems.value.map((i) => ({ x: i.x, y: i.y })),
    startMouseX: e.clientX,
    startMouseY: e.clientY,
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const startResize = (e, item, direction) => {
  if (isMeasuring.value || isSelecting.value) return
  e.preventDefault()
  selectedItem.value = item

  resizeState = {
    type: 'resize',
    item,
    direction,
    startMouseX: e.clientX,
    startMouseY: e.clientY,
    startItemX: item.x,
    startItemY: item.y,
    startItemW: item.w,
    startItemH: item.h,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

const onPointerMove = (e) => {
  const scale = currentScale.value
  const rawDx =
    (e.clientX - (dragState?.startMouseX || resizeState?.startMouseX)) /
    scale /
    PIXELS_PER_GRID_UNIT
  const rawDy =
    (e.clientY - (dragState?.startMouseY || resizeState?.startMouseY)) /
    scale /
    PIXELS_PER_GRID_UNIT

  if (dragState) {
    const newPositions = dragState.startPositions.map((pos, idx) => ({
      x: snapToGrid(pos.x + rawDx),
      y: snapToGrid(pos.y + rawDy),
    }))

    const allValid = newPositions.every((pos, idx) => {
      const testItem = { ...dragState.items[idx], x: pos.x, y: pos.y }
      return isValidPosition(testItem)
    })

    if (allValid) {
      newPositions.forEach((pos, idx) => {
        dragState.items[idx].x = pos.x
        dragState.items[idx].y = pos.y
      })
    }
  }

  if (resizeState) {
    const { direction, startItemX, startItemY, startItemW, startItemH } = resizeState

    let newX = startItemX
    let newY = startItemY
    let newW = startItemW
    let newH = startItemH

    if (direction.includes('e')) {
      newW = Math.max(1, snapToGrid(startItemW + rawDx))
    } else if (direction.includes('w')) {
      const snappedDx = snapToGrid(rawDx)
      const maxLeftShift = startItemW - 1
      const clampedDx = Math.max(-maxLeftShift, snappedDx)
      newX = startItemX + clampedDx
      newW = startItemW - clampedDx
    }

    if (direction.includes('s')) {
      newH = Math.max(1, snapToGrid(startItemH + rawDy))
    } else if (direction.includes('n')) {
      const snappedDy = snapToGrid(rawDy)
      const maxTopShift = startItemH - 1
      const clampedDy = Math.max(-maxTopShift, snappedDy)
      newY = startItemY + clampedDy
      newH = startItemH - clampedDy
    }

    const tempItem = { ...resizeState.item, x: newX, y: newY, w: newW, h: newH }
    if (isValidPosition(tempItem)) {
      resizeState.item.x = newX
      resizeState.item.y = newY
      resizeState.item.w = newW
      resizeState.item.h = newH
    }

    // Обновляем позицию мыши для tooltip
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
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
})
</script>

<style scoped>
/* Глобальный контейнер */
.global-container {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 16px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #2d3748;
}

/* Основной layout */
.editor-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
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

.sidebar-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #2d3748;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
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

.form-select {
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

.form-select:hover {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.3);
}

.form-select:focus {
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

/* Инструменты */
.tools-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  background-color: white;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.icon-button:hover {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.3);
  border-color: #cbd5e0;
  transform: translateY(-1px);
}

.icon-button.active {
  background-color: #6366f1;
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.icon-button--ortho.active {
  background-color: #10b981;
  border-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.icon-button--add {
  background-color: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.icon-button--add:hover {
  background-color: #d97706;
  border-color: #d97706;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

/* Результат измерения */
.measure-result {
  display: grid;
  gap: 8px;
  padding: 12px;
  background-color: #f7fafc;
  border-radius: 6px;
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

/* Устройства */
.device-list {
  display: grid;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.device-list::-webkit-scrollbar {
  width: 6px;
}

.device-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.device-list::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.device-list::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background-color: white;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  cursor: grab;
  transition: all 0.3s;
}

.device-item:hover:not(.used) {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.3);
  border-color: #cbd5e0;
}

.device-item.used {
  background-color: #f7fafc;
  cursor: not-allowed;
  opacity: 0.6;
}

.device-info {
  display: grid;
  gap: 2px;
}

.device-name {
  font-size: 13px;
  font-weight: 500;
  color: #2d3748;
}

.device-size {
  font-size: 11px;
  color: #718096;
}

.device-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.quantity-badge {
  padding: 3px 8px;
  background-color: #e0e7ff;
  color: #4338ca;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.used-badge {
  padding: 3px 6px;
  background-color: #10b981;
  color: white;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
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

.action-button:hover {
  background-color: #4f46e5;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
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

/* Холст - центрируется и подстраивается */
.editor-canvas-wrapper {
  background-color: rgb(255, 255, 255);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  padding: 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
}

.canvas-scaler {
  position: relative;
  flex-shrink: 0;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
}

/* Линейки */
.ruler {
  position: absolute;
  background-color: #f7fafc;
  border: 1px solid rgb(230, 230, 230);
  overflow: visible;
}

.ruler-x {
  left: 30px;
  top: 0;
  height: 30px;
  border-bottom: 2px solid #cbd5e0;
}

.ruler-y {
  left: 0;
  top: 30px;
  width: 30px;
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
  background-image:
    linear-gradient(to right, #e2e8f0 1px, transparent 1px),
    linear-gradient(to bottom, #e2e8f0 1px, transparent 1px);
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

/* Элементы на панели */
.panel-item {
  position: absolute;
  border: 1px solid #cbd5e0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  user-select: none;
  transition: all 0.2s;
  overflow: visible;
  mix-blend-mode: multiply;
}

.panel-item.device {
  background-color: rgba(99, 102, 241, 0.85);
  color: white;
  border-color: #6366f1;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.panel-item.box {
  background-color: rgba(251, 191, 36, 0.3);
  border: 2px dashed #f59e0b;
  border-radius: 2px;
}

.panel-item.selected {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

.item-label {
  font-size: 11px;
  font-weight: 500;
  pointer-events: none;
  text-align: center;
  padding: 4px;
  line-height: 1.2;
}

/* Tooltip с размерами рядом с курсором */
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
  width: 8px;
  height: 8px;
  border-radius: 2px;
  mix-blend-mode: normal;
  transition: all 0.2s;
}

.resize-handle:hover {
  transform: scale(1.2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
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
</style>

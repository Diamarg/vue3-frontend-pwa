<template>
  <div class="editor-container">
    <!-- Боковая панель управления -->
    <aside class="sidebar">
      <h2>Редактор панелей</h2>

      <div class="section">
        <h3>Выбор панели</h3>
        <select v-model="selectedPanelId" @change="onPanelChange">
          <option v-for="p in panels" :key="p.id" :value="p.id">
            {{ p.name }} ({{ p.h }}x{{ p.w }} мм)
          </option>
        </select>
      </div>

      <div class="section">
        <h3>Масштаб: {{ zoomPercent }}%</h3>
        <input
          type="range"
          min="30"
          max="200"
          step="5"
          v-model.number="zoomPercent"
          class="zoom-slider"
        />
      </div>

      <div class="section">
        <h3>Инструменты</h3>
        <button @click="toggleMeasureMode" :class="['btn-tool', { active: isMeasuring }]">
          📏 {{ isMeasuring ? 'Измерение ВКЛ' : 'Измерить расстояние' }}
        </button>
        <button
          v-if="isMeasuring"
          @click="toggleOrthogonal"
          :class="['btn-tool btn-ortho', { active: isOrthogonal }]"
          :disabled="!isMeasuring"
        >
          ⊞ {{ isOrthogonal ? 'Ортогональный ВКЛ' : 'Ортогональный режим' }}
        </button>
        <button v-if="pointA || pointB" @click="resetMeasure" class="btn-reset">
          ✕ Сбросить измерение
        </button>
      </div>

      <div class="section" v-if="pointA && pointB">
        <h3>Результат измерения</h3>
        <p v-if="isOrthogonal" class="mode-hint">📐 Ортогональный режим</p>
        <p><b>Расстояние:</b> {{ measureResult.distance }} мм</p>
        <p><b>ΔX:</b> {{ measureResult.dx }} мм</p>
        <p><b>ΔY:</b> {{ measureResult.dy }} мм</p>
        <p class="coords"><b>A:</b> ({{ pointA.x }}, {{ pointA.y }})</p>
        <p class="coords"><b>B:</b> ({{ pointB.x }}, {{ pointB.y }})</p>
      </div>

      <div class="section">
        <h3>Устройства (Фикс. размер)</h3>
        <div
          v-for="dev in devicePalette"
          :key="dev.id"
          :class="['palette-item', 'device', { used: isDeviceFullyUsed(dev.id) }]"
          :draggable="!isDeviceFullyUsed(dev.id)"
          @dragstart="onDragStart($event, dev)"
        >
          <span>{{ dev.name }}</span>
          <small>{{ dev.w }}x{{ dev.h }} мм</small>
          <span class="quantity-badge"> {{ getDeviceUsedCount(dev.id) }}/{{ dev.quantity }} </span>
          <span v-if="isDeviceFullyUsed(dev.id)" class="used-badge">✓ Все добавлены</span>
        </div>
      </div>

      <div class="section">
        <h3>Короба (Изменяемый размер)</h3>
        <button @click="addBox" class="btn-add">+ Добавить короб</button>
      </div>

      <div class="section" v-if="selectedItems.length > 0">
        <h3>Выбрано: {{ selectedItems.length }}</h3>
        <button @click="deleteSelectedItems" class="btn-delete">Удалить выбранные</button>
        <button
          v-if="selectedItems.length === 1 && selectedItem?.type === 'box'"
          @click="copyItem"
          class="btn-copy"
        >
          📋 Копировать
        </button>
      </div>

      <div class="section" v-if="selectedItem && selectedItems.length === 1">
        <h3>Свойства</h3>
        <p>Тип: {{ selectedItem.type === 'device' ? 'Устройство' : 'Короб' }}</p>
        <p>Размер: {{ selectedItem.w * GRID_STEP_MM }}x{{ selectedItem.h * GRID_STEP_MM }} мм</p>
        <p>
          Позиция: X:{{ selectedItem.x * GRID_STEP_MM }}, Y:{{ selectedItem.y * GRID_STEP_MM }} мм
        </p>
      </div>
    </aside>

    <!-- Основная область (Холст) -->
    <main class="canvas-wrapper" ref="canvasWrapper">
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
            <!-- Рамка выделения -->
            <rect
              v-if="isSelecting && selectionStart && selectionCurrent"
              :x="Math.min(selectionStart.x, selectionCurrent.x)"
              :y="Math.min(selectionStart.y, selectionCurrent.y)"
              :width="Math.abs(selectionCurrent.x - selectionStart.x)"
              :height="Math.abs(selectionCurrent.y - selectionStart.y)"
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              stroke-width="2"
              stroke-dasharray="4 4"
            />

            <!-- Линия измерения -->
            <line
              v-if="isMeasuring && pointA && previewPoint"
              :x1="mmToPx(pointA.x)"
              :y1="mmToPx(pointA.y)"
              :x2="mmToPx(previewPoint.x)"
              :y2="mmToPx(previewPoint.y)"
              stroke="#8b5cf6"
              stroke-width="1.5"
              stroke-dasharray="4 4"
              opacity="0.6"
            />
            <line
              v-if="pointA && pointB"
              :x1="mmToPx(pointA.x)"
              :y1="mmToPx(pointA.y)"
              :x2="mmToPx(pointB.x)"
              :y2="mmToPx(pointB.y)"
              stroke="#8b5cf6"
              stroke-width="2"
              stroke-dasharray="6 3"
            />
            <circle
              v-if="pointA"
              :cx="mmToPx(pointA.x)"
              :cy="mmToPx(pointA.y)"
              r="5"
              fill="#8b5cf6"
              stroke="white"
              stroke-width="2"
            />
            <circle
              v-if="pointB"
              :cx="mmToPx(pointB.x)"
              :cy="mmToPx(pointB.y)"
              r="5"
              fill="#8b5cf6"
              stroke="white"
              stroke-width="2"
            />
          </svg>

          <!-- Элементы на панели -->
          <div
            v-for="item in items"
            :key="item.id"
            :class="['panel-item', item.type, { selected: selectedItems.includes(item) }]"
            :style="getItemStyle(item)"
            @pointerdown="startDrag($event, item)"
          >
            <div class="item-label">{{ item.name }}</div>

            <!-- Отображение размеров при изменении размера -->
            <div v-if="item.type === 'box' && resizingItem === item" class="size-tooltip">
              {{ item.w * GRID_STEP_MM }} × {{ item.h * GRID_STEP_MM }} мм
            </div>

            <!-- 8 ручек изменения размера для коробов (только если выбран один короб) -->
            <template
              v-if="item.type === 'box' && selectedItems.length === 1 && selectedItems[0] === item"
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
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
const resizingItem = ref(null)

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
const canvasEl = ref(null)

const onCanvasMouseDown = (e) => {
  if (e.target.closest('.panel-item')) return
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

const onWindowMouseUp = (e) => {
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
  items.value = []
  selectedItem.value = null
  selectedItems.value = []
  boxCounter = 1
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

  // Создаём копию со смещением
  const offset = 10 // Смещение на 10 ячеек (50мм)
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

  // Проверяем, помещается ли копия в доступное место
  if (isValidPosition(copiedBox)) {
    items.value.push(copiedBox)
    selectedItems.value = [copiedBox]
    selectedItem.value = copiedBox
  } else {
    // Если не помещается, ищем свободное место
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
  resizingItem.value = item

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
  }
}

const onPointerUp = () => {
  dragState = null
  resizeState = null
  resizingItem.value = null
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
* {
  box-sizing: border-box;
}
.editor-container {
  display: flex;
  height: 100vh;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  background-color: #f3f4f6;
  color: #1f2937;
}

.sidebar {
  width: 280px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  padding: 20px;
  overflow-y: auto;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
}
.sidebar h2 {
  margin-top: 0;
  font-size: 1.25rem;
}
.sidebar h3 {
  font-size: 0.9rem;
  text-transform: uppercase;
  color: #6b7280;
  margin: 20px 0 10px;
}
.section {
  margin-bottom: 20px;
  border-bottom: 1px solid #f3f4f6;
  padding-bottom: 15px;
}

select,
button,
input[type='range'] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
}
button:hover {
  background: #f9fafb;
}
.btn-add {
  background: #3b82f6;
  color: white;
  border: none;
  font-weight: 500;
}
.btn-add:hover {
  background: #2563eb;
}
.btn-delete {
  background: #ef4444;
  color: white;
  border: none;
  margin-top: 10px;
}
.btn-copy {
  background: #10b981;
  color: white;
  border: none;
  font-weight: 500;
  margin-top: 8px;
}
.btn-copy:hover {
  background: #059669;
}
.btn-tool {
  background: #8b5cf6;
  color: white;
  border: none;
  font-weight: 500;
  margin-bottom: 8px;
}
.btn-tool:hover {
  background: #7c3aed;
}
.btn-tool.active {
  background: #6d28d9;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3);
}
.btn-ortho {
  background: #10b981;
}
.btn-ortho:hover {
  background: #059669;
}
.btn-ortho.active {
  background: #047857;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
}
.btn-reset {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}
.btn-reset:hover {
  background: #e5e7eb;
}
.zoom-slider {
  margin-top: 8px;
  accent-color: #3b82f6;
}

.palette-item {
  padding: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: grab;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s;
  position: relative;
}
.palette-item:hover:not(.used) {
  border-color: #3b82f6;
  background: #eff6ff;
}
.palette-item small {
  color: #6b7280;
  font-size: 12px;
  width: 100%;
}

.quantity-badge {
  background: #dbeafe;
  color: #1e40af;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.palette-item.used {
  background: #f3f4f6;
  border-color: #d1d5db;
  cursor: not-allowed;
  opacity: 0.6;
}

.used-badge {
  background: #10b981;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  width: 100%;
  text-align: center;
  margin-top: 6px;
}

.canvas-wrapper {
  flex: 1;
  overflow: auto;
  padding: 40px;
  position: relative;
}

.canvas-container {
  position: relative;
  display: inline-block;
}

.ruler {
  position: absolute;
  background-color: #f9fafb;
  border: 1px solid #d1d5db;
  overflow: visible;
}
.ruler-x {
  left: 30px;
  top: 0;
  height: 30px;
  border-bottom: 2px solid #9ca3af;
}
.ruler-y {
  left: 0;
  top: 30px;
  width: 30px;
  border-right: 2px solid #9ca3af;
}
.ruler-mark {
  position: absolute;
}
.ruler-x .ruler-mark {
  top: 0;
  width: 1px;
  height: 100%;
  border-left: 1px solid #9ca3af;
}
.ruler-y .ruler-mark {
  left: 0;
  height: 1px;
  width: 100%;
  border-top: 1px solid #9ca3af;
}

.mark-label {
  position: absolute;
  font-size: 12px;
  color: #374151;
  font-weight: 600;
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

.canvas {
  position: absolute;
  background-color: #e5e7eb;
  border: 2px solid #9ca3af;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  background-image:
    linear-gradient(to right, #d1d5db 1px, transparent 1px),
    linear-gradient(to bottom, #d1d5db 1px, transparent 1px);
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

.panel-item {
  position: absolute;
  border: 1px solid #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: move;
  user-select: none;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
  overflow: visible;
  mix-blend-mode: multiply;
}
.panel-item.device {
  background-color: rgba(96, 165, 250, 0.85);
  color: #1e3a8a;
  border-color: #3b82f6;
  border-radius: 4px;
}
.panel-item.box {
  background-color: rgba(251, 191, 36, 0.4);
  border: 2px dashed #d97706;
  border-radius: 2px;
}
.panel-item.selected {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
  z-index: 10;
}
.item-label {
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
  text-align: center;
  padding: 4px;
  line-height: 1.2;
}

.size-tooltip {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 30;
  mix-blend-mode: normal;
}

.resize-handle {
  position: absolute;
  background: #d97706;
  border: 1px solid white;
  z-index: 20;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  width: 8px;
  height: 8px;
  mix-blend-mode: normal;
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

.coords {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.mode-hint {
  background: #d1fae5;
  color: #065f46;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}
</style>

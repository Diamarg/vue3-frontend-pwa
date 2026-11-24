<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import AInput from '@/components/A-input.vue'
import AModal from '@/components/A-modal.vue'
import AButton from '@/components/A-button.vue'
import { projectsApi } from '@/api/projects'
import { filesApi } from '@/api/files'
import { devicesApi } from '@/api/devices'
import { referenceApi } from '@/api/reference'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { useToast } from '@/composables/useToast'
import {
  buildTxtBlob,
  downloadTxt,
  formatFileNameStamp,
  reportHeader,
  safeFileNamePart,
} from '@/utils/txtReport'
import { buildDevicesXlsxBuffer, downloadXlsx, XLSX_MIME } from '@/utils/xlsxReport'

const route = useRoute()
const router = useRouter()
const toast = useToast()

defineProps(['projectId', 'assemblyId'])

const project = ref(null)
const assembly = ref(null)

const assemblyDevices = ref([])
const loadingDevices = ref(true)
const allDevices = ref([])
const deviceTypes = ref([])
const brands = ref([])

const authStore = useAuthStore()
const pageStore = usePageStore()

// ===================== ПОИСК И СОРТИРОВКА =====================
const searchBar = ref('')
const sortKey = ref('id')
const sortDir = ref('asc')
const isUpdatingQty = ref(false)

const columns = [
  { key: 'article', label: 'Артикул' },
  { key: 'description', label: 'Описание' },
  { key: 'brand', label: 'Бренд' },
  { key: 'deviceType', label: 'Тип устройства' },
  { key: 'quantity', label: 'Количество' },
]

const getSortValue = (item, key) => {
  if (key === 'id') return item.id
  return item[key] ?? ''
}

const isNumericSort = (key) => key === 'id' || key === 'quantity'

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortArrow = (key) => {
  if (sortKey.value !== key) return '⇅'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// ===================== ЗАГРУЗКА ДАННЫХ =====================
const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки проекта:', error)
  }
}

const loadAssembly = async () => {
  try {
    assembly.value = await projectsApi.getAssemblyById(route.params.assemblyId)
    pageStore.setEntity(assembly.value?.codeName)
  } catch (error) {
    console.error('Ошибка загрузки сборки:', error)
  }
}

const loadAssemblyDevices = async () => {
  loadingDevices.value = true
  try {
    // ✅ Используем новый эндпоинт, который сразу возвращает все детали
    const rawDevices = await projectsApi.getAssemblyDevicesWithDetails(route.params.assemblyId)

    assemblyDevices.value = (rawDevices || []).map((item) => ({
      id: item.id,
      assemblyId: item.assemblyId,
      deviceId: item.deviceId,
      quantity: item.quantity ?? 1,
      article: item.article || '—',
      description: item.description || '—',
      brand: item.brand || '—',
      deviceType: item.deviceType || '—',
      properties: item.properties || [], // Свойства уже в нужном формате!
    }))
  } catch (error) {
    toast.error('Не удалось загрузить устройства сборки')
    console.error('Не удалось загрузить устройства сборки', error)
  } finally {
    loadingDevices.value = false
  }
}

// ===================== ЗАГРУЗКА СПРАВОЧНИКОВ (для модального окна) =====================
const loadAllDevices = async () => {
  try {
    allDevices.value = await devicesApi.getAll()
  } catch (error) {
    toast.error('Не удалось загрузить справочник устройств')
    console.error('Не удалось загрузить устройства', error)
  }
}

const loadDeviceTypes = async () => {
  try {
    const raw = await referenceApi.getDeviceTypes()
    deviceTypes.value = (raw || []).map((t) => ({
      id: t.id ?? t.Id,
      name: t.name ?? t.Name ?? `Тип #${t.id ?? t.Id}`,
    }))
  } catch (error) {
    toast.error('Не удалось загрузить типы устройств')
    console.error('Не удалось загрузить типы устройств', error)
  }
}

const loadBrands = async () => {
  try {
    const raw = await referenceApi.getBrands()
    brands.value = (raw || []).map((b) => ({
      id: b.id ?? b.Id,
      name: b.name ?? b.Name ?? `Бренд #${b.id ?? b.Id}`,
    }))
  } catch (error) {
    toast.error('Не удалось загрузить бренды')
    console.error('Не удалось загрузить бренды', error)
  }
}

// ===================== ФИЛЬТРАЦИЯ И СОРТИРОВКА =====================
const filteredDevices = computed(() => {
  const q = searchBar.value.trim().toLowerCase()
  if (!q) return assemblyDevices.value

  return assemblyDevices.value.filter((it) =>
    ['article', 'description', 'brand', 'deviceType'].some((k) =>
      String(it[k] ?? '')
        .toLowerCase()
        .includes(q),
    ),
  )
})

const sortedDevices = computed(() => {
  const arr = [...filteredDevices.value]
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  const numeric = isNumericSort(key)

  arr.sort((a, b) => {
    const va = getSortValue(a, key)
    const vb = getSortValue(b, key)
    if (numeric) {
      return ((Number(va) || 0) - (Number(vb) || 0)) * dir
    }
    return String(va).localeCompare(String(vb), 'ru', { numeric: true, sensitivity: 'base' }) * dir
  })
  return arr
})

// Номер привязан к строке, а не к её месту на экране: считаем по порядку
// добавления (id), поэтому при обратной сортировке номера разворачиваются вместе со строками
const numsById = computed(() => {
  const ordered = [...filteredDevices.value].sort((a, b) => a.id - b.id)
  return new Map(ordered.map((d, i) => [d.id, i + 1]))
})

// ===================== СВОДКА И ЭКСПОРТ =====================
// Таблица сводки и текст отчёта строятся из одного снимка, поэтому строки
// и их номера на экране и в файле не разъезжаются. Снимок делаем при открытии
const showSummaryModal = ref(false)
const summaryReport = ref(null)
const exportFormat = ref('txt')
const exportingSummary = ref(false)
const uploadReportToProject = ref(false)

// Отчёт, в отличие от сводки, печатает шапку: проект с заказчиком, сборку и
// дату формирования. Нумерует файл сам по себе (1…N сверху вниз), а не колонкой
// № — в печатном отчёте номера должны идти подряд
const buildDevicesReport = () => {
  // одна метка времени на файл и на заголовок, чтобы они не разъехались на границе минуты
  const now = new Date()

  const rows = sortedDevices.value.map((d, i) => {
    // описание в скобках: без разделителей тип, бренд и артикул слипаются в одно слово
    const described = d.description && d.description !== '—' ? ` (${d.description})` : ''
    return {
      num: i + 1,
      deviceType: d.deviceType,
      brand: d.brand,
      article: d.article,
      description: d.description,
      quantity: d.quantity,
      name: `${[d.deviceType, d.brand, d.article].filter(Boolean).join(' ')}${described}`,
    }
  })

  return {
    fileName:
      `Устройства_${safeFileNamePart(project.value?.codeName)}_${safeFileNamePart(assembly.value?.codeName)}` +
      `_${formatFileNameStamp(now)}.txt`,
    rows,
    lines: [
      ...reportHeader(project.value, now, `Сборка: ${assembly.value?.codeName || '—'}`),
      ...rows.map((r) => `${r.num}. ${r.name || '—'} - ${r.quantity} шт.`),
    ],
  }
}

const openSummary = () => {
  summaryReport.value = buildDevicesReport()
  uploadReportToProject.value = false
  showSummaryModal.value = true
}

const REPORT_CATEGORY_NAME = 'Отчёты'

const ensureReportCategoryId = async () => {
  const categories = await filesApi.getCategories(route.params.projectId)
  const existing = (categories || []).find(
    (category) => (category.name || '').toLowerCase() === REPORT_CATEGORY_NAME.toLowerCase(),
  )
  if (existing) return existing.id

  const created = await filesApi.createCategory(route.params.projectId, {
    name: REPORT_CATEGORY_NAME,
  })
  return created.id
}

const uploadReportToProjectFiles = async (fileName, blob) => {
  const categoryId = await ensureReportCategoryId()
  const formData = new FormData()
  formData.append('file', blob, fileName)
  formData.append('fileCategoryId', String(categoryId))
  formData.append(
    'description',
    `Сводка по устройствам сборки ${assembly.value?.codeName || '—'} (${exportFormat.value.toUpperCase()})`,
  )
  await filesApi.uploadFile(route.params.projectId, formData)
}

const exportDevicesSummary = async () => {
  const report = summaryReport.value
  if (!report || exportingSummary.value) return

  exportingSummary.value = true
  try {
    let fileName
    let blob

    if (exportFormat.value === 'txt') {
      fileName = report.fileName
      blob = buildTxtBlob(report.lines)
      downloadTxt(fileName, report.lines)
    } else {
      fileName = report.fileName.replace(/\.txt$/, '.xlsx')
      const buffer = await buildDevicesXlsxBuffer(report.rows)
      blob = new Blob([buffer], { type: XLSX_MIME })
      downloadXlsx(fileName, buffer)
    }
    toast.success('Скачивание файла')

    if (uploadReportToProject.value) {
      try {
        await uploadReportToProjectFiles(fileName, blob)
        toast.success('Отчёт загружен в файлы проекта')
      } catch (error) {
        console.error('Не удалось загрузить отчёт в файлы проекта', error)
        toast.error('Не удалось загрузить отчёт в файлы проекта')
      }
    }
  } catch (error) {
    console.error('Не удалось сформировать отчёт', error)
    toast.error('Не удалось сформировать отчёт')
  } finally {
    exportingSummary.value = false
  }
}

// ===================== УПРАВЛЕНИЕ КОЛИЧЕСТВОМ =====================
const updateQuantity = async (assemblyDeviceId, newQty) => {
  try {
    isUpdatingQty.value = true
    await projectsApi.updateAssemblyDeviceQuantity(assemblyDeviceId, newQty)
    await loadAssemblyDevices()
  } catch (error) {
    console.error('Ошибка обновления количества:', error)
    toast.error('Не удалось обновить количество')
  } finally {
    isUpdatingQty.value = false
  }
}

const changeQuantity = async (assemblyDeviceId, currentQty, delta) => {
  const newQty = currentQty + delta
  if (newQty < 1 || newQty > 200) return
  if (!confirm(`Изменить количество на ${newQty}?`)) return
  await updateQuantity(assemblyDeviceId, newQty)
}

// ===================== РУЧНОЙ ВВОД КОЛИЧЕСТВА =====================
const editingQtyId = ref(null)
const editingQtyValue = ref(1)
const qtyInput = ref(null)

const startQtyEdit = (device) => {
  if (!authStore.isAdmin) return
  editingQtyId.value = device.id
  editingQtyValue.value = device.quantity
  nextTick(() => {
    const el = Array.isArray(qtyInput.value) ? qtyInput.value[0] : qtyInput.value
    el?.focus()
    el?.select()
  })
}

// fromEnter=true — остаёмся в режиме ввода при неверном значении,
// blur (false) — просто отменяем правку
const finishQtyEdit = async (device, fromEnter = false) => {
  if (editingQtyId.value !== device.id) return

  const parsed = Number(editingQtyValue.value)
  const qty = Math.trunc(parsed)
  if (!Number.isFinite(parsed) || qty < 1 || qty > 200) {
    if (fromEnter) toast.error('Количество должно быть целым от 1 до 200')
    else editingQtyId.value = null
    return
  }

  editingQtyId.value = null
  if (qty === device.quantity) return
  if (!confirm(`Изменить количество «${device.article}» с ${device.quantity} на ${qty}?`)) return

  await updateQuantity(device.id, qty)
}

// ===================== ДОБАВЛЕНИЕ УСТРОЙСТВА =====================
const showAddModal = ref(false)
const selectedDeviceTypeId = ref(null)
const selectedBrandId = ref(null)
const newDeviceId = ref(null)
const newQuantity = ref(1)

watch(selectedDeviceTypeId, () => {
  selectedBrandId.value = null
  newDeviceId.value = null
})

watch(selectedBrandId, () => {
  newDeviceId.value = null
})

watch(showAddModal, async (isOpen) => {
  if (isOpen) {
    selectedDeviceTypeId.value = null
    selectedBrandId.value = null
    newDeviceId.value = null
    newQuantity.value = 1

    // ✅ Загружаем справочники только при открытии модалки (ленивая загрузка)
    if (deviceTypes.value.length === 0) {
      await loadDeviceTypes()
    }
    if (brands.value.length === 0) {
      await loadBrands()
    }
    if (allDevices.value.length === 0) {
      await loadAllDevices()
    }
  }
})

const availableBrandsForAdd = computed(() => {
  if (!selectedDeviceTypeId.value) return []
  const addedIds = new Set(assemblyDevices.value.map((ad) => ad.deviceId))

  const devicesOfSelectedType = allDevices.value.filter((d) => {
    const devTypeId = d.deviceTypeId ?? d.DeviceTypeId
    const devId = d.id ?? d.Id
    return devTypeId === selectedDeviceTypeId.value && !addedIds.has(devId)
  })

  const uniqueBrandIds = new Set(
    devicesOfSelectedType.map((d) => d.brandId ?? d.BrandId).filter((id) => id != null),
  )

  return brands.value
    .filter((b) => uniqueBrandIds.has(b.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})

const availableDevicesForAdd = computed(() => {
  if (!selectedDeviceTypeId.value || !selectedBrandId.value) return []
  const addedIds = new Set(assemblyDevices.value.map((ad) => ad.deviceId))

  return allDevices.value.filter((d) => {
    const devTypeId = d.deviceTypeId ?? d.DeviceTypeId
    const devBrandId = d.brandId ?? d.BrandId
    const devId = d.id ?? d.Id
    return (
      devTypeId === selectedDeviceTypeId.value &&
      devBrandId === selectedBrandId.value &&
      !addedIds.has(devId)
    )
  })
})

const addDeviceToAssembly = async () => {
  if (!selectedDeviceTypeId.value) {
    toast.error('Выберите тип устройства')
    return
  }
  if (!selectedBrandId.value) {
    toast.error('Выберите бренд')
    return
  }
  if (!newDeviceId.value) {
    toast.error('Выберите устройство из списка')
    return
  }
  if (newQuantity.value < 1 || newQuantity.value > 200) {
    toast.error('Количество должно быть от 1 до 200')
    return
  }

  try {
    await projectsApi.addDeviceToAssembly({
      assemblyId: Number(route.params.assemblyId),
      deviceId: Number(newDeviceId.value),
      quantity: Number(newQuantity.value),
    })
    toast.success('Устройство успешно добавлено в сборку')
    showAddModal.value = false
    await loadAssemblyDevices()
  } catch (error) {
    console.error('Ошибка добавления устройства:', error)
    toast.error('Не удалось добавить устройство')
  }
}

// ===================== УДАЛЕНИЕ УСТРОЙСТВА =====================
const removeDevice = async (assemblyDeviceId, device) => {
  if (
    !confirm(
      `Удалить "${device.deviceType + ' ' + device.brand + ' ' + device.article || 'устройство'}" из этой сборки?`,
    )
  )
    return
  try {
    await projectsApi.removeDeviceFromAssembly(assemblyDeviceId)
    toast.success('Устройство удалено из сборки')
    await loadAssemblyDevices()
  } catch (error) {
    console.error('Ошибка удаления устройства:', error)
    toast.error('Не удалось удалить устройство')
  }
}

// ===================== МОДАЛКА ПРОСМОТРА СВОЙСТВ =====================
const showPropertiesModal = ref(false)
const currentDevice = ref(null)
const deviceProperties = ref([])

const openProperties = async (device) => {
  currentDevice.value = device
  // ✅ Свойства уже загружены благодаря новому эндпоинту!
  deviceProperties.value = device.properties.map((v) => ({
    name: v.name,
    value: v.value ?? '—',
    unit: v.unit || '',
  }))
  showPropertiesModal.value = true
}

onMounted(async () => {
  await loadProject()
  await loadAssembly()
  await loadAssemblyDevices()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <main class="devices-page">
      <header class="devices__header">
        <div class="devices__heading">
          <div class="devices__breadcrumb admin-headbar__info">
            <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
            <span class="admin-headbar__separator">/</span>
            <span class="admin-headbar__assembly">{{ assembly?.codeName || 'Сборка' }}</span>
            <span class="admin-headbar__separator">/</span>
            <span>Устройства</span>
          </div>

          <div class="devices__title-row">
            <span class="devices__title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <rect x="6" y="6" width="12" height="12" rx="2" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
                <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
              </svg>
            </span>
            <div>
              <div class="devices__title-line">
                <h1 class="devices__title">Устройства</h1>
                <span v-if="!loadingDevices" class="devices__count-badge">
                  {{ assemblyDevices.length }}
                </span>
              </div>
              <p class="devices__subtitle">
                Комплектующие сборки «{{ assembly?.codeName || '—' }}»
              </p>
            </div>
          </div>
        </div>

        <div class="devices__header-actions">
          <AButton v-if="sortedDevices.length" class="devices__summary" @click="openSummary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Z" />
              <path d="M9 8h6M9 12h4" />
            </svg>
            <span>Сводка</span>
          </AButton>

          <a-button v-if="authStore.isAdmin" class="devices__add" @click="showAddModal = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Добавить устройство</span>
          </a-button>
        </div>
      </header>

      <section
        v-if="!loadingDevices && (assemblyDevices.length > 0 || searchBar.trim())"
        class="devices__toolbar"
        aria-label="Поиск устройств"
      >
        <label class="devices__search">
          <span>Поиск</span>
          <div class="devices__search-control">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <AInput v-model="searchBar" placeholder="По артикулу, описанию, бренду или типу..." />
          </div>
        </label>

        <div class="devices__toolbar-actions">
          <span class="devices__result-count">
            {{
              searchBar.trim()
                ? `Найдено: ${filteredDevices.length}`
                : `Всего: ${assemblyDevices.length}`
            }}
          </span>
          <button v-if="searchBar.trim()" class="devices__reset" @click="searchBar = ''">
            Сбросить
          </button>
        </div>
      </section>

      <div
        v-if="loadingDevices"
        class="devices__table-card devices-loading"
        aria-label="Загрузка устройств"
      >
        <div v-for="item in 7" :key="item" class="devices-loading__row">
          <div class="devices-loading__number skeleton-shimmer"></div>
          <div v-for="cell in 5" :key="cell" class="devices-loading__cell skeleton-shimmer"></div>
          <div class="devices-loading__actions skeleton-shimmer"></div>
        </div>
      </div>

      <div v-else-if="sortedDevices.length === 0" class="devices__state">
        <div class="devices__state-icon" aria-hidden="true">
          <svg
            v-if="searchBar.trim()"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4M8.5 11h5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="6" y="6" width="12" height="12" rx="2" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
          </svg>
        </div>
        <template v-if="searchBar.trim()">
          <h2>Устройства не найдены</h2>
          <p>По запросу «{{ searchBar }}» ничего не найдено.</p>
          <AButton class="devices__state-action" @click="searchBar = ''">Сбросить поиск</AButton>
        </template>
        <template v-else>
          <h2>В этой сборке пока нет устройств</h2>
          <p>Добавьте комплектующие, чтобы сформировать состав сборки.</p>
        </template>
      </div>

      <div v-else class="devices__table-card">
        <div class="devices-table-wrap">
          <table class="devices-table">
            <thead>
              <tr>
                <th class="devices-table__number">
                  <button
                    class="devices-table__sort devices-table__sort--number"
                    title="Сортировать по порядку добавления"
                    @click="toggleSort('id')"
                  >
                    <span>№</span>
                    <span class="devices-table__arrow">{{ sortArrow('id') }}</span>
                  </button>
                </th>
                <th v-for="column in columns" :key="column.key">
                  <button
                    class="devices-table__sort"
                    :class="{ 'devices-table__sort--active': sortKey === column.key }"
                    :title="`Сортировать по: ${column.label}`"
                    @click="toggleSort(column.key)"
                  >
                    <span>{{ column.label }}</span>
                    <span class="devices-table__arrow">{{ sortArrow(column.key) }}</span>
                  </button>
                </th>
                <th class="devices-table__actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="device in sortedDevices"
                :key="device.id"
                tabindex="0"
                @click="openProperties(device)"
                @keydown.enter.self="openProperties(device)"
                @keydown.space.self.prevent="openProperties(device)"
              >
                <td class="devices-table__number">
                  <span class="devices-table__num">{{ numsById.get(device.id) }}</span>
                </td>
                <td class="devices-table__article">{{ device.article }}</td>
                <td class="devices-table__description" :title="device.description">
                  {{ device.description }}
                </td>
                <td>
                  <span class="devices-table__badge">{{ device.brand }}</span>
                </td>
                <td>
                  <span class="devices-table__badge devices-table__badge--type">
                    {{ device.deviceType }}
                  </span>
                </td>
                <td class="devices-table__quantity">
                  <div class="qty-control" @click.stop>
                    <button
                      v-if="authStore.isAdmin"
                      class="qty-btn"
                      :disabled="device.quantity <= 1 || isUpdatingQty"
                      @click="changeQuantity(device.id, device.quantity, -1)"
                      title="Уменьшить количество"
                      aria-label="Уменьшить количество"
                    >
                      −
                    </button>
                    <span
                      v-if="editingQtyId !== device.id"
                      class="qty-value"
                      :class="{ 'qty-value--editable': authStore.isAdmin }"
                      :title="authStore.isAdmin ? 'Нажмите, чтобы ввести количество' : ''"
                      @click="startQtyEdit(device)"
                    >
                      {{ device.quantity }}
                    </span>
                    <input
                      v-else
                      ref="qtyInput"
                      class="qty-value qty-input"
                      type="number"
                      min="1"
                      max="200"
                      step="1"
                      aria-label="Количество"
                      v-model="editingQtyValue"
                      @keyup.enter="finishQtyEdit(device, true)"
                      @keyup.esc="editingQtyId = null"
                      @focusout="finishQtyEdit(device, false)"
                    />
                    <button
                      v-if="authStore.isAdmin"
                      class="qty-btn"
                      :disabled="device.quantity >= 200 || isUpdatingQty"
                      @click="changeQuantity(device.id, device.quantity, 1)"
                      title="Увеличить количество"
                      aria-label="Увеличить количество"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td class="devices-table__actions">
                  <div class="devices-table__action-buttons" @click.stop>
                    <button
                      class="devices-table__action"
                      title="Свойства устройства"
                      aria-label="Свойства устройства"
                      @click="openProperties(device)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M4 5h16M4 12h16M4 19h16" />
                        <circle cx="9" cy="5" r="2" fill="#fff" />
                        <circle cx="15" cy="12" r="2" fill="#fff" />
                        <circle cx="11" cy="19" r="2" fill="#fff" />
                      </svg>
                    </button>
                    <button
                      v-if="authStore.isAdmin"
                      class="devices-table__action devices-table__action--delete"
                      title="Удалить из сборки"
                      aria-label="Удалить из сборки"
                      @click="removeDevice(device.id, device)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <AModal
      title="Добавить устройство в сборку"
      :opened="showAddModal"
      class="add-device-modal"
      @close-emit="showAddModal = false"
    >
      <div class="add-form">
        <div class="add-form__intro">
          <h3>Новое устройство</h3>
          <p>Выберите устройство из справочника и укажите количество для сборки.</p>
        </div>

        <div class="add-form__grid">
          <div class="add-form__group">
            <label for="device-type">Тип устройства *</label>
            <select id="device-type" v-model="selectedDeviceTypeId" class="form-select">
              <option :value="null" disabled>Выберите тип устройства...</option>
              <option v-for="type in deviceTypes" :key="type.id" :value="type.id">
                {{ type.name }}
              </option>
            </select>
            <p v-if="deviceTypes.length === 0" class="add-form__hint">
              Справочник типов устройств пуст
            </p>
          </div>

          <div class="add-form__group">
            <label for="device-brand">Бренд *</label>
            <select
              id="device-brand"
              v-model="selectedBrandId"
              class="form-select"
              :disabled="!selectedDeviceTypeId"
            >
              <option :value="null" disabled>
                {{ selectedDeviceTypeId ? 'Выберите бренд...' : 'Сначала выберите тип устройства' }}
              </option>
              <option v-for="brand in availableBrandsForAdd" :key="brand.id" :value="brand.id">
                {{ brand.name }}
              </option>
            </select>
            <p
              v-if="selectedDeviceTypeId && availableBrandsForAdd.length === 0"
              class="add-form__hint"
            >
              Нет доступных брендов: возможно, все устройства уже добавлены.
            </p>
          </div>

          <div class="add-form__group add-form__group--wide">
            <label for="new-device">Устройство *</label>
            <select
              id="new-device"
              v-model="newDeviceId"
              class="form-select"
              :disabled="!selectedDeviceTypeId || !selectedBrandId"
            >
              <option :value="null" disabled>
                {{
                  selectedDeviceTypeId && selectedBrandId
                    ? 'Выберите устройство...'
                    : 'Сначала выберите тип и бренд'
                }}
              </option>
              <option
                v-for="device in availableDevicesForAdd"
                :key="device.id ?? device.Id"
                :value="device.id ?? device.Id"
              >
                {{ device.article || device.Article || 'ID ' + (device.id ?? device.Id) }}
                {{
                  device.description || device.Description
                    ? '— ' + (device.description || device.Description)
                    : ''
                }}
              </option>
            </select>
            <p
              v-if="selectedDeviceTypeId && selectedBrandId && availableDevicesForAdd.length === 0"
              class="add-form__hint"
            >
              Для этого типа и бренда нет доступных устройств.
            </p>
          </div>

          <div class="add-form__group">
            <label for="new-qty">Количество (1–200) *</label>
            <input
              id="new-qty"
              type="number"
              v-model.number="newQuantity"
              min="1"
              max="200"
              class="form-input"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="devices-modal__actions">
          <button class="modal-cancel" @click="showAddModal = false">Отмена</button>
          <AButton
            class="devices-modal__submit"
            :disabled="
              !selectedDeviceTypeId ||
              !selectedBrandId ||
              !newDeviceId ||
              newQuantity < 1 ||
              newQuantity > 200
            "
            @click="addDeviceToAssembly"
          >
            Добавить
          </AButton>
        </div>
      </template>
    </AModal>

    <AModal
      :title="
        currentDevice
          ? `Свойства: ${
              currentDevice.article !== '—'
                ? currentDevice.article
                : 'Устройство ' + currentDevice.deviceId
            }`
          : 'Свойства устройства'
      "
      :opened="showPropertiesModal"
      class="properties-modal"
      @close-emit="showPropertiesModal = false"
    >
      <div v-if="currentDevice" class="properties-device">
        <span class="properties-device__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="6" y="6" width="12" height="12" rx="2" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
          </svg>
        </span>
        <div class="properties-device__info">
          <h3>{{ currentDevice.article }}</h3>
          <p>{{ currentDevice.deviceType }} · {{ currentDevice.brand }}</p>
        </div>
        <span class="properties-device__quantity">{{ currentDevice.quantity }} шт.</span>
      </div>

      <div v-if="deviceProperties.length === 0" class="properties-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 5h16M4 12h16M4 19h16" />
          <circle cx="9" cy="5" r="2" fill="#fff" />
          <circle cx="15" cy="12" r="2" fill="#fff" />
          <circle cx="11" cy="19" r="2" fill="#fff" />
        </svg>
        <p>Для этого устройства не заданы свойства</p>
      </div>
      <div v-else class="properties-view">
        <div v-for="(property, index) in deviceProperties" :key="index" class="properties-row">
          <span class="properties-row__label">
            {{ property.name }}
            <span v-if="property.unit" class="properties-row__unit">, {{ property.unit }}</span>
          </span>
          <span class="properties-row__value">{{ property.value }}</span>
        </div>
      </div>

      <template #footer>
        <div class="devices-modal__actions">
          <button class="modal-cancel" @click="showPropertiesModal = false">Закрыть</button>
        </div>
      </template>
    </AModal>

    <AModal
      sticky
      :title="`Сводка по устройствам ${assembly?.codeName || ''}`"
      :opened="showSummaryModal"
      class="summary-modal"
      @close-emit="showSummaryModal = false"
    >
      <div v-if="summaryReport" class="summary-view">
        <table class="summary-table">
          <thead>
            <tr>
              <th class="summary-table__number">№</th>
              <th>Тип устройства</th>
              <th>Бренд</th>
              <th>Артикул</th>
              <th>Описание</th>
              <th>Количество</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryReport.rows" :key="row.num">
              <td class="summary-table__number">{{ row.num }}</td>
              <td>{{ row.deviceType }}</td>
              <td>{{ row.brand }}</td>
              <td class="summary-table__article">{{ row.article }}</td>
              <td class="summary-table__description">{{ row.description }}</td>
              <td>{{ row.quantity }} шт.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <div class="devices-modal__actions devices-modal__actions--summary">
          <div class="summary-options">
            <label class="summary-format">
              <span>Формат</span>
              <select
                v-model="exportFormat"
                class="form-select summary-format__select"
                :disabled="exportingSummary"
              >
                <option value="txt">TXT</option>
                <option value="xlsx">XLSX</option>
              </select>
            </label>
            <label class="summary-upload">
              <input type="checkbox" v-model="uploadReportToProject" :disabled="exportingSummary" />
              <span>Загрузить в файлы проекта</span>
            </label>
          </div>
          <div class="summary-buttons">
            <button class="modal-cancel" @click="showSummaryModal = false">Закрыть</button>
            <AButton
              class="summary-export"
              :disabled="exportingSummary"
              @click="exportDevicesSummary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              <span>{{ exportingSummary ? 'Формирование…' : 'Экспорт' }}</span>
            </AButton>
          </div>
        </div>
      </template>
    </AModal>
  </div>
</template>

<style scoped>
.global-container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}

.devices-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
}

.devices__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: linear-gradient(135deg, #fff 0%, #fff 62%, #f5f3ff 100%);
  box-shadow: 4px 4px 24px -14px rgba(34, 60, 80, 0.28);
}

.devices__heading {
  min-width: 0;
}

.devices__breadcrumb {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-bottom: 14px;
  overflow: hidden;
  color: #8a8f98;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.devices__breadcrumb > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-headbar__project {
  flex: 0 1 auto;
  color: #4b5563;
  font-weight: 600;
}

.admin-headbar__assembly {
  flex: 0 1 auto;
  color: #6b7280;
}

.admin-headbar__separator {
  flex: 0 0 auto;
  margin: 0 8px;
  color: #cbd5e0;
}

.devices__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.devices__title-icon {
  display: grid;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f46e5;
}

.devices__title-icon svg {
  width: 23px;
  height: 23px;
}

.devices__title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.devices__title {
  margin: 0;
  color: #2d3748;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.2;
}

.devices__count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.devices__subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.45;
}

.devices__header-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.devices__summary.btn,
.devices__add.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.devices__summary svg,
.devices__add svg {
  width: 18px;
  height: 18px;
}

.devices__toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
}

.devices__search {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  margin: 0;
  color: #8a8f98;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.devices__search-control {
  position: relative;
}

.devices__search-control > svg {
  position: absolute;
  top: 50%;
  left: 11px;
  z-index: 1;
  width: 16px;
  height: 16px;
  color: #9298a1;
  pointer-events: none;
  transform: translateY(-50%);
}

.devices__search-control :deep(.input) {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px 8px 34px;
  border-color: #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: normal;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.devices__search-control :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.devices__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.devices__result-count {
  margin-right: auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.devices__reset {
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6366f1;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.devices__reset:hover {
  background: #eef2ff;
}

.devices__table-card {
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
}

.devices-loading {
  overflow-x: auto;
}

.devices-loading__row {
  display: grid;
  grid-template-columns: 48px repeat(5, minmax(90px, 1fr)) 90px;
  align-items: center;
  gap: 20px;
  min-width: 1000px;
  height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid #eff1f4;
}

.devices-loading__row:last-child {
  border-bottom: 0;
}

.devices-loading__number,
.devices-loading__cell,
.devices-loading__actions {
  height: 10px;
  border-radius: 999px;
  background: #eef0f3;
}

.devices-loading__number {
  width: 28px;
}

.devices-loading__cell:nth-child(3n) {
  width: 72%;
}

.devices-loading__cell:nth-child(3n + 1) {
  width: 84%;
}

.devices-loading__actions {
  width: 64px;
}

.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    rgba(255, 255, 255, 0.75) 50%,
    transparent 80%
  );
  content: '';
  transform: translateX(-100%);
  animation: devices-skeleton-slide 1.4s infinite;
}

@keyframes devices-skeleton-slide {
  to {
    transform: translateX(100%);
  }
}

.devices__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 36px 18px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
  text-align: center;
}

.devices__state-icon {
  display: grid;
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 18px;
  background: #eef2ff;
  color: #6366f1;
}

.devices__state-icon svg {
  width: 30px;
  height: 30px;
}

.devices__state h2 {
  margin: 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.devices__state p {
  max-width: 460px;
  margin: 8px 0 0;
  color: #8a8f98;
  font-size: 14px;
  line-height: 1.55;
}

.devices__state-action.btn {
  min-height: 38px;
  margin-top: 20px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
}

.devices-table-wrap {
  overflow-x: auto;
}

.devices-table {
  width: 100%;
  min-width: 1050px;
  border-collapse: separate;
  border-spacing: 0;
  color: #4b5563;
  font-size: 13px;
}

.devices-table th {
  padding: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafc;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.devices-table td {
  height: 56px;
  padding: 10px 12px;
  border-bottom: 1px solid #eff1f4;
  vertical-align: middle;
}

.devices-table tbody tr:last-child td {
  border-bottom: 0;
}

.devices-table tbody tr {
  cursor: pointer;
  outline: none;
  transition: background 0.16s ease;
}

.devices-table tbody tr:hover,
.devices-table tbody tr:focus-visible {
  background: #fafaff;
}

.devices-table tbody tr:focus-visible td:first-child {
  box-shadow: inset 3px 0 #6366f1;
}

.devices-table__sort {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 42px;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
}

.devices-table__sort:hover,
.devices-table__sort--active {
  color: #4f46e5;
}

.devices-table__arrow {
  color: #a5aab4;
  font-size: 13px;
  line-height: 1;
}

.devices-table__sort:hover .devices-table__arrow,
.devices-table__sort--active .devices-table__arrow {
  color: #6366f1;
}

.devices-table__number {
  width: 56px;
  padding-left: 16px !important;
  text-align: center !important;
}

.devices-table__sort--number {
  justify-content: center;
}

.devices-table__num {
  display: inline-grid;
  min-width: 28px;
  height: 26px;
  place-items: center;
  padding: 0 7px;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.devices-table__article {
  min-width: 120px;
  color: #374151;
  font-weight: 600;
  white-space: nowrap;
}

.devices-table__description {
  min-width: 170px;
  max-width: 260px;
  overflow: hidden;
  color: #8a8f98;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.devices-table__badge {
  display: inline-flex;
  align-items: center;
  max-width: 150px;
  min-height: 26px;
  padding: 4px 9px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.devices-table__badge--type {
  border-color: #e0e7ff;
  background: #eef2ff;
  color: #4f46e5;
}

.devices-table__quantity {
  white-space: nowrap;
}

.qty-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
}

.qty-btn {
  display: inline-grid;
  width: 26px;
  height: 26px;
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
    border-color 0.16s,
    background 0.16s,
    color 0.16s;
}

.qty-btn:hover:not(:disabled) {
  border-color: #c7d2fe;
  background: #eef2ff;
}

.qty-btn:disabled {
  border-color: #eff1f4;
  background: #f9fafb;
  color: #cbd5e0;
  cursor: not-allowed;
}

.qty-value {
  min-width: 34px;
  padding: 2px 4px;
  border-radius: 5px;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.qty-value--editable {
  cursor: pointer;
}

@media (hover: hover) {
  .qty-value--editable:hover {
    background: #eef2ff;
    color: #4f46e5;
  }
}

.qty-input {
  width: 54px;
  min-height: 26px;
  padding: 2px 4px;
  border: 1px solid #6366f1;
  border-radius: 5px;
  outline: none;
  background: #fff;
  color: #374151;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  -moz-appearance: textfield;
  appearance: textfield;
}

.qty-input::-webkit-inner-spin-button,
.qty-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.devices-table__actions {
  width: 104px;
  padding-right: 16px !important;
  text-align: right !important;
  white-space: nowrap;
}

.devices-table__action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.devices-table__action {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition:
    border-color 0.16s,
    background 0.16s,
    color 0.16s;
}

.devices-table__action svg {
  width: 15px;
  height: 15px;
}

.devices-table__action:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}

.devices-table__action--delete:hover {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.add-form__intro h3 {
  margin: 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.add-form__intro p {
  margin: 6px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.5;
}

.add-form__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.add-form__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.add-form__group label {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.add-form__hint {
  margin: 0;
  color: #8a8f98;
  font-size: 12px;
  line-height: 1.45;
}

.form-select,
.form-input {
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  background: #fff;
  color: #4b5563;
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  box-sizing: border-box;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-select {
  padding-right: 34px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 10px center;
  background-repeat: no-repeat;
  cursor: pointer;
}

.form-select:disabled,
.form-input:disabled {
  border-color: #eef1f4;
  background-color: #f8fafc;
  color: #a0aec0;
  cursor: not-allowed;
}

.form-select:focus,
.form-input:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.devices-modal__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.modal-cancel,
.devices-modal__actions .btn {
  min-height: 38px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.modal-cancel {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font: inherit;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}

.modal-cancel:hover:not(:disabled) {
  border-color: #cbd5e0;
  background: #f9fafb;
  color: #374151;
}

.devices-modal__submit.btn,
.summary-export.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.summary-export svg {
  width: 17px;
  height: 17px;
}

.properties-device {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
}

.properties-device__icon {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 10px;
  background: #eef2ff;
  color: #4f46e5;
}

.properties-device__icon svg {
  width: 21px;
  height: 21px;
}

.properties-device__info {
  min-width: 0;
}

.properties-device__info h3 {
  margin: 0;
  overflow: hidden;
  color: #374151;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.properties-device__info p {
  margin: 4px 0 0;
  color: #8a8f98;
  font-size: 12px;
  line-height: 1.4;
}

.properties-device__quantity {
  flex: 0 0 auto;
  margin-left: auto;
  padding: 5px 9px;
  border: 1px solid #e0e7ff;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.properties-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 24px;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
  background: #fafafa;
  color: #8a8f98;
  text-align: center;
}

.properties-empty svg {
  width: 30px;
  height: 30px;
  margin-bottom: 12px;
  color: #a5aab4;
}

.properties-empty p {
  margin: 0;
  font-size: 14px;
}

.properties-view {
  display: grid;
  gap: 0;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.properties-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 0.7fr);
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #eff1f4;
  background: #fff;
}

.properties-row:last-child {
  border-bottom: 0;
}

.properties-row:nth-child(even) {
  background: #fafafa;
}

.properties-row__label {
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
}

.properties-row__unit {
  color: #a0aec0;
  font-weight: 400;
}

.properties-row__value {
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}

.summary-view {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.summary-table {
  width: 100%;
  min-width: 720px;
  border-collapse: separate;
  border-spacing: 0;
  color: #4b5563;
  font-size: 13px;
}

.summary-table th {
  padding: 11px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafc;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.summary-table td {
  padding: 11px 12px;
  border-bottom: 1px solid #eff1f4;
  vertical-align: middle;
}

.summary-table tbody tr:last-child td {
  border-bottom: 0;
}

.summary-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.summary-table__number {
  width: 48px;
  color: #8a8f98;
  font-variant-numeric: tabular-nums;
  text-align: center !important;
  white-space: nowrap;
}

.summary-table__article {
  color: #374151;
  font-weight: 600;
  white-space: nowrap;
}

.summary-table__description {
  max-width: 220px;
  overflow: hidden;
  color: #8a8f98;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.devices-modal__actions--summary {
  justify-content: space-between;
  gap: 16px;
}

.summary-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.summary-format {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
}

.summary-format__select {
  width: 88px;
  min-height: 38px;
  padding-block: 7px;
}

.summary-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.summary-upload input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #6366f1;
  cursor: pointer;
}

.summary-buttons {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

@media (min-width: 640px) {
  .devices__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
  }

  .devices__header-actions {
    flex: 0 0 auto;
    flex-direction: row;
  }

  .devices__summary.btn,
  .devices__add.btn {
    width: auto;
  }

  .devices__toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
  }

  .devices__search {
    width: min(100%, 560px);
  }

  .devices__toolbar-actions {
    flex: 0 0 auto;
  }

  .devices__result-count {
    margin-right: 0;
  }

  .add-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .add-form__group--wide {
    grid-column: 1 / -1;
  }
}

@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .devices-page {
    gap: 20px;
  }

  .devices__header {
    padding: 24px;
  }

  .devices__breadcrumb {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .devices__title-icon {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .devices__title {
    font-size: 26px;
  }

  .devices__subtitle {
    font-size: 14px;
  }

  .devices__summary.btn,
  .devices__add.btn {
    min-height: 42px;
    padding: 10px 16px;
    font-size: 15px;
  }

  .devices__toolbar {
    padding: 14px 16px;
  }

  .devices__search-control :deep(.input) {
    padding-inline: 36px 12px;
    font-size: 14px;
  }

  .devices__state {
    min-height: 380px;
    padding: 48px 24px;
  }
}

@media (max-width: 760px) {
  .devices-modal__actions--summary {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-buttons {
    justify-content: flex-end;
  }
}

@media (max-width: 600px) {
  .devices-modal__actions,
  .summary-buttons {
    flex-direction: column-reverse;
  }

  .modal-cancel,
  .devices-modal__actions .btn {
    width: 100%;
  }

  .properties-device {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .properties-device__quantity {
    margin-left: 52px;
  }

  .properties-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .properties-row__value {
    text-align: left;
  }

  .summary-options {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .summary-format {
    justify-content: space-between;
  }

  .devices-table-wrap {
    scrollbar-width: thin;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .global-container {
    padding: max(8px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
      max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  }

  .devices-page {
    gap: 10px;
  }

  .devices__header {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }

  .devices__breadcrumb {
    margin-bottom: 4px;
  }

  .devices__title-icon {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .devices__title {
    font-size: 20px;
  }

  .devices__subtitle {
    display: none;
  }

  .devices__header-actions {
    flex: 0 0 auto;
    flex-direction: row;
  }

  .devices__toolbar {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
  }

  .devices__search {
    flex: 1;
    min-width: 0;
  }

  .devices__search-control :deep(.input) {
    min-height: 38px;
  }

  .devices__state {
    min-height: 0;
    padding: 24px 16px;
  }

  .devices-table-wrap,
  .summary-view {
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .add-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .devices-modal__actions,
  .summary-buttons,
  .summary-options {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  .devices-modal__actions .btn,
  .modal-cancel {
    width: auto;
  }

  .properties-row {
    grid-template-columns: minmax(120px, 0.7fr) minmax(0, 1.3fr);
  }

  .properties-row__value {
    text-align: right;
  }
}

@media (prefers-reduced-motion: reduce) {
  .devices-table tbody tr,
  .devices__reset,
  .devices-table__action,
  .qty-btn,
  .modal-cancel {
    transition: none;
  }

  .skeleton-shimmer::after {
    animation: none;
  }
}
</style>

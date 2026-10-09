<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, computed, onMounted, watch } from 'vue'
import Ainput from '@/components/A-input.vue'
import AModal from '@/components/A-modal.vue'
import Abutton from '@/components/A-button.vue'
import { projectsApi } from '@/api/projects'
import { devicesApi } from '@/api/devices'
import { referenceApi } from '@/api/reference'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { useToast } from '@/composables/useToast'
import { downloadTxt, formatFileNameStamp, reportHeader, safeFileNamePart } from '@/utils/txtReport'

const route = useRoute()
const router = useRouter()
const toast = useToast()

defineProps(['projectId', 'assemblyId'])

const project = ref(null)
const assembly = ref(null)

const assemblyDevices = ref([])
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
  try {
    // ✅ Используем новый эндпоинт, который сразу возвращает все детали
    const rawDevices = await projectsApi.getAssemblyDevicesWithDetails(route.params.assemblyId)
    console.log(rawDevices)

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

// ===================== СВОДКА И ЭКСПОРТ В TXT =====================
// Таблица сводки и текст отчёта строятся из одного снимка, поэтому строки
// и их номера на экране и в файле не разъезжаются. Снимок делаем при открытии
const showSummaryModal = ref(false)
const summaryReport = ref(null)

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
  showSummaryModal.value = true
}

const exportDevicesToTxt = () => {
  downloadTxt(summaryReport.value.fileName, summaryReport.value.lines)
  toast.success('Скачивание файла')
}

// ===================== УПРАВЛЕНИЕ КОЛИЧЕСТВОМ =====================
const changeQuantity = async (assemblyDeviceId, currentQty, delta) => {
  const newQty = currentQty + delta
  if (newQty < 1 || newQty > 200) return

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
const removeDevice = async (assemblyDeviceId, article) => {
  if (!confirm(`Удалить "${article || 'устройство'}" из этой сборки?`)) return
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
    <!-- === ХЕДЕР В СТИЛЕ ГАЛЕРЕИ (с оригинальными цветами) === -->
    <div class="gallery__header assembly-header">
      <div class="assembly-header__info">
        <div class="admin-headbar__info">
          <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
          <span class="admin-headbar__separator">/</span>
          <span class="admin-headbar__assembly">{{ assembly?.codeName || 'Сборка' }}</span>
        </div>
        <div class="admin-headbar__search">
          <Ainput
            class="admin-headbar__search-input"
            v-model="searchBar"
            placeholder="Поиск по артикулу, описанию..."
          />
        </div>
      </div>

      <div class="assembly-header__actions">
        <Abutton v-if="sortedDevices.length" @click="openSummary" class="summary-btn">
          📊 Сводка
        </Abutton>
        <Abutton v-if="authStore.isAdmin" @click="showAddModal = true" class="add-device-btn">
          + Добавить
        </Abutton>
      </div>
    </div>

    <!-- === ТАБЛИЦА === -->
    <div class="admin-card admin-table-wrap">
      <div v-if="sortedDevices.length === 0" class="admin-empty">
        {{
          searchBar
            ? `По запросу «${searchBar}» ничего не найдено`
            : 'В этой сборке пока нет устройств. Нажмите "Добавить устройство"'
        }}
      </div>

      <table v-else class="admin-table">
        <thead>
          <tr>
            <th
              class="admin-table__th admin-table__th--num admin-table__th--sortable"
              :class="{ 'admin-table__th--sorted': sortKey === 'id' }"
              @click="toggleSort('id')"
              title="Сортировать по порядку добавления"
            >
              <span class="admin-table__th-inner">
                <span class="admin-table__th-text">№</span>
                <span
                  class="admin-table__th-arrow"
                  :class="{ 'admin-table__th-arrow--active': sortKey === 'id' }"
                >
                  {{ sortArrow('id') }}
                </span>
              </span>
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              class="admin-table__th admin-table__th--sortable"
              :class="{ 'admin-table__th--sorted': sortKey === col.key }"
              @click="toggleSort(col.key)"
              :title="`Сортировать по: ${col.label}`"
            >
              <span class="admin-table__th-inner">
                <span class="admin-table__th-text">{{ col.label }}</span>
                <span
                  class="admin-table__th-arrow"
                  :class="{ 'admin-table__th-arrow--active': sortKey === col.key }"
                >
                  {{ sortArrow(col.key) }}
                </span>
              </span>
            </th>
            <th class="admin-table__th admin-table__th--actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="device in sortedDevices" :key="device.id" class="admin-table__row">
            <td class="admin-table__td admin-table__td--num">{{ numsById.get(device.id) }}</td>
            <td class="admin-table__td">{{ device.article }}</td>
            <td class="admin-table__td">{{ device.description }}</td>
            <td class="admin-table__td">{{ device.brand }}</td>
            <td class="admin-table__td">{{ device.deviceType }}</td>

            <td class="admin-table__td admin-table__td--quantity">
              <div class="qty-control">
                <button
                  v-if="authStore.isAdmin"
                  class="qty-btn"
                  :disabled="device.quantity <= 1 || isUpdatingQty"
                  @click="changeQuantity(device.id, device.quantity, -1)"
                  title="Уменьшить"
                >
                  −
                </button>
                <span class="qty-value">{{ device.quantity }}</span>
                <button
                  v-if="authStore.isAdmin"
                  class="qty-btn"
                  :disabled="device.quantity >= 200 || isUpdatingQty"
                  @click="changeQuantity(device.id, device.quantity, 1)"
                  title="Увеличить"
                >
                  +
                </button>
              </div>
            </td>

            <td class="admin-table__td admin-table__td--actions">
              <button
                class="admin-table__btn"
                @click="openProperties(device)"
                title="Просмотр свойств"
              >
                Свойства
              </button>
              <button
                v-if="authStore.isAdmin"
                class="admin-table__btn admin-table__btn--del"
                @click="removeDevice(device.id, device.article)"
                title="Удалить из сборки"
              >
                Удалить
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===================== МОДАЛКА: ДОБАВЛЕНИЕ УСТРОЙСТВА ===================== -->
    <AModal
      @close-emit="showAddModal = false"
      title="Добавить устройство в сборку"
      :opened="showAddModal"
    >
      <div class="add-form">
        <div class="add-form__group">
          <label for="device-type">1. Тип устройства *</label>
          <select id="device-type" v-model="selectedDeviceTypeId" class="admin-select">
            <option :value="null" disabled>Выберите тип устройства...</option>
            <option v-for="t in deviceTypes" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
          <p v-if="deviceTypes.length === 0" class="add-form__hint">
            Справочник типов устройств пуст
          </p>
        </div>

        <div class="add-form__group">
          <label for="device-brand">2. Бренд *</label>
          <select
            id="device-brand"
            v-model="selectedBrandId"
            class="admin-select"
            :disabled="!selectedDeviceTypeId"
          >
            <option :value="null" disabled>
              {{ selectedDeviceTypeId ? 'Выберите бренд...' : 'Сначала выберите тип устройства' }}
            </option>
            <option v-for="b in availableBrandsForAdd" :key="b.id" :value="b.id">
              {{ b.name }}
            </option>
          </select>
          <p
            v-if="selectedDeviceTypeId && availableBrandsForAdd.length === 0"
            class="add-form__hint"
          >
            Для этого типа нет доступных брендов (либо все устройства уже добавлены)
          </p>
        </div>

        <div class="add-form__group">
          <label for="new-device">3. Устройство *</label>
          <select
            id="new-device"
            v-model="newDeviceId"
            class="admin-select"
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
              v-for="dev in availableDevicesForAdd"
              :key="dev.id ?? dev.Id"
              :value="dev.id ?? dev.Id"
            >
              {{ dev.article || dev.Article || 'ID ' + (dev.id ?? dev.Id) }}
              {{
                dev.description || dev.Description
                  ? '— ' + (dev.description || dev.Description)
                  : ''
              }}
            </option>
          </select>
          <p
            v-if="selectedDeviceTypeId && selectedBrandId && availableDevicesForAdd.length === 0"
            class="add-form__hint"
          >
            Для этого типа и бренда нет устройств, либо все уже добавлены в сборку
          </p>
        </div>

        <div class="add-form__group">
          <label for="new-qty">4. Количество (1–200) *</label>
          <input
            id="new-qty"
            type="number"
            v-model.number="newQuantity"
            min="1"
            max="200"
            class="admin-input"
          />
        </div>

        <div class="admin-form__actions" style="margin-top: 24px">
          <Abutton
            @click="addDeviceToAssembly"
            :disabled="
              !selectedDeviceTypeId ||
              !selectedBrandId ||
              !newDeviceId ||
              newQuantity < 1 ||
              newQuantity > 200
            "
          >
            Добавить
          </Abutton>
          <a class="admin-form__cancel" @click="showAddModal = false">Отмена</a>
        </div>
      </div>
    </AModal>

    <!-- ===================== МОДАЛКА: ПРОСМОТР СВОЙСТВ ===================== -->
    <AModal
      @close-emit="showPropertiesModal = false"
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
    >
      <div class="properties-device-type">{{ currentDevice.deviceType }}</div>
      <div v-if="deviceProperties.length === 0" class="admin-empty">
        Для этого устройства не заданы свойства
      </div>
      <div v-else class="properties-view">
        <div v-for="(prop, idx) in deviceProperties" :key="idx" class="properties-row">
          <span class="properties-row__label">
            {{ prop.name }}
            <span v-if="prop.unit" class="properties-row__unit">, {{ prop.unit }}</span>
          </span>
          <span class="properties-row__value">{{ prop.value }}</span>
        </div>
      </div>
      <div class="admin-form__actions" style="margin-top: 24px">
        <a class="admin-form__cancel" @click="showPropertiesModal = false">Закрыть</a>
      </div>
    </AModal>

    <!-- ===================== МОДАЛКА: СВОДКА ===================== -->
    <AModal
      @close-emit="showSummaryModal = false"
      :title="`Сводка по устройствам ${assembly?.codeName || ''}`"
      :opened="showSummaryModal"
    >
      <div v-if="summaryReport" class="summary-view">
        <table class="admin-table summary-table">
          <thead>
            <tr>
              <th class="admin-table__th">Тип устройства</th>
              <th class="admin-table__th">Бренд</th>
              <th class="admin-table__th">Артикул</th>
              <th class="admin-table__th">Описание</th>
              <th class="admin-table__th">Количество</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryReport.rows" :key="row.num" class="admin-table__row">
              <td class="admin-table__td">{{ row.deviceType }}</td>
              <td class="admin-table__td">{{ row.brand }}</td>
              <td class="admin-table__td">{{ row.article }}</td>
              <td class="admin-table__td">{{ row.description }}</td>
              <td class="admin-table__td">{{ row.quantity }} шт.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="admin-form__actions" style="margin-top: 24px">
        <Abutton @click="exportDevicesToTxt" class="export-btn">⬇ Экспорт</Abutton>
        <a class="admin-form__cancel" @click="showSummaryModal = false">Закрыть</a>
      </div>
    </AModal>
  </div>
</template>

<style scoped>
.global-container {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
  max-width: 1400px;
  margin: 0 auto;
}

/* === ХЕДЕР В СТИЛЕ ГАЛЕРЕИ (с оригинальными цветами) === */
.gallery__header {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: #fff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assembly-header__info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.assembly-header__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* Оригинальные цвета текстов хедера */
.admin-headbar__info {
  font-size: 14px;
  color: #4a5568;
  font-weight: 500;
}
.admin-headbar__project {
  color: #2d3748;
  font-weight: 600;
}
.admin-headbar__separator {
  margin: 0 8px;
  color: #cbd5e0;
}
.admin-headbar__search-label {
  font-size: 13px;
  color: #4a5568;
}

/* Кнопка "Назад" в оригинальных тонах */
.admin-headbar__back-btn {
  font-size: 14px;
  color: #4a5568;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
}
.admin-headbar__back-btn:hover {
  background-color: #f7fafc;
  color: #2d3748;
}

.add-device-btn {
  white-space: nowrap;
}

/* Серая второстепенная кнопка — как в кабельном журнале */
.summary-btn,
.export-btn {
  white-space: nowrap;
  background-color: #f3f4f6 !important;
  color: #374151 !important;
  border: 1px solid #d1d5db !important;
}
.summary-btn:hover,
.export-btn:hover {
  background-color: #e5e7eb !important;
}

/* Таблица сводки — как в кабельном журнале */
.summary-view {
  overflow-x: auto;
}
.summary-table {
  min-width: 600px;
}

/* === ТАБЛИЦА (Оригинальные стили сохранены) === */
.admin-card {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: #fff;
  padding: 16px;
}

.admin-table-wrap {
  padding: 0;
  overflow: auto;
  margin-top: 16px;
}

.properties-device-type {
  font-weight: 400;
  color: #718096;
  font-size: 12px;
  margin-bottom: 16px;
}

.admin-empty {
  padding: 40px;
  text-align: center;
  color: #718096;
  font-weight: 300;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.admin-table__th {
  text-align: left;
  padding: 12px 16px;
  font-weight: 600;
  color: #4a5568;
  background-color: #f7fafc;
  border-bottom: 2px solid rgb(230, 230, 230);
  white-space: nowrap;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.admin-table__th--num {
  width: 58px;
  text-align: center;
  padding-inline: 6px;
}
.admin-table__th--actions {
  width: 140px;
  text-align: center;
}

.admin-table__th--sortable {
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.admin-table__th--sortable:hover {
  background-color: #eef2ff;
  color: #4f46e5;
}
.admin-table__th--sorted {
  color: #4f46e5;
  background-color: #f5f7ff;
}
.admin-table__th-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.admin-table__th-arrow {
  font-size: 11px;
  line-height: 1;
  color: #cbd5e0;
  transition: color 0.15s;
}
.admin-table__th--sortable:hover .admin-table__th-arrow {
  color: #a5b4fc;
}
.admin-table__th-arrow--active {
  color: #6366f1;
  font-size: 13px;
}

.admin-table__row {
  transition: background-color 0.15s;
}
.admin-table__row:hover {
  background-color: #f7fafc;
}
.admin-table__td {
  font-size: 14px;
  padding: 10px 16px;
  border-bottom: 1px solid rgb(240, 240, 240);
  color: #2d3748;
}
.admin-table__td--num {
  color: #a0aec0;
  font-size: 12px;
  text-align: center;
  padding-inline: 6px;
  font-variant-numeric: tabular-nums;
}

.admin-table__td--quantity {
  white-space: nowrap;
}
.qty-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #f7fafc;
  border-radius: 6px;
  padding: 4px 8px;
  border: 1px solid rgb(230, 230, 230);
}
.qty-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background-color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: #4f46e5;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.qty-btn:hover:not(:disabled) {
  background-color: #eef2ff;
}
.qty-btn:disabled {
  color: #cbd5e0;
  cursor: not-allowed;
  background-color: #f7fafc;
  box-shadow: none;
}
.qty-value {
  min-width: 32px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  color: #2d3748;
}

.admin-table__td--actions {
  text-align: center;
  white-space: nowrap;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.admin-table__btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 6px 10px;
  border-radius: 4px;
  transition: all 0.2s;
}
.admin-table__btn:hover {
  background-color: #edf2f7;
}
.admin-table__btn--del {
  color: #e53e3e;
}
.admin-table__btn--del:hover {
  background-color: #fed7d7;
}

/* === ФОРМЫ И МОДАЛКИ === */
.add-form {
  display: grid;
  gap: 16px;
}
.add-form__group {
  display: grid;
  gap: 6px;
}
.add-form__group label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}
.add-form__hint {
  font-size: 12px;
  color: #a0aec0;
  margin: 0;
  font-style: italic;
}
.admin-select,
.admin-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  background-color: #fff;
  font-size: 13px;
  color: #2d3748;
  transition: all 0.3s;
  box-sizing: border-box;
}
.admin-select:disabled,
.admin-input:disabled {
  background-color: #f7fafc;
  color: #a0aec0;
  cursor: not-allowed;
}
.admin-select:focus,
.admin-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.properties-view {
  display: grid;
  gap: 12px;
}
.properties-row {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgb(240, 240, 240);
}
@media (max-width: 600px) {
  .properties-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
.properties-row__label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}
.properties-row__unit {
  color: #a0aec0;
  font-weight: 400;
}
.properties-row__value {
  font-size: 13px;
  color: #2d3748;
  font-weight: 600;
  text-align: right;
}
@media (max-width: 600px) {
  .properties-row__value {
    text-align: left;
  }
}

.admin-form__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
}
.admin-form__cancel {
  font-size: 14px;
  color: #718096;
  cursor: pointer;
  text-decoration: none;
}
.admin-form__cancel:hover {
  color: #4a5568;
}

/* === ДЕСКТОПНАЯ АДАПТАЦИЯ === */
@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .gallery__header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
  }

  .assembly-header__info {
    flex-direction: row;
    align-items: center;
    gap: 24px;
    flex: 1;
  }

  .admin-headbar__search {
    flex: 1;
    max-width: 400px;
  }

  .admin-card {
    padding: 24px;
  }

  .admin-table-wrap {
    margin-top: 24px;
  }
}
</style>

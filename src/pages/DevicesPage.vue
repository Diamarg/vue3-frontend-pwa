<script setup>
import { useRoute } from 'vue-router'
import { ref, computed, onMounted } from 'vue'
import Ainput from '@/components/A-input.vue'
import AModal from '@/components/A-modal.vue'
import { projectsApi } from '@/api/projects'
import { devicesApi } from '@/api/devices'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const toast = useToast()

defineProps(['projectId', 'assemblyId'])

const project = ref(null)
const assembly = ref(null)
const allDevices = ref([])
const assemblyDeviceIDs = ref([])

const authStore = useAuthStore()
const pageStore = usePageStore()

// ===================== ПОИСК И СОРТИРОВКА =====================
const searchBar = ref('')
const sortKey = ref('id')
const sortDir = ref('asc')

const columns = [
  { key: 'article', label: 'Артикул' },
  { key: 'description', label: 'Описание' },
  { key: 'brand', label: 'Бренд' },
  { key: 'deviceType', label: 'Тип устройства' },
]

const colMap = computed(() => {
  const m = {}
  columns.forEach((c) => (m[c.key] = c))
  return m
})

const getSortValue = (item, key) => {
  if (key === 'id') return item.id
  return item[key] ?? ''
}

const isNumericSort = (key) => key === 'id'

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
    pageStore.pageInfo.name = `Устройства: ${assembly.value?.codeName || 'Сборка'}`
  } catch (error) {
    console.error('Ошибка загрузки сборки:', error)
  }
}

const loadAllDevices = async () => {
  try {
    allDevices.value = await devicesApi.getAll()
  } catch (error) {
    toast.error('Не удалось загрузить устройства')
    console.error('Не удалось загрузить устройства', error)
  }
}

const loadAssemblyDevices = async () => {
  try {
    const assemblyDevices = await projectsApi.getAssemblyDevicesByAssemblyId(
      route.params.assemblyId,
    )
    assemblyDeviceIDs.value = assemblyDevices.map((device) => device.deviceId)
  } catch (error) {
    toast.error('Не удалось загрузить устройства сборки')
    console.error('Не удалось загрузить устройства сборки', error)
  }
}

// ===================== ФИЛЬТРАЦИЯ И СОРТИРОВКА =====================
const filteredDevices = computed(() => {
  const q = searchBar.value.trim().toLowerCase()
  // Фильтруем только устройства, привязанные к этой сборке
  const devices = allDevices.value.filter((device) => assemblyDeviceIDs.value.includes(device.id))

  if (!q) return devices

  return devices.filter((it) =>
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

// ===================== МОДАЛКА ПРОСМОТРА СВОЙСТВ =====================
const showPropertiesModal = ref(false)
const currentDevice = ref(null)
const deviceProperties = ref([])
const propertiesLoading = ref(false)

const openProperties = async (device) => {
  currentDevice.value = device
  deviceProperties.value = []
  showPropertiesModal.value = true
  propertiesLoading.value = true

  try {
    const values = await devicesApi.getDeviceValues(device.id)
    deviceProperties.value = values.map((v) => ({
      name: v.name,
      value: v.value ?? '—',
      unit: v.unit || '',
    }))
  } catch (error) {
    console.error('Ошибка загрузки свойств:', error)
    toast.error('Не удалось загрузить свойства устройства')
  } finally {
    propertiesLoading.value = false
  }
}

onMounted(async () => {
  await loadProject()
  await loadAssembly()
  await loadAssemblyDevices()
  await loadAllDevices()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <!-- Шапка: контекст + поиск -->
    <div class="admin-card admin-headbar">
      <div class="admin-headbar__info">
        <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
        <span class="admin-headbar__separator">/</span>
        <span class="admin-headbar__assembly">{{ assembly?.codeName || 'Сборка' }}</span>
      </div>
      <div class="admin-headbar__search">
        <span class="admin-headbar__search-label">Поиск:</span>
        <Ainput
          class="admin-headbar__search-input"
          v-model="searchBar"
          placeholder="По артикулу, описанию, бренду..."
        />
      </div>
    </div>

    <!-- Таблица устройств (без пагинации) -->
    <div class="admin-card admin-table-wrap">
      <div v-if="sortedDevices.length === 0" class="admin-empty">
        {{
          searchBar
            ? `По запросу «${searchBar}» ничего не найдено`
            : 'В этой сборке пока нет устройств'
        }}
      </div>

      <table v-else class="admin-table">
        <thead>
          <tr>
            <th
              class="admin-table__th admin-table__th--id admin-table__th--sortable"
              :class="{ 'admin-table__th--sorted': sortKey === 'id' }"
              @click="toggleSort('id')"
              title="Сортировать по ID"
            >
              <span class="admin-table__th-inner">
                <span class="admin-table__th-text">ID</span>
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
            <td class="admin-table__td admin-table__td--id">{{ device.id }}</td>
            <td v-for="col in columns" :key="col.key" class="admin-table__td">
              {{ device[col.key] ?? '—' }}
            </td>
            <td class="admin-table__td admin-table__td--actions">
              <button
                class="admin-table__btn"
                @click="openProperties(device)"
                title="Просмотр свойств"
              >
                👁️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Модальное окно: просмотр свойств устройства (только чтение) -->
    <AModal
      @close-emit="showPropertiesModal = false"
      :title="
        currentDevice
          ? `Свойства: ${currentDevice.article || currentDevice.description}`
          : 'Свойства устройства'
      "
      :opened="showPropertiesModal"
    >
      <div v-if="propertiesLoading" class="admin-empty">Загрузка...</div>
      <div v-else-if="deviceProperties.length === 0" class="admin-empty">
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
  </div>
</template>

<style scoped>
.global-container {
  margin-top: 24px;
  display: grid;
  gap: 24px;
  align-content: start;
}

/* ---------- КАРТОЧКИ ---------- */
.admin-card {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: #fff;
  padding: 24px;
}

/* ---------- ШАПКА ---------- */
.admin-headbar {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr auto;
  align-items: center;
}
@media (max-width: 600px) {
  .admin-headbar {
    grid-template-columns: 1fr;
  }
}
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
.admin-headbar__search {
  display: grid;
  grid-template-columns: 70px 1fr;
  align-items: center;
  gap: 8px;
}
.admin-headbar__search-label {
  font-size: 13px;
  color: #4a5568;
}
.admin-headbar__search-input {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.1);
  transition: all 0.3s;
}
.admin-headbar__search-input:hover {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.3);
}

/* ---------- ТАБЛИЦА ---------- */
.admin-table-wrap {
  padding: 0;
  overflow: auto;
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
.admin-table__th--id {
  width: 80px;
}
.admin-table__th--actions {
  width: 100px;
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
.admin-table__th--sorted .admin-table__th-arrow--active,
.admin-table__th--sortable:hover .admin-table__th-arrow--active {
  color: #4f46e5;
}

.admin-table__row {
  transition: background-color 0.15s;
}
.admin-table__row:hover {
  background-color: #f7fafc;
}
.admin-table__td {
  padding: 10px 16px;
  border-bottom: 1px solid rgb(240, 240, 240);
  color: #2d3748;
}
.admin-table__td--id {
  color: #a0aec0;
  font-size: 12px;
}
.admin-table__td--actions {
  text-align: center;
  white-space: nowrap;
}
.admin-table__btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}
.admin-table__btn:hover {
  background-color: #edf2f7;
}

/* ---------- ПРОСМОТР СВОЙСТВ ---------- */
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
</style>

<script setup>
import { useRoute } from 'vue-router'
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
import router from '@/router'

const route = useRoute()
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
    pageStore.pageInfo.name = `Устройства: ${assembly.value?.codeName || 'Сборка'}`
  } catch (error) {
    console.error('Ошибка загрузки сборки:', error)
  }
}

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

const loadAssemblyDevices = async () => {
  try {
    const rawDevices =
      (await projectsApi.getAssemblyDevicesByAssemblyId(route.params.assemblyId)) || []

    assemblyDevices.value = rawDevices.map((ad) => {
      const id = ad.id ?? ad.Id
      const deviceId = ad.deviceId ?? ad.DeviceId
      const quantity = ad.quantity ?? ad.Quantity ?? 1

      const deviceDetails = allDevices.value.find((d) => (d.id ?? d.Id) === deviceId)

      return {
        id,
        assemblyId: ad.assemblyId ?? ad.AssemblyId,
        deviceId,
        quantity,
        article:
          ad.article || ad.Article || deviceDetails?.article || deviceDetails?.Article || '—',
        description:
          ad.description ||
          ad.Description ||
          deviceDetails?.description ||
          deviceDetails?.Description ||
          '—',
        brand: ad.brand || ad.Brand || deviceDetails?.brand || deviceDetails?.Brand || '—',
        deviceType:
          ad.deviceType ||
          ad.DeviceType ||
          deviceDetails?.deviceType ||
          deviceDetails?.DeviceType ||
          '—',
        properties:
          ad.properties ||
          ad.Properties ||
          deviceDetails?.properties ||
          deviceDetails?.Properties ||
          [],
      }
    })
  } catch (error) {
    toast.error('Не удалось загрузить устройства сборки')
    console.error('Не удалось загрузить устройства сборки', error)
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

watch(showAddModal, (isOpen) => {
  if (isOpen) {
    selectedDeviceTypeId.value = null
    selectedBrandId.value = null
    newDeviceId.value = null
    newQuantity.value = 1
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
const propertiesLoading = ref(false)

const openProperties = async (device) => {
  currentDevice.value = device
  deviceProperties.value = []
  showPropertiesModal.value = true
  propertiesLoading.value = true

  try {
    if (device.properties && device.properties.length > 0) {
      deviceProperties.value = device.properties.map((v) => ({
        name: v.name || v.Name,
        value: v.value ?? v.Value ?? '—',
        unit: v.unit || v.Unit || '',
      }))
    } else {
      const values = await devicesApi.getDeviceValues(device.deviceId)
      deviceProperties.value = values.map((v) => ({
        name: v.name || v.Name,
        value: v.value ?? v.Value ?? '—',
        unit: v.unit || v.Unit || '',
      }))
    }
  } catch (error) {
    console.error('Ошибка загрузки свойств:', error)
    toast.error('Не удалось загрузить свойства устройства')
  } finally {
    propertiesLoading.value = false
  }
}

const toPanelEditor = () => {
  router.push(`/${route.params.projectId}/assemblies/${route.params.assemblyId}/panelEditor`)
}

onMounted(async () => {
  await loadProject()
  await loadAssembly()
  await Promise.all([loadAllDevices(), loadDeviceTypes(), loadBrands()])
  await loadAssemblyDevices()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <div class="admin-card admin-headbar">
      <div class="admin-headbar__info">
        <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
        <span class="admin-headbar__separator">/</span>
        <span class="admin-headbar__assembly">{{ assembly?.codeName || 'Сборка' }}</span>
      </div>

      <div class="admin-headbar__actions">
        <div class="admin-headbar__search">
          <span class="admin-headbar__search-label">Поиск:</span>
          <Ainput
            class="admin-headbar__search-input"
            v-model="searchBar"
            placeholder="По артикулу, описанию..."
          />
        </div>
        <Abutton @click="showAddModal = true" class="add-device-btn">
          + Добавить устройство
        </Abutton>
        <Abutton @click="toPanelEditor" class="add-device-btn"> Монтажная панель </Abutton>
      </div>
    </div>

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
              class="admin-table__th admin-table__th--id admin-table__th--sortable"
              :class="{ 'admin-table__th--sorted': sortKey === 'id' }"
              @click="toggleSort('id')"
              title="Сортировать по ID"
            >
              <span class="admin-table__th-inner">
                <span class="admin-table__th-text">ID связи</span>
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
            <td class="admin-table__td">{{ device.article }}</td>
            <td class="admin-table__td">{{ device.description }}</td>
            <td class="admin-table__td">{{ device.brand }}</td>
            <td class="admin-table__td">{{ device.deviceType }}</td>

            <td class="admin-table__td admin-table__td--quantity">
              <div class="qty-control">
                <button
                  class="qty-btn"
                  :disabled="device.quantity <= 1 || isUpdatingQty"
                  @click="changeQuantity(device.id, device.quantity, -1)"
                  title="Уменьшить"
                >
                  −
                </button>
                <span class="qty-value">{{ device.quantity }}</span>
                <button
                  class="qty-btn"
                  :disabled="device.quantity >= 200 || isUpdatingQty"
                  @click="changeQuantity(device.id, device.quantity, 1)"
                  title="Увеличить"
                >
                  +
                </button>
              </div>
            </td>

            <!-- ✅ ДОБАВЛЕНА КНОПКА УДАЛЕНИЯ -->
            <td class="admin-table__td admin-table__td--actions">
              <button
                class="admin-table__btn"
                @click="openProperties(device)"
                title="Просмотр свойств"
              >
                Свойства
              </button>
              <button
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

.admin-card {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: #fff;
  padding: 24px;
}

.admin-headbar {
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr auto;
  align-items: center;
}
@media (max-width: 768px) {
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

.admin-headbar__actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
@media (max-width: 600px) {
  .admin-headbar__actions {
    flex-direction: column;
    align-items: stretch;
  }
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

.add-device-btn {
  white-space: nowrap;
}

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
  width: 90px;
}
.admin-table__th--actions {
  width: 140px; /* Немного увеличено для двух кнопок */
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
.admin-table__td--id {
  color: #a0aec0;
  font-size: 12px;
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
</style>

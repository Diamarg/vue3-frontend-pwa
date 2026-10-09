<!-- pages/AdminPanelPage.vue -->
<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Abutton from '@/components/A-button.vue'
import Ainput from '@/components/A-input.vue'
import AModal from '@/components/A-modal.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { projectsApi } from '@/api/projects'
import { devicesApi } from '@/api/devices'
import { cableLinesApi } from '@/api/cableLines'
import { referenceApi } from '@/api/reference'
import { filesApi } from '@/api/files'
import { adminUsersApi } from '@/api/adminUsers'

const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

// ===================== СПРАВОЧНИКИ ДЛЯ СЕЛЕКТОВ =====================
const projectsList = ref([])
const assembliesList = ref([])
const loadedOptions = ref({})
const selectedProjectId = ref(null)
const selectedAssemblyId = ref(null)

const mapOpts = (arr, labelKey = 'name') =>
  (arr || []).map((x) => ({ value: x.id, label: x[labelKey] || x.codeName || `ID ${x.id}` }))

const projectOpts = () =>
  (projectsList.value || []).map((p) => ({ value: p.id, label: `${p.codeName} (ID ${p.id})` }))

// ===================== УТИЛИТЫ ФОРМАТИРОВАНИЯ =====================
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ===================== КОНФИГУРАЦИЯ РАЗДЕЛОВ =====================
const sections = {
  projects: {
    label: 'Проекты',
    searchKeys: ['codeName', 'customer', 'description'],
    columns: [
      {
        key: 'codeName',
        label: 'Кодовое имя',
        type: 'text',
        required: true,
        placeholder: 'АС-101',
      },
      {
        key: 'customer',
        label: 'Заказчик',
        type: 'text',
        required: true,
        placeholder: 'Название объекта',
      },
      { key: 'description', label: 'Описание', type: 'text', placeholder: 'Описание проекта' },
      { key: 'dateOfCreation', label: 'Дата создания', type: 'date', required: true },
    ],
    fetch: () => projectsApi.getProjects(),
    create: (_ctx, data) => projectsApi.createProject(data),
    update: (_ctx, id, data) => projectsApi.updateProject(id, data),
    remove: (_ctx, id) => projectsApi.deleteProject(id),
  },
  assemblies: {
    label: 'Сборки',
    needsProject: true,
    searchKeys: ['codeName', 'description'],
    columns: [
      { key: 'codeName', label: 'Кодовое имя', type: 'text', required: true },
      { key: 'description', label: 'Описание', type: 'text' },
    ],
    loadOptions: async () => ({ projects: projectOpts() }),
    fetch: (ctx) =>
      ctx.projectId ? projectsApi.getAssembliesByProjectId(ctx.projectId) : Promise.resolve([]),
    create: (ctx, data) => projectsApi.createAssembly({ ...data, projectId: ctx.projectId }),
    update: (ctx, id, data) =>
      projectsApi.updateAssembly(id, { ...data, projectId: ctx.projectId }),
    remove: (_ctx, id) => projectsApi.deleteAssembly(id),
  },
  devices: {
    label: 'Устройства',
    searchKeys: ['article', 'description'],
    columns: [
      { key: 'article', label: 'Артикул', type: 'text', required: true },
      { key: 'description', label: 'Описание', type: 'text' },
      { key: 'brandId', label: 'Бренд', type: 'select', required: true, optionsKey: 'brands' },
      {
        key: 'deviceTypeId',
        label: 'Тип устройства',
        type: 'select',
        required: true,
        optionsKey: 'deviceTypes',
      },
      { key: 'width', label: 'Ширина (мм)', type: 'number' },
      { key: 'height', label: 'Высота (мм)', type: 'number' },
      { key: 'depth', label: 'Глубина (мм)', type: 'number' },
    ],
    loadOptions: async () => {
      const [brands, deviceTypes] = await Promise.all([
        referenceApi.getBrands(),
        referenceApi.getDeviceTypes(),
      ])
      return { brands: mapOpts(brands), deviceTypes: mapOpts(deviceTypes) }
    },
    fetch: () => devicesApi.getAll(),
    create: (_ctx, data) => devicesApi.create(data),
    update: (_ctx, id, data) => devicesApi.update(id, data),
    remove: (_ctx, id) => devicesApi.delete(id),
  },
  cableLines: {
    label: 'Кабельные линии',
    needsProject: true,
    searchKeys: ['linePurpose', 'startPoint', 'endPoint', 'notes'],
    columns: [
      { key: 'linePurpose', label: 'Назначение', type: 'text', required: true },
      { key: 'startPoint', label: 'Откуда', type: 'text' },
      { key: 'endPoint', label: 'Куда', type: 'text' },
      // ✅ ИЗМЕНЕНО: type 'text' + inputmode 'decimal' для корректного ввода запятой
      { key: 'length', label: 'Длина (м)', type: 'text', inputmode: 'decimal', required: true },
      { key: 'coreCount', label: 'Кол-во жил', type: 'number' },
      {
        key: 'cableTypeId',
        label: 'Тип кабеля',
        type: 'select',
        required: true,
        optionsKey: 'cableTypes',
      },
      {
        key: 'crossSectionId',
        label: 'Сечение',
        type: 'select',
        required: true,
        optionsKey: 'crossSections',
      },
      { key: 'notes', label: 'Примечание', type: 'text' },
    ],
    loadOptions: async () => {
      const [cableTypes, crossSections] = await Promise.all([
        referenceApi.getCableTypes(),
        referenceApi.getCrossSections(),
      ])
      return { cableTypes: mapOpts(cableTypes), crossSections: mapOpts(crossSections, 'value') }
    },
    fetch: (ctx) => (ctx.projectId ? cableLinesApi.getLines(ctx.projectId) : Promise.resolve([])),
    create: (ctx, data) => cableLinesApi.createLine(ctx.projectId, data),
    update: (ctx, id, data) => cableLinesApi.updateLine(ctx.projectId, id, data),
    remove: (ctx, id) => cableLinesApi.deleteLine(ctx.projectId, id),
  },
  assemblyDevices: {
    label: 'Устройства в сборках',
    needsProject: true,
    needsAssembly: true,
    searchKeys: ['article', 'description', 'brand', 'deviceType'],
    columns: [
      {
        key: 'deviceId',
        label: 'Устройство',
        type: 'select',
        required: true,
        optionsKey: 'devices',
      },
      { key: 'quantity', label: 'Количество', type: 'number', required: true, placeholder: '1' },
    ],
    loadOptions: async () => {
      const devices = await devicesApi.getAll()
      return {
        devices: (devices || []).map((d) => ({
          value: d.id,
          label: `${d.article || 'ID ' + d.id}${d.description ? ' - ' + d.description : ''}`,
        })),
      }
    },
    fetch: (ctx) =>
      ctx.assemblyId
        ? projectsApi.getAssemblyDevicesByAssemblyId(ctx.assemblyId)
        : Promise.resolve([]),
    create: (ctx, data) => projectsApi.addDeviceToAssembly({ ...data, assemblyId: ctx.assemblyId }),
    update: (ctx, id, data) => projectsApi.updateAssemblyDeviceQuantity(id, data.quantity),
    remove: (ctx, id) => projectsApi.removeDeviceFromAssembly(id),
  },
  projectFiles: {
    label: 'Файлы проектов',
    needsProject: true,
    hideCreateButton: true,
    searchKeys: ['fileName', 'description'],
    columns: [
      { key: 'fileName', label: 'Имя файла', type: 'text', readonly: true },
      { key: 'description', label: 'Описание', type: 'text', placeholder: 'Описание файла...' },
      { key: 'fileSize', label: 'Размер', type: 'text', readonly: true, formatFn: formatFileSize },
      {
        key: 'uploadedAt',
        label: 'Загружено',
        type: 'text',
        readonly: true,
        formatFn: formatDateTime,
      },
    ],
    fetch: (ctx) => (ctx.projectId ? filesApi.getFiles(ctx.projectId) : Promise.resolve([])),
    update: (ctx, id, data) => filesApi.updateFile(ctx.projectId, id, data),
    remove: (ctx, id) => filesApi.deleteFile(ctx.projectId, id),
  },
  fileCategories: {
    label: 'Категории файлов',
    searchKeys: ['name'],
    columns: [
      {
        key: 'name',
        label: 'Название',
        type: 'text',
        required: true,
        placeholder: 'Документация, Чертежи...',
      },
    ],
    fetch: (ctx) => {
      const pid = ctx.projectId || projectsList.value[0]?.id
      return pid ? filesApi.getCategories(pid) : Promise.resolve([])
    },
    create: (ctx, data) => {
      const pid = ctx.projectId || projectsList.value[0]?.id
      return filesApi.createCategory(pid, data)
    },
    update: (ctx, id, data) => {
      const pid = ctx.projectId || projectsList.value[0]?.id
      return filesApi.updateCategory(pid, id, data)
    },
    remove: (ctx, id) => {
      const pid = ctx.projectId || projectsList.value[0]?.id
      return filesApi.deleteCategory(pid, id)
    },
  },
  units: {
    label: 'Ед. измерения',
    searchKeys: ['name', 'symbol'],
    columns: [
      {
        key: 'name',
        label: 'Название',
        type: 'text',
        required: true,
        placeholder: 'Вольт, Ампер...',
      },
      { key: 'symbol', label: 'Обозначение', type: 'text', placeholder: 'В, А...' },
    ],
    fetch: () => referenceApi.getUnits(),
    create: (_ctx, data) => referenceApi.createUnit(data),
    update: (_ctx, id, data) => referenceApi.updateUnit(id, data),
    remove: (_ctx, id) => referenceApi.deleteUnit(id),
  },
  brands: {
    label: 'Бренды',
    searchKeys: ['name'],
    columns: [
      {
        key: 'name',
        label: 'Название',
        type: 'text',
        required: true,
        placeholder: 'ABB, Siemens...',
      },
    ],
    fetch: () => referenceApi.getBrands(),
    create: (_ctx, data) => referenceApi.createBrand(data),
    update: (_ctx, id, data) => referenceApi.updateBrand(id, data),
    remove: (_ctx, id) => referenceApi.deleteBrand(id),
  },
  deviceTypes: {
    label: 'Типы устройств',
    showTypeProps: true,
    searchKeys: ['name'],
    columns: [
      {
        key: 'name',
        label: 'Название',
        type: 'text',
        required: true,
        placeholder: 'Автомат, Контактор...',
      },
    ],
    fetch: () => referenceApi.getDeviceTypes(),
    create: (_ctx, data) => referenceApi.createDeviceType(data),
    update: (_ctx, id, data) => referenceApi.updateDeviceType(id, data),
    remove: (_ctx, id) => referenceApi.deleteDeviceType(id),
  },
  properties: {
    label: 'Свойства',
    searchKeys: ['name'],
    columns: [
      {
        key: 'name',
        label: 'Название',
        type: 'text',
        required: true,
        placeholder: 'Напряжение, Ток...',
      },
      { key: 'unitId', label: 'Ед. измерения', type: 'select', optionsKey: 'units' },
    ],
    loadOptions: async () => ({ units: mapOpts(await referenceApi.getUnits()) }),
    fetch: () => referenceApi.getProperties(),
    create: (_ctx, data) => referenceApi.createProperty(data),
    update: (_ctx, id, data) => referenceApi.updateProperty(id, data),
    remove: (_ctx, id) => referenceApi.deleteProperty(id),
  },
  cableTypes: {
    label: 'Типы кабелей',
    searchKeys: ['name'],
    columns: [
      {
        key: 'name',
        label: 'Название',
        type: 'text',
        required: true,
        placeholder: 'ВВГнг, ПВС...',
      },
    ],
    fetch: () => referenceApi.getCableTypes(),
    create: (_ctx, data) => referenceApi.createCableType(data),
    update: (_ctx, id, data) => referenceApi.updateCableType(id, data),
    remove: (_ctx, id) => referenceApi.deleteCableType(id),
  },
  crossSections: {
    label: 'Сечения',
    searchKeys: ['value'],
    columns: [
      {
        key: 'value',
        label: 'Сечение',
        // ✅ ИЗМЕНЕНО: type 'text' + inputmode 'decimal'
        type: 'text',
        inputmode: 'decimal',
        required: true,
        placeholder: '1.5, 2.5, 4...',
      },
    ],
    fetch: () => referenceApi.getCrossSections(),
    create: (_ctx, data) => referenceApi.createCrossSection(data),
    update: (_ctx, id, data) => referenceApi.updateCrossSection(id, data),
    remove: (_ctx, id) => referenceApi.deleteCrossSection(id),
  },
  users: {
    label: 'Пользователи',
    hideCreateButton: true,
    hideEditButton: true,
    hideIdColumn: true,
    showResetPassword: true,
    showRoles: true,
    deleteIrreversible: true,
    defaultSort: 'userName',
    searchKeys: ['userName', 'fullName', 'email'],
    columns: [
      { key: 'userName', label: 'Логин', type: 'text', readonly: true },
      { key: 'fullName', label: 'ФИО', type: 'text', readonly: true },
      { key: 'email', label: 'Email', type: 'text', readonly: true },
      {
        key: 'roles',
        label: 'Роли',
        type: 'text',
        readonly: true,
        formatFn: (v) => (v || []).join(', '),
      },
      {
        key: 'createdAt',
        label: 'Создан',
        type: 'text',
        readonly: true,
        formatFn: formatDateTime,
      },
    ],
    fetch: () => adminUsersApi.getUsers(),
    remove: (_ctx, id) => adminUsersApi.deleteUser(id),
  },
}

const navGroups = [
  {
    title: 'Данные',
    keys: ['projects', 'assemblies', 'devices', 'cableLines', 'assemblyDevices', 'projectFiles'],
  },
  {
    title: 'Справочники',
    keys: [
      'units',
      'brands',
      'deviceTypes',
      'properties',
      'cableTypes',
      'crossSections',
      'fileCategories',
    ],
  },
  {
    title: 'Доступ',
    keys: ['users'],
  },
]

// ===================== СОСТОЯНИЕ =====================
const currentSection = ref('projects')
const cfg = computed(() => sections[currentSection.value])
const ctx = computed(() => ({
  projectId: selectedProjectId.value,
  assemblyId: selectedAssemblyId.value,
}))

const items = ref([])
const loading = ref(false)
const loadError = ref(false)
const searchBar = ref('')

const showModal = ref(false)
const editing = ref(null)
const form = reactive({})
const touched = reactive({})

// ===================== МОДАЛКА: СВОЙСТВА ТИПА УСТРОЙСТВА =====================
const showTypePropsModal = ref(false)
const currentDeviceType = ref(null)
const allGlobalProps = ref([])
const allTypePropLinks = ref([])
const newPropId = ref(null)
const typePropsLoading = ref(false)

const openTypeProps = async (type) => {
  currentDeviceType.value = type
  showTypePropsModal.value = true
  typePropsLoading.value = true
  newPropId.value = null
  try {
    const [props, links] = await Promise.all([
      referenceApi.getProperties(),
      referenceApi.getTypeProperties(),
    ])
    allGlobalProps.value = props || []
    allTypePropLinks.value = links || []
  } catch (e) {
    toast.error('Не удалось загрузить свойства типа')
  } finally {
    typePropsLoading.value = false
  }
}

const assignedTypeProps = computed(() => {
  if (!currentDeviceType.value) return []
  const typeId = currentDeviceType.value.id ?? currentDeviceType.value.Id
  return allTypePropLinks.value
    .filter((link) => (link.deviceTypeId ?? link.DeviceTypeId) === typeId)
    .map((link) => {
      const propId = link.devicePropId ?? link.DevicePropId
      const prop = allGlobalProps.value.find((p) => (p.id ?? p.Id) === propId)
      return {
        linkId: link.id ?? link.Id,
        propId: propId,
        name: prop ? (prop.name ?? prop.Name) : 'Неизвестное свойство',
        unitSymbol: prop ? (prop.unitSymbol ?? prop.UnitSymbol ?? '') : '',
      }
    })
})

const availablePropsForType = computed(() => {
  const assignedIds = new Set(assignedTypeProps.value.map((p) => p.propId))
  return allGlobalProps.value.filter((p) => !assignedIds.has(p.id ?? p.Id))
})

const addPropToType = async () => {
  if (!newPropId.value) {
    toast.error('Выберите свойство из списка')
    return
  }
  try {
    await referenceApi.addTypeProperty({
      deviceTypeId: currentDeviceType.value.id ?? currentDeviceType.value.Id,
      devicePropId: newPropId.value,
    })
    toast.success('Свойство добавлено к типу')
    newPropId.value = null
    allTypePropLinks.value = await referenceApi.getTypeProperties()
  } catch (e) {
    toast.error('Не удалось добавить свойство')
  }
}

const removePropFromType = async (linkId) => {
  if (!confirm('Удалить это свойство из типа устройства?')) return
  try {
    await referenceApi.deleteTypeProperty(linkId)
    toast.success('Свойство удалено из типа')
    allTypePropLinks.value = await referenceApi.getTypeProperties()
  } catch (e) {
    toast.error('Не удалось удалить свойство')
  }
}

// ===================== ЗНАЧЕНИЯ СВОЙСТВ В ФОРМЕ УСТРОЙСТВА =====================
const formProperties = ref([])
const formPropsLoading = ref(false)
const unitsCache = ref([])

const loadPropertiesForForm = async (deviceTypeId, existingValues = null) => {
  formProperties.value = []
  if (!deviceTypeId) return
  formPropsLoading.value = true
  try {
    if (unitsCache.value.length === 0) unitsCache.value = await referenceApi.getUnits()
    const props = await referenceApi.getPropertiesByTypeId(deviceTypeId)
    formProperties.value = (props || []).map((p) => {
      const unit = unitsCache.value.find((u) => u.id === (p.unitId ?? p.UnitId))
      const existing = existingValues?.find((v) => v.id === (p.id ?? p.Id))
      return {
        propertyId: p.id ?? p.Id,
        name: p.name ?? p.Name,
        unitSymbol: unit ? (unit.symbol ?? unit.Symbol ?? unit.name ?? unit.Name) : '',
        value: existing ? (existing.value ?? existing.Value ?? '') : '',
      }
    })
  } catch (e) {
    // ignore
  } finally {
    formPropsLoading.value = false
  }
}

watch(
  () => form.deviceTypeId,
  async (newTypeId) => {
    if (!showModal.value || currentSection.value !== 'devices') return
    if (editing.value) return
    await loadPropertiesForForm(newTypeId, null)
  },
)

// ===================== СОРТИРОВКА И ПАГИНАЦИЯ =====================
const sortKey = ref('id')
const sortDir = ref('asc')
const colMap = computed(() => {
  const m = {}
  cfg.value.columns.forEach((c) => (m[c.key] = c))
  return m
})

const getSortValue = (item, key) => {
  if (key === 'id') return item.id ?? item.Id
  const col = colMap.value[key]
  if (!col) return ''
  if (col.type === 'select') {
    const list = loadedOptions.value[col.optionsKey] || []
    const opt = list.find((o) => o.value === item[col.key])
    return opt ? opt.label : ''
  }
  return item[col.key] ?? ''
}

const isNumericSort = (key) => {
  if (key === 'id') return true
  const col = colMap.value[key]
  return !!(col && col.type === 'number')
}

const toggleSort = (key) => {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sortArrow = (key) => {
  if (sortKey.value !== key) return '⇅'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

const pageSize = ref(10)
const currentPage = ref(1)

// ===================== ЗАГРУЗКА =====================
const fetchItems = async () => {
  if (
    (cfg.value.needsProject && !selectedProjectId.value) ||
    (cfg.value.needsAssembly && !selectedAssemblyId.value)
  ) {
    items.value = []
    return
  }
  loading.value = true
  loadError.value = false
  try {
    items.value = (await cfg.value.fetch(ctx.value)) || []
  } catch (e) {
    loadError.value = true
    toast.error('Ошибка загрузки данных')
  } finally {
    loading.value = false
  }
}

const initSection = async () => {
  searchBar.value = ''
  currentPage.value = 1
  sortKey.value = cfg.value.defaultSort || 'id'
  sortDir.value = 'asc'

  if (cfg.value.needsAssembly && selectedProjectId.value) {
    try {
      assembliesList.value = await projectsApi.getAssembliesByProjectId(selectedProjectId.value)
      const isValidAssembly = assembliesList.value.some((a) => a.id === selectedAssemblyId.value)
      if (!isValidAssembly) {
        selectedAssemblyId.value = assembliesList.value.length ? assembliesList.value[0].id : null
      }
    } catch (e) {
      assembliesList.value = []
      selectedAssemblyId.value = null
    }
  } else if (!cfg.value.needsAssembly) {
    assembliesList.value = []
    selectedAssemblyId.value = null
  }

  loadedOptions.value = cfg.value.loadOptions ? await cfg.value.loadOptions() : {}
  await fetchItems()
}

watch(currentSection, initSection)

const filteredItems = computed(() => {
  const q = searchBar.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter((it) =>
    cfg.value.searchKeys.some((k) =>
      String(it[k] ?? '')
        .toLowerCase()
        .includes(q),
    ),
  )
})

const sortedItems = computed(() => {
  const arr = [...filteredItems.value]
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  const numeric = isNumericSort(key)
  arr.sort((a, b) => {
    const va = getSortValue(a, key)
    const vb = getSortValue(b, key)
    if (numeric) return ((Number(va) || 0) - (Number(vb) || 0)) * dir
    return String(va).localeCompare(String(vb), 'ru', { numeric: true, sensitivity: 'base' }) * dir
  })
  return arr
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredItems.value.length / pageSize.value)),
)
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return sortedItems.value.slice(start, start + pageSize.value)
})
const shownFrom = computed(() =>
  filteredItems.value.length === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1,
)
const shownTo = computed(() =>
  Math.min(currentPage.value * pageSize.value, filteredItems.value.length),
)

const pageRange = computed(() => {
  const total = totalPages.value,
    cur = currentPage.value,
    delta = 1,
    range = [1]
  for (let i = cur - delta; i <= cur + delta; i++) if (i > 1 && i < total) range.push(i)
  if (total > 1) range.push(total)
  const result = []
  let prev
  for (const i of range) {
    if (prev) {
      if (i - prev === 2) result.push(prev + 1)
      else if (i - prev > 2) result.push('...')
    }
    result.push(i)
    prev = i
  }
  return result
})

const showTable = computed(
  () =>
    !loading.value &&
    !loadError.value &&
    filteredItems.value.length > 0 &&
    !(cfg.value.needsProject && !selectedProjectId.value) &&
    !(cfg.value.needsAssembly && !selectedAssemblyId.value),
)

const goToPage = (p) => {
  currentPage.value = Math.min(Math.max(1, p), totalPages.value)
}
const prevPage = () => goToPage(currentPage.value - 1)
const nextPage = () => goToPage(currentPage.value + 1)

watch([searchBar, pageSize, sortKey, sortDir], () => {
  currentPage.value = 1
})
watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp
})

// ===================== ФОРМА =====================
const resetForm = (item = null) => {
  editing.value = item
  Object.keys(form).forEach((k) => delete form[k])
  Object.keys(touched).forEach((k) => delete touched[k])
  cfg.value.columns.forEach((col) => {
    form[col.key] = item
      ? (item[col.key] ?? (col.type === 'number' ? null : ''))
      : col.type === 'number'
        ? null
        : ''
  })
  formProperties.value = []
}

const openCreate = () => {
  if (
    (cfg.value.needsProject && !selectedProjectId.value) ||
    (cfg.value.needsAssembly && !selectedAssemblyId.value)
  )
    return
  resetForm(null)
  showModal.value = true
}

const openEdit = async (item) => {
  resetForm(item)
  showModal.value = true
  if (currentSection.value === 'devices' && (item.deviceTypeId ?? item.DeviceTypeId)) {
    try {
      const values = await devicesApi.getDeviceValues(item.id ?? item.Id)
      await loadPropertiesForForm(item.deviceTypeId ?? item.DeviceTypeId, values)
    } catch (e) {
      /* ignore */
    }
  }
}

const getError = (col) => {
  if (!col.required || !touched[col.key]) return ''
  const v = form[col.key]
  return v === '' || v === null || v === undefined ? 'Заполните поле' : ''
}

const formReady = computed(() =>
  cfg.value.columns
    .filter((c) => c.required)
    .every((c) => {
      const v = form[c.key]
      return v !== '' && v !== null && v !== undefined
    }),
)

const buildData = () => {
  const data = {}
  cfg.value.columns.forEach((col) => {
    if (col.readonly) return
    let v = form[col.key]

    // ✅ СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ ДРОБНЫХ ЧИСЕЛ (Сечения и Длина)
    if (col.key === 'value' || col.key === 'length') {
      if (v === '' || v === null || v === undefined) {
        v = null
      } else {
        // Заменяем запятую на точку и преобразуем в число с плавающей точкой
        v = parseFloat(String(v).replace(',', '.'))
      }
    }
    // Стандартная обработка для остальных числовых полей (например, кол-во жил)
    else if (col.type === 'number') {
      v = v === '' || v === null || v === undefined ? null : Number(v)
    }

    data[col.key] = v
  })

  if (currentSection.value === 'devices' && formProperties.value.length > 0) {
    data.properties = formProperties.value
      .filter((row) => row.value !== '' && row.value !== null && row.value !== undefined)
      .map((row) => ({ id: row.propertyId, value: String(row.value), unit: row.unitSymbol ?? '' }))
  }
  return data
}

const save = async () => {
  cfg.value.columns.forEach((c) => (touched[c.key] = true))
  if (!formReady.value) return
  try {
    const data = buildData()
    if (editing.value) {
      await cfg.value.update(ctx.value, editing.value.id ?? editing.value.Id, data)
      toast.success('Запись обновлена')
    } else {
      await cfg.value.create(ctx.value, data)
      toast.success('Запись создана')
    }
    showModal.value = false
    await fetchItems()
  } catch (e) {
    toast.error('Ошибка сохранения: ' + (e.response?.data?.message || e.message))
  }
}

const remove = async (item) => {
  const name =
    item.userName ??
    item.name ??
    item.codeName ??
    item.value ??
    item.article ??
    item.linePurpose ??
    item.fileName ??
    item.id ??
    item.Id
  const idPart = cfg.value.hideIdColumn ? '' : ` (ID: ${item.id ?? item.Id})`
  const irreversible = cfg.value.deleteIrreversible ? ' Это действие необратимо.' : ''
  if (!confirm(`Удалить "${name}"${idPart}?${irreversible}`)) return
  try {
    await cfg.value.remove(ctx.value, item.id ?? item.Id)
    toast.success('Запись удалена')
    await fetchItems()
  } catch (e) {
    const data = e.response?.data
    const msg = typeof data === 'string' ? data : (data?.message ?? e.message)
    toast.error(msg || 'Ошибка удаления')
  }
}

// ===================== СБРОС ПАРОЛЯ ПОЛЬЗОВАТЕЛЯ =====================
const showPasswordModal = ref(false)
const passwordTarget = ref(null)
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)

const passwordError = computed(() => {
  if (!newPassword.value && !confirmPassword.value) return ''
  if (newPassword.value.length < 6) return 'Минимум 6 символов'
  if (!confirmPassword.value) return 'Повторите пароль'
  if (newPassword.value !== confirmPassword.value) return 'Пароли не совпадают'
  return ''
})

const openResetPassword = (user) => {
  passwordTarget.value = user
  newPassword.value = ''
  confirmPassword.value = ''
  showPasswordModal.value = true
}

const savePassword = async () => {
  if (passwordError.value || !passwordTarget.value) return
  passwordSaving.value = true
  try {
    await adminUsersApi.resetPassword(passwordTarget.value.id, newPassword.value)
    toast.success(`Пароль пользователя ${passwordTarget.value.userName} изменён`)
    showPasswordModal.value = false
  } catch (e) {
    const errors = e.response?.data?.errors
    const msg = e.response?.data?.message
    toast.error(errors?.length ? errors.join('; ') : msg || 'Не удалось изменить пароль')
  } finally {
    passwordSaving.value = false
  }
}

// ===================== РОЛИ ПОЛЬЗОВАТЕЛЯ =====================
const roleOptions = ['User', 'Admin']
const showRolesModal = ref(false)
const rolesTarget = ref(null)
const rolesDraft = ref([])
const rolesSaving = ref(false)

const selectedRoles = computed(() => roleOptions.filter((role) => rolesDraft.value.includes(role)))

const rolesChanged = computed(
  () =>
    !!rolesTarget.value && selectedRoles.value.join() !== (rolesTarget.value.roles || []).join(),
)

const openRoles = (user) => {
  rolesTarget.value = user
  rolesDraft.value = [...(user.roles || [])]
  showRolesModal.value = true
}

const toggleRole = (role) => {
  const idx = rolesDraft.value.indexOf(role)
  if (idx === -1) rolesDraft.value.push(role)
  else rolesDraft.value.splice(idx, 1)
}

const saveRoles = async () => {
  if (!rolesTarget.value || selectedRoles.value.length === 0) return
  rolesSaving.value = true
  try {
    await adminUsersApi.setRoles(rolesTarget.value.id, selectedRoles.value)
    toast.success(`Роли пользователя ${rolesTarget.value.userName} обновлены`)
    showRolesModal.value = false
    await fetchItems()
  } catch (e) {
    const data = e.response?.data
    const msg = typeof data === 'string' ? data : data?.message
    toast.error(msg || 'Не удалось изменить роли')
  } finally {
    rolesSaving.value = false
  }
}

// ===================== ОТОБРАЖЕНИЕ =====================
const displayValue = (item, col) => {
  if (currentSection.value === 'assemblyDevices' && col.key === 'deviceId') {
    if (item.article) return `${item.article}${item.description ? ' - ' + item.description : ''}`
  }
  const rawValue = item[col.key]
  if (col.formatFn && rawValue !== null && rawValue !== undefined) return col.formatFn(rawValue)
  if (col.type === 'select') {
    const list = loadedOptions.value[col.optionsKey] || []
    const opt = list.find((o) => o.value === rawValue)
    return opt ? opt.label : (rawValue ?? '—')
  }
  return rawValue === null || rawValue === undefined || rawValue === '' ? '—' : rawValue
}

// ===================== ЛОГАУТ =====================
const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

// ===================== СТАРТ =====================
onMounted(async () => {
  try {
    projectsList.value = await projectsApi.getProjects()
    if (projectsList.value.length) selectedProjectId.value = projectsList.value[0].id
  } catch (e) {
    /* ignore */
  }
  await initSection()
})

watch(selectedProjectId, async (newProjectId) => {
  if (newProjectId) {
    try {
      assembliesList.value = await projectsApi.getAssembliesByProjectId(newProjectId)
      selectedAssemblyId.value = assembliesList.value.length ? assembliesList.value[0].id : null
    } catch (e) {
      assembliesList.value = []
      selectedAssemblyId.value = null
    }
  } else {
    assembliesList.value = []
    selectedAssemblyId.value = null
  }
  if (cfg.value.needsProject && !cfg.value.needsAssembly) {
    currentPage.value = 1
    fetchItems()
  }
})

watch(selectedAssemblyId, () => {
  if (cfg.value.needsAssembly) {
    currentPage.value = 1
    fetchItems()
  }
})
</script>

<template>
  <div class="global-container">
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-sidebar__header">
          <h2 class="admin-sidebar__title">Админ-панель</h2>
          <div class="admin-sidebar__user-info">
            <span v-if="authStore.user">{{
              authStore.user.fullName || authStore.user.userName
            }}</span>
            <a @click="handleLogout" class="admin-sidebar__logout">Выйти</a>
          </div>
        </div>

        <nav class="admin-nav">
          <div v-for="group in navGroups" :key="group.title" class="admin-nav__group">
            <h3 class="admin-nav__group-title">{{ group.title }}</h3>
            <button
              v-for="key in group.keys"
              :key="key"
              :class="['admin-nav__link', { 'admin-nav__link--active': currentSection === key }]"
              @click="currentSection = key"
            >
              {{ sections[key].label }}
            </button>
          </div>
        </nav>
      </aside>

      <main class="admin-content">
        <div v-if="cfg.needsProject || cfg.needsAssembly" class="admin-card admin-card--row">
          <div v-if="cfg.needsProject" class="context-selector">
            <label class="admin-card__label">Проект:</label>
            <select v-model="selectedProjectId" class="admin-select">
              <option :value="null" disabled>Выберите проект...</option>
              <option v-for="p in projectsList" :key="p.id" :value="p.id">
                {{ p.codeName }} (ID {{ p.id }})
              </option>
            </select>
          </div>
          <div v-if="cfg.needsAssembly" class="context-selector">
            <label class="admin-card__label">Сборка:</label>
            <select
              v-model="selectedAssemblyId"
              class="admin-select"
              :disabled="!selectedProjectId"
            >
              <option :value="null" disabled>
                {{ selectedProjectId ? 'Выберите сборку...' : 'Сначала выберите проект' }}
              </option>
              <option v-for="a in assembliesList" :key="a.id" :value="a.id">
                {{ a.codeName }} (ID {{ a.id }})
              </option>
            </select>
          </div>
        </div>

        <div class="admin-card admin-headbar">
          <div class="admin-headbar__search">
            <span class="admin-headbar__search-label">Поиск:</span>
            <Ainput
              class="admin-headbar__search-input"
              v-model="searchBar"
              placeholder="Поиск..."
            />
          </div>
          <Abutton
            v-if="!cfg.hideCreateButton"
            @click="openCreate"
            :disabled="
              (cfg.needsProject && !selectedProjectId) || (cfg.needsAssembly && !selectedAssemblyId)
            "
          >
            + Добавить
          </Abutton>
          <div class="admin-mobile-sort">
            <select v-model="sortKey" class="admin-select admin-mobile-sort__field">
              <option v-if="!cfg.hideIdColumn" value="id">ID</option>
              <option v-for="col in cfg.columns" :key="col.key" :value="col.key">
                {{ col.label }}
              </option>
            </select>
            <button
              class="admin-pagination__btn"
              @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
              title="Направление сортировки"
            >
              {{ sortDir === 'asc' ? '↑' : '↓' }}
            </button>
          </div>
        </div>

        <div class="admin-card admin-table-wrap">
          <div v-if="cfg.needsProject && !selectedProjectId" class="admin-empty">
            Выберите проект для отображения данных
          </div>
          <div v-else-if="cfg.needsAssembly && !selectedAssemblyId" class="admin-empty">
            Выберите сборку для отображения данных
          </div>
          <div v-else-if="loading" class="admin-empty">Загрузка...</div>
          <div v-else-if="loadError" class="admin-empty admin-empty--error">
            Ошибка загрузки данных
          </div>
          <div v-else-if="filteredItems.length === 0" class="admin-empty">
            {{ searchBar ? `По запросу «${searchBar}» ничего не найдено` : 'Нет записей' }}
          </div>

          <table v-else class="admin-table">
            <thead>
              <tr>
                <th
                  v-if="!cfg.hideIdColumn"
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
                      >{{ sortArrow('id') }}</span
                    >
                  </span>
                </th>
                <th
                  v-for="col in cfg.columns"
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
                      >{{ sortArrow(col.key) }}</span
                    >
                  </span>
                </th>
                <th class="admin-table__th admin-table__th--actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedItems" :key="item.id ?? item.Id" class="admin-table__row">
                <td
                  v-if="!cfg.hideIdColumn"
                  class="admin-table__td admin-table__td--id"
                  data-label="ID"
                >
                  {{ item.id ?? item.Id }}
                </td>
                <td
                  v-for="col in cfg.columns"
                  :key="col.key"
                  class="admin-table__td"
                  :data-label="col.label"
                >
                  {{ displayValue(item, col) }}
                </td>
                <td class="admin-table__td admin-table__td--actions" data-label="Действия">
                  <button
                    v-if="cfg.showTypeProps"
                    class="admin-table__btn"
                    @click="openTypeProps(item)"
                    title="Управление свойствами типа"
                  >
                    ⚙️
                  </button>
                  <button
                    v-if="cfg.showRoles"
                    class="admin-table__btn"
                    @click="openRoles(item)"
                    title="Роли пользователя"
                  >
                    👥
                  </button>
                  <button
                    v-if="cfg.showResetPassword"
                    class="admin-table__btn"
                    @click="openResetPassword(item)"
                    title="Изменить пароль"
                  >
                    🔑
                  </button>
                  <button
                    v-if="!cfg.hideEditButton"
                    class="admin-table__btn"
                    @click="openEdit(item)"
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button
                    v-if="!cfg.hideDeleteButton"
                    class="admin-table__btn admin-table__btn--del"
                    @click="remove(item)"
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="showTable" class="admin-pagination">
            <div class="admin-pagination__info">
              Показано {{ shownFrom }}–{{ shownTo }} из {{ filteredItems.length }}
            </div>
            <div class="admin-pagination__controls">
              <div class="admin-pagination__size">
                <span>На странице:</span>
                <select v-model.number="pageSize" class="admin-pagination__select">
                  <option :value="10">10</option>
                  <option :value="20">20</option>
                  <option :value="50">50</option>
                  <option :value="100">100</option>
                </select>
              </div>
              <div class="admin-pagination__pages">
                <button
                  class="admin-pagination__btn"
                  :disabled="currentPage === 1"
                  @click="prevPage"
                  title="Назад"
                >
                  ‹
                </button>
                <template v-for="(p, idx) in pageRange" :key="idx">
                  <span v-if="p === '...'" class="admin-pagination__dots">…</span>
                  <button
                    v-else
                    :class="[
                      'admin-pagination__btn',
                      { 'admin-pagination__btn--active': p === currentPage },
                    ]"
                    @click="goToPage(p)"
                  >
                    {{ p }}
                  </button>
                </template>
                <button
                  class="admin-pagination__btn"
                  :disabled="currentPage === totalPages"
                  @click="nextPage"
                  title="Вперёд"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- МОДАЛКА: Создание/Редактирование -->
      <AModal
        @close-emit="showModal = false"
        :title="editing ? 'Редактировать запись' : 'Новая запись'"
        :opened="showModal"
      >
        <form class="admin-form" @submit.prevent="save">
          <div v-for="col in cfg.columns" :key="col.key" class="admin-form__group">
            <label :for="col.key">{{ col.label }}{{ col.required ? '*' : '' }}</label>
            <Ainput
              v-if="col.readonly"
              :id="col.key"
              :model-value="displayValue(editing || {}, col)"
              disabled
              class="admin-input--readonly"
            />
            <select
              v-else-if="col.type === 'select'"
              :id="col.key"
              v-model="form[col.key]"
              class="admin-select"
              :disabled="editing && currentSection === 'assemblyDevices' && col.key === 'deviceId'"
              @blur="touched[col.key] = true"
            >
              <option :value="null" disabled>Выберите...</option>
              <option
                v-for="opt in loadedOptions[col.optionsKey] || []"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <Ainput
              v-else
              :id="col.key"
              :type="col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'"
              :inputmode="col.inputmode || undefined"
              v-model="form[col.key]"
              :placeholder="col.placeholder || ''"
              @on-touch="touched[col.key] = true"
            />
            <p class="admin-form__error">{{ getError(col) }}</p>
          </div>

          <template v-if="currentSection === 'devices' && form.deviceTypeId">
            <div class="form-divider"></div>
            <h4 class="form-section-title">Значения свойств</h4>
            <div v-if="formPropsLoading" class="admin-empty" style="padding: 16px">Загрузка...</div>
            <div v-else-if="formProperties.length === 0" class="admin-empty" style="padding: 16px">
              Для выбранного типа устройства свойства не настроены
            </div>
            <div v-else class="values-form">
              <div v-for="row in formProperties" :key="row.propertyId" class="values-row">
                <label class="values-row__label" :for="`form-prop-${row.propertyId}`">
                  {{ row.name
                  }}<span v-if="row.unitSymbol" class="values-row__unit"
                    >, {{ row.unitSymbol }}</span
                  >
                </label>
                <input
                  :id="`form-prop-${row.propertyId}`"
                  class="values-input"
                  v-model="row.value"
                  :placeholder="row.unitSymbol ? `Значение (${row.unitSymbol})` : 'Значение'"
                />
              </div>
            </div>
          </template>

          <div v-if="currentSection === 'projectFiles' && editing" class="admin-form__hint">
            ℹ️ Имя файла и метаданные нельзя изменить. Можно редактировать только описание.
          </div>

          <div class="admin-form__actions">
            <Abutton type="submit" :disabled="!formReady">{{
              editing ? 'Сохранить' : 'Создать'
            }}</Abutton>
            <a class="admin-form__cancel" @click="showModal = false">Отмена</a>
          </div>
        </form>
      </AModal>

      <!-- МОДАЛКА: Роли пользователя -->
      <AModal
        @close-emit="showRolesModal = false"
        :title="`Роли пользователя ${rolesTarget?.userName || ''}`"
        :opened="showRolesModal"
      >
        <div class="admin-form">
          <div class="admin-form__roles">
            <label v-for="role in roleOptions" :key="role" class="admin-form__role">
              <input
                type="checkbox"
                :checked="rolesDraft.includes(role)"
                @change="toggleRole(role)"
              />
              <span>{{ role }}</span>
            </label>
          </div>
          <div class="admin-form__hint">
            User — доступ к проектам, Admin — ещё и эта панель. Снять Admin с собственной учётной
            записи нельзя, как и оставить систему без администратора.
          </div>
          <div class="admin-form__actions">
            <Abutton @click="saveRoles" :disabled="!rolesChanged || rolesSaving">
              {{ rolesSaving ? 'Сохранение...' : 'Сохранить' }}
            </Abutton>
            <a class="admin-form__cancel" @click="showRolesModal = false">Отмена</a>
          </div>
        </div>
      </AModal>

      <!-- МОДАЛКА: Изменение пароля пользователя -->
      <AModal
        @close-emit="showPasswordModal = false"
        :title="`Пароль пользователя ${passwordTarget?.userName || ''}`"
        :opened="showPasswordModal"
      >
        <form class="admin-form" @submit.prevent="savePassword">
          <div class="admin-form__group">
            <label for="newPassword">Новый пароль*</label>
            <Ainput
              id="newPassword"
              type="password"
              v-model="newPassword"
              placeholder="Минимум 6 символов"
            />
          </div>
          <div class="admin-form__group">
            <label for="confirmPassword">Повторите пароль*</label>
            <Ainput
              id="confirmPassword"
              type="password"
              v-model="confirmPassword"
              placeholder="Ещё раз"
            />
          </div>
          <p v-if="passwordError" class="admin-form__error">{{ passwordError }}</p>
          <div class="admin-form__hint">
            ⚠️ Новый пароль нужно передать пользователю лично. Старый вход устройства пользователя
            разорвётся не сразу — токен живёт до 8 часов.
          </div>
          <div class="admin-form__actions">
            <Abutton type="submit" :disabled="!passwordTarget || !!passwordError || passwordSaving">
              {{ passwordSaving ? 'Сохранение...' : 'Изменить пароль' }}
            </Abutton>
            <a class="admin-form__cancel" @click="showPasswordModal = false">Отмена</a>
          </div>
        </form>
      </AModal>

      <!-- МОДАЛКА: Свойства типа устройства -->
      <AModal
        @close-emit="showTypePropsModal = false"
        :title="
          currentDeviceType
            ? `Свойства типа: ${currentDeviceType.name ?? currentDeviceType.Name}`
            : 'Свойства типа'
        "
        :opened="showTypePropsModal"
      >
        <div v-if="typePropsLoading" class="admin-empty">Загрузка...</div>
        <div v-else class="type-props-manager">
          <div class="type-props__add-section">
            <label>Добавить свойство:</label>
            <div class="type-props__add-row">
              <select
                v-model="newPropId"
                class="admin-select"
                :disabled="availablePropsForType.length === 0"
              >
                <option :value="null" disabled>Выберите свойство...</option>
                <option
                  v-for="prop in availablePropsForType"
                  :key="prop.id ?? prop.Id"
                  :value="prop.id ?? prop.Id"
                >
                  {{ prop.name ?? prop.Name }}
                  <span v-if="prop.unitSymbol ?? prop.UnitSymbol"
                    >({{ prop.unitSymbol ?? prop.UnitSymbol }})</span
                  >
                </option>
              </select>
              <Abutton @click="addPropToType" :disabled="!newPropId" class="add-prop-btn"
                >Добавить</Abutton
              >
            </div>
            <p v-if="availablePropsForType.length === 0" class="type-props__hint">
              Все доступные свойства уже добавлены к этому типу
            </p>
          </div>
          <div class="type-props__list">
            <h4 class="type-props__list-title">Назначенные свойства</h4>
            <div v-if="assignedTypeProps.length === 0" class="admin-empty" style="padding: 16px">
              Свойства не назначены
            </div>
            <div v-else class="type-props__items">
              <div v-for="item in assignedTypeProps" :key="item.linkId" class="type-props__item">
                <span class="type-props__item-name">
                  {{ item.name
                  }}<span v-if="item.unitSymbol" class="type-props__item-unit"
                    >({{ item.unitSymbol }})</span
                  >
                </span>
                <button
                  class="admin-table__btn admin-table__btn--del"
                  @click="removePropFromType(item.linkId)"
                  title="Удалить связь"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="admin-form__actions" style="margin-top: 24px">
          <a class="admin-form__cancel" @click="showTypePropsModal = false">Закрыть</a>
        </div>
      </AModal>
    </div>
  </div>
</template>

<style scoped>
/* навбар съедает 65px сверху, поэтому высота считается от него, иначе
   админка прокручивается на пустую полосу внизу */
.global-container {
  height: auto;
  min-height: calc(100vh - var(--navbar-height));
}
.admin-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: calc(100vh - var(--navbar-height));
  background-color: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #2d3748;
}
@media (max-width: 768px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }
}
.admin-sidebar {
  background-color: #fff;
  border-right: 1px solid rgb(230, 230, 230);
  box-shadow: 4px 0 30px -10px rgba(34, 60, 80, 0.1);
  padding: 16px 0;
  position: sticky;
  /* прилипает под навбаром, иначе шапка сайдбара пряталась бы за ним */
  top: var(--navbar-height);
  height: calc(100vh - var(--navbar-height));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.admin-sidebar__header {
  padding: 0 16px 16px;
  border-bottom: 1px solid rgb(230, 230, 230);
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.admin-sidebar__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.admin-sidebar__user-info {
  font-size: 13px;
  color: #4a5568;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.admin-sidebar__logout {
  color: #e53e3e;
  cursor: pointer;
  text-decoration: underline;
}
.admin-nav {
  display: grid;
  gap: 16px;
  padding: 8px 0;
}
.admin-nav__group {
  display: grid;
  gap: 2px;
}
.admin-nav__group-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #a0aec0;
  letter-spacing: 0.5px;
  padding: 0 16px;
  margin: 0 0 4px;
}
.admin-nav__link {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
  font-size: 13px;
  color: #4a5568;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
}
.admin-nav__link:hover {
  background-color: #f7fafc;
  color: #2d3748;
}
.admin-nav__link--active {
  background-color: #eef2ff;
  color: #4f46e5;
  border-left-color: #6366f1;
  font-weight: 500;
}
.admin-content {
  padding: 24px;
  display: grid;
  gap: 24px;
  align-content: start;
  overflow-y: auto;
}
.admin-card {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: #fff;
  padding: 24px;
}
.admin-card--row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.context-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 250px;
}
@media (max-width: 768px) {
  .context-selector {
    min-width: 100%;
  }
}
.admin-card__label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
  white-space: nowrap;
}
.admin-select {
  width: 100%;
  max-width: 400px;
  padding: 8px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  background-color: #fff;
  font-size: 13px;
  color: #2d3748;
  cursor: pointer;
  transition: all 0.3s;
}
.admin-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
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
.admin-empty--error {
  color: #e53e3e;
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
  width: 180px;
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
.admin-table__btn--del:hover {
  background-color: #fed7d7;
}
.admin-pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid rgb(230, 230, 230);
  background-color: #f7fafc;
}
.admin-pagination__info {
  font-size: 12px;
  color: #718096;
}
.admin-pagination__controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.admin-pagination__size {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4a5568;
}
.admin-pagination__select {
  padding: 4px 8px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  background-color: #fff;
  font-size: 12px;
  color: #2d3748;
  cursor: pointer;
  transition: all 0.2s;
}
.admin-pagination__select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.admin-pagination__pages {
  display: flex;
  align-items: center;
  gap: 4px;
}
.admin-pagination__btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: #fff;
  border-radius: 6px;
  font-size: 13px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}
.admin-pagination__btn:hover:not(:disabled) {
  background-color: #f7fafc;
  border-color: #cbd5e0;
}
.admin-pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.admin-pagination__btn--active {
  background-color: #6366f1;
  border-color: #6366f1;
  color: #fff;
}
.admin-pagination__btn--active:hover:not(:disabled) {
  background-color: #4f46e5;
  border-color: #4f46e5;
}
.admin-pagination__dots {
  padding: 0 4px;
  color: #a0aec0;
  user-select: none;
}
.admin-form {
  display: grid;
  gap: 16px;
}
.admin-mobile-sort {
  display: none;
}
.admin-form__group {
  display: grid;
  gap: 4px;
}
.admin-form__group label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}
.admin-form__roles {
  display: grid;
  gap: 8px;
}
.admin-form__role {
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: 14px;
  gap: 8px;
}
.admin-form__role input {
  cursor: pointer;
  height: 16px;
  width: 16px;
}
.admin-form__error {
  font-size: 12px;
  color: #e53e3e;
  margin: 0;
  min-height: 16px;
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
.admin-form__hint {
  padding: 12px;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
  color: #1e40af;
}
.admin-input--readonly {
  background-color: #f9fafb !important;
  color: #6b7280 !important;
  cursor: not-allowed;
}
.form-divider {
  height: 1px;
  background-color: rgb(230, 230, 230);
  margin: 8px 0;
}
.form-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 4px 0;
}
.values-form {
  display: grid;
  gap: 14px;
}
.values-row {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 12px;
  align-items: center;
}
@media (max-width: 600px) {
  .values-row {
    grid-template-columns: 1fr;
  }
}
.values-row__label {
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}
.values-row__unit {
  color: #a0aec0;
  font-weight: 400;
}
.values-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  background-color: #fff;
  font-size: 13px;
  color: #2d3748;
  transition: all 0.3s;
}
.values-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
.type-props-manager {
  display: grid;
  gap: 24px;
}
.type-props__add-section {
  background-color: #f7fafc;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
}
.type-props__add-section label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 8px;
}
.type-props__add-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.type-props__add-row .admin-select {
  flex: 1;
  max-width: 100%;
}
.add-prop-btn {
  white-space: nowrap;
}
.type-props__hint {
  font-size: 12px;
  color: #a0aec0;
  margin-top: 8px;
  font-style: italic;
}
.type-props__list-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 12px 0;
}
.type-props__items {
  display: grid;
  gap: 8px;
}
.type-props__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: #fff;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  transition: background-color 0.15s;
}
.type-props__item:hover {
  background-color: #f7fafc;
}
.type-props__item-name {
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
}
.type-props__item-unit {
  color: #a0aec0;
  font-weight: 400;
  font-size: 12px;
}

/* ===================== МОБИЛЬНАЯ ВЕРСИЯ ===================== */
@media (max-width: 768px) {
  .admin-layout {
    min-height: 0;
  }

  /* Сайдбар: компактная верхняя панель с горизонтальной прокруткой навигации */
  .admin-sidebar {
    position: static;
    height: auto;
    border-right: none;
    border-bottom: 1px solid rgb(230, 230, 230);
    padding: 8px 0;
    box-shadow: none;
  }
  .admin-sidebar__header {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 8px;
  }
  .admin-sidebar__title {
    font-size: 16px;
  }
  .admin-sidebar__user-info {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  .admin-nav {
    flex-direction: row;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding: 4px 12px 10px;
    scrollbar-width: none;
  }
  .admin-nav::-webkit-scrollbar {
    display: none;
  }
  .admin-nav__group {
    display: flex;
    flex-direction: row;
    gap: 6px;
  }
  .admin-nav__group-title {
    display: none;
  }
  .admin-nav__link {
    width: auto;
    flex-shrink: 0;
    border: 1px solid rgb(230, 230, 230);
    border-left: 1px solid rgb(230, 230, 230);
    border-radius: 20px;
    padding: 9px 14px;
    font-size: 14px;
    background-color: #f7fafc;
    white-space: nowrap;
  }
  .admin-nav__link--active {
    border-color: #6366f1;
    background-color: #eef2ff;
  }

  /* Контент: уменьшаем отступы */
  .admin-content {
    padding: 12px;
    gap: 12px;
  }
  .admin-card {
    padding: 14px;
  }
  .admin-headbar {
    gap: 12px;
  }
  .admin-empty {
    padding: 24px 12px;
  }

  /* Сортировка: доступна только на мобильных (thead скрыт) */
  .admin-mobile-sort {
    display: flex;
    align-items: center;
    gap: 8px;
    grid-column: 1 / -1;
  }
  .admin-mobile-sort__field {
    flex: 1;
    max-width: none;
  }

  /* Селекты: 16px чтобы iOS не приближала страницу при фокусе */
  .admin-select,
  .admin-pagination__select {
    font-size: 16px;
    padding: 10px;
  }

  /* Таблица превращается в карточки */
  .admin-table-wrap {
    overflow: visible;
    padding: 0;
  }
  .admin-table thead {
    display: none;
  }
  .admin-table,
  .admin-table tbody {
    display: block;
  }
  .admin-table__row {
    display: block;
    margin: 12px;
    padding: 10px 14px;
    border: 1px solid rgb(230, 230, 230);
    border-radius: 10px;
    box-shadow: 2px 2px 16px -8px rgba(34, 60, 80, 0.15);
  }
  .admin-table__td {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid rgb(245, 245, 245);
    font-size: 14px;
  }
  .admin-table__td:last-child {
    border-bottom: none;
  }
  .admin-table__td::before {
    content: attr(data-label);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #a0aec0;
    flex-shrink: 0;
  }
  .admin-table__td--actions {
    justify-content: flex-end;
    gap: 4px;
  }
  .admin-table__td--actions::before {
    content: none;
  }

  /* Крупные кнопки действий под пальцы */
  .admin-table__btn {
    font-size: 20px;
    padding: 10px 12px;
  }

  /* Пагинация: в столбик, крупные кнопки */
  .admin-pagination {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px;
  }
  .admin-pagination__controls {
    justify-content: space-between;
    gap: 8px;
  }
  .admin-pagination__btn {
    min-width: 40px;
    height: 40px;
    font-size: 15px;
  }
}
</style>

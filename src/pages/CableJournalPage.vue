<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { projectsApi } from '@/api/projects'
import { cableLinesApi } from '@/api/cableLines'
import { referenceApi } from '@/api/reference'
import { downloadTxt, formatFileNameStamp, reportHeader, safeFileNamePart } from '@/utils/txtReport'
import AButton from '@/components/A-button.vue'
import AInput from '@/components/A-input.vue'
import AModal from '@/components/A-modal.vue'
import { useToast } from '@/composables/useToast'

defineProps(['projectId', 'assemblyId'])

const route = useRoute()
const authStore = useAuthStore()
const pageStore = usePageStore()
const toast = useToast()

const project = ref(null)
const cableLines = ref([])
const cableTypes = ref([])
const crossSections = ref([])
const isLoadingLines = ref(true)

const searchBar = ref('')
const sortKey = ref('id')
const sortDir = ref('asc')

const columns = [
  { key: 'linePurpose', label: 'Назначение' },
  { key: 'startPoint', label: 'Откуда' },
  { key: 'endPoint', label: 'Куда' },
  { key: 'length', label: 'Длина (м)' },
  { key: 'cableTypeName', label: 'Марка кабеля' },
  { key: 'coreCount', label: 'Жилы' },
  { key: 'crossSectionValue', label: 'Сечение' },
  { key: 'notes', label: 'Примечание' },
]

const hasLines = computed(() => cableLines.value.length > 0)

const numsById = computed(() => {
  const ordered = [...filteredLines.value].sort((a, b) => a.id - b.id)
  return new Map(ordered.map((line, index) => [line.id, index + 1]))
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortArrow(key) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

const filteredLines = computed(() => {
  const query = searchBar.value.trim().toLowerCase()
  if (!query) return cableLines.value

  return cableLines.value.filter((line) =>
    [line.linePurpose, line.startPoint, line.endPoint, line.cableTypeName, line.notes].some(
      (value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
    ),
  )
})

const sortedLines = computed(() => {
  const lines = [...filteredLines.value]
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1

  return lines.sort((a, b) => {
    if (key === 'id') return (a.id - b.id) * dir

    const aValue = a[key]
    const bValue = b[key]

    if (key === 'length' || key === 'coreCount' || key === 'crossSectionValue') {
      return ((Number(aValue) || 0) - (Number(bValue) || 0)) * dir
    }

    return (
      String(aValue ?? '').localeCompare(String(bValue ?? ''), 'ru', {
        numeric: true,
        sensitivity: 'base',
      }) * dir
    )
  })
})

async function loadProject() {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
    pageStore.setEntity(project.value.codeName)
  } catch (error) {
    console.error('Ошибка загрузки проекта:', error)
    toast.error('Ошибка загрузки проекта')
    project.value = { codeName: 'Неизвестный проект' }
    pageStore.setEntity(project.value.codeName)
  }
}

async function loadCableLines() {
  isLoadingLines.value = true
  try {
    cableLines.value = (await cableLinesApi.getLines(route.params.projectId)) || []
  } catch (error) {
    console.error('Ошибка загрузки кабельного журнала:', error)
    toast.error('Не удалось загрузить кабельные линии')
  } finally {
    isLoadingLines.value = false
  }
}

async function loadDirectories() {
  const [typesResult, sectionsResult] = await Promise.allSettled([
    referenceApi.getCableTypes(),
    referenceApi.getCrossSections(),
  ])

  if (typesResult.status === 'fulfilled') {
    cableTypes.value = (typesResult.value || []).map((type) => ({
      id: type.id ?? type.Id,
      name: type.name ?? type.Name ?? `Тип #${type.id ?? type.Id}`,
    }))
  } else {
    console.error('Ошибка загрузки типов кабелей:', typesResult.reason)
    toast.error('Не удалось загрузить типы кабелей')
  }

  if (sectionsResult.status === 'fulfilled') {
    crossSections.value = (sectionsResult.value || []).map((section) => ({
      id: section.id ?? section.Id,
      value: section.value ?? section.Value ?? 0,
    }))
  } else {
    console.error('Ошибка загрузки сечений:', sectionsResult.reason)
    toast.error('Не удалось загрузить сечения')
  }
}

onMounted(async () => {
  await Promise.all([loadProject(), loadCableLines(), loadDirectories()])
  pageStore.setEntity(project.value?.codeName)
  await authStore.fetchMe()
})

const showLineModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const formError = ref('')

const emptyLineForm = () => ({
  id: null,
  linePurpose: '',
  startPoint: '',
  endPoint: '',
  length: '',
  cableTypeId: '',
  coreCount: '',
  crossSectionId: '',
  notes: '',
})

const lineForm = reactive(emptyLineForm())

const formTitle = computed(() =>
  isEditing.value ? 'Редактирование линии' : 'Новая кабельная линия',
)
const formSubtitle = computed(() =>
  isEditing.value
    ? 'Измените параметры линии и сохраните изменения.'
    : 'Укажите параметры кабельной линии для журнала.',
)

function resetForm() {
  Object.assign(lineForm, emptyLineForm())
  formError.value = ''
}

function openCreateModal() {
  resetForm()
  isEditing.value = false
  showLineModal.value = true
}

function openEditModal(line) {
  resetForm()
  lineForm.id = line.id
  lineForm.linePurpose = line.linePurpose || ''
  lineForm.startPoint = line.startPoint || ''
  lineForm.endPoint = line.endPoint || ''
  lineForm.length = line.length ?? ''
  lineForm.cableTypeId = line.cableTypeId || ''
  lineForm.coreCount = line.coreCount ?? ''
  lineForm.crossSectionId = line.crossSectionId || ''
  lineForm.notes = line.notes || ''
  isEditing.value = true
  showLineModal.value = true
}

function closeLineModal() {
  if (isSaving.value) return
  showLineModal.value = false
  formError.value = ''
}

const isFormValid = computed(
  () =>
    lineForm.linePurpose.trim() !== '' &&
    Number(lineForm.length) > 0 &&
    lineForm.cableTypeId !== null &&
    lineForm.cableTypeId !== '' &&
    lineForm.crossSectionId !== null &&
    lineForm.crossSectionId !== '',
)

function validateForm() {
  if (!lineForm.linePurpose.trim()) return 'Укажите назначение линии.'
  if (!(Number(lineForm.length) > 0)) return 'Укажите длину больше нуля.'
  if (!lineForm.cableTypeId) return 'Выберите марку кабеля.'
  if (!lineForm.crossSectionId) return 'Выберите сечение кабеля.'
  return ''
}

const normStr = (value) => (value ?? '').toString().trim() || null

function findIdenticalLine(data, excludeId = null) {
  return cableLines.value.find(
    (line) =>
      line.id !== excludeId &&
      normStr(line.linePurpose) === normStr(data.LinePurpose) &&
      normStr(line.startPoint) === normStr(data.StartPoint) &&
      normStr(line.endPoint) === normStr(data.EndPoint) &&
      Number(line.length) === Number(data.Length) &&
      Number(line.cableTypeId) === Number(data.CableTypeId) &&
      (line.coreCount ?? null) === data.CoreCount &&
      Number(line.crossSectionId) === Number(data.CrossSectionId) &&
      normStr(line.notes) === normStr(data.Notes),
  )
}

function buildPayload() {
  return {
    LinePurpose: lineForm.linePurpose.trim(),
    StartPoint: lineForm.startPoint.trim(),
    EndPoint: lineForm.endPoint.trim(),
    Length: Number(lineForm.length),
    CableTypeId: Number(lineForm.cableTypeId),
    CoreCount: lineForm.coreCount ? Number(lineForm.coreCount) : null,
    CrossSectionId: Number(lineForm.crossSectionId),
    Notes: lineForm.notes.trim(),
  }
}

async function saveLine() {
  if (isSaving.value) return

  const validationError = validateForm()
  if (validationError) {
    formError.value = validationError
    return
  }

  const duplicate = findIdenticalLine(buildPayload(), isEditing.value ? lineForm.id : null)
  if (duplicate) {
    formError.value = 'Такая кабельная линия уже существует.'
    return
  }

  isSaving.value = true
  formError.value = ''

  try {
    if (isEditing.value) {
      await cableLinesApi.updateLine(route.params.projectId, lineForm.id, buildPayload())
      toast.success('Линия обновлена')
    } else {
      await cableLinesApi.createLine(route.params.projectId, buildPayload())
      toast.success('Линия добавлена')
    }

    showLineModal.value = false
    await loadCableLines()
  } catch (error) {
    console.error('Ошибка сохранения кабельной линии:', error)
    toast.error(error.response?.data?.message || 'Не удалось сохранить линию')
  } finally {
    isSaving.value = false
  }
}

async function deleteLine(line) {
  if (!window.confirm(`Удалить кабельную линию № ${numsById.value.get(line.id)}?`)) return

  try {
    await cableLinesApi.deleteLine(route.params.projectId, line.id)
    toast.success('Линия удалена')
    await loadCableLines()
  } catch (error) {
    console.error('Ошибка удаления кабельной линии:', error)
    toast.error('Не удалось удалить линию')
  }
}

async function dublicateCableLine() {
  if (isSaving.value) return

  const validationError = validateForm()
  if (validationError) {
    formError.value = validationError
    return
  }

  if (findIdenticalLine(buildPayload())) {
    formError.value = 'Такая кабельная линия уже существует.'
    return
  }

  isSaving.value = true
  formError.value = ''

  try {
    await cableLinesApi.createLine(route.params.projectId, buildPayload())
    toast.success('Линия добавлена')
    showLineModal.value = false
    await loadCableLines()
  } catch (error) {
    console.error('Ошибка дублирования кабельной линии:', error)
    toast.error(error.response?.data?.message || 'Не удалось создать дубликат')
  } finally {
    isSaving.value = false
  }
}

const showSummaryModal = ref(false)
const summary = ref([])
const summaryLoading = ref(false)

async function openSummary() {
  showSummaryModal.value = true
  summaryLoading.value = true

  try {
    summary.value = (await cableLinesApi.getCableSummary(route.params.projectId)) || []
  } catch (error) {
    console.error('Ошибка загрузки сводки:', error)
    toast.error('Не удалось загрузить сводку')
  } finally {
    summaryLoading.value = false
  }
}

const totalSummaryLength = computed(() =>
  summary.value.reduce((total, item) => total + Number(item.totalLength || 0), 0),
)

function exportToTxt() {
  const now = new Date()
  const groups = new Map()

  for (const line of cableLines.value) {
    const key = `${line.cableTypeId}|${line.coreCount}|${line.crossSectionId}`
    const group = groups.get(key)
    if (group) {
      group.length += Number(line.length) || 0
      continue
    }

    groups.set(key, {
      cableTypeName: line.cableTypeName || '',
      coreCount: Number(line.coreCount) || 0,
      crossSectionValue: Number(line.crossSectionValue) || 0,
      length: Number(line.length) || 0,
    })
  }

  const rows = [...groups.values()]
    .sort(
      (a, b) =>
        a.cableTypeName.localeCompare(b.cableTypeName, 'ru') ||
        a.coreCount - b.coreCount ||
        a.crossSectionValue - b.crossSectionValue,
    )
    .map((group, index) => {
      const mark = `${group.coreCount || ''}x${group.crossSectionValue}`
      const name = [group.cableTypeName, mark].filter(Boolean).join(' ')
      return `${index + 1}. ${name || '—'} - ${Math.trunc(group.length)} м.`
    })

  const fileName = `Кабельный_журнал_${safeFileNamePart(project.value?.codeName)}_${formatFileNameStamp(now)}.txt`
  downloadTxt(fileName, [...reportHeader(project.value, now), ...rows])
  toast.success('Скачивание файла')
}
</script>

<template>
  <div class="global-container">
    <main class="cable-page">
      <header class="cable__header">
        <div class="cable__heading">
          <div class="cable__breadcrumb admin-headbar__info">
            <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
            <span class="admin-headbar__separator">/</span>
            <span>Кабельный журнал</span>
          </div>

          <div class="cable__title-row">
            <span class="cable__title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path d="M7 3v4M17 3v4M5 7h14v3a7 7 0 0 1-14 0Z" />
                <path d="M12 17v4M8 21h8M8 10v3M12 10v4M16 10v3" />
              </svg>
            </span>
            <div>
              <div class="cable__title-line">
                <h1 class="cable__title">Кабельный журнал</h1>
                <span v-if="!isLoadingLines" class="cable__count-badge">{{
                  cableLines.length
                }}</span>
              </div>
              <p class="cable__subtitle">Учёт кабельных линий и сводка по маркам кабеля</p>
            </div>
          </div>
        </div>

        <div class="cable__header-actions">
          <AButton v-if="hasLines" class="cable__summary-btn" @click="openSummary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Z" />
              <path d="M9 8h6M9 12h4" />
            </svg>
            <span>Сводка</span>
          </AButton>
          <a-button
            v-if="authStore.isAdmin"
            class="files__upload"
            :disabled="isSaving"
            @click="openCreateModal"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
            </svg>
            <span>{{ isSaving ? 'Добавление…' : 'Добавить линию' }}</span>
          </a-button>
        </div>
      </header>

      <section
        v-if="!isLoadingLines && (hasLines || searchBar.trim())"
        class="cable__toolbar"
        aria-label="Поиск кабельных линий"
      >
        <label class="cable__search">
          <span>Поиск</span>
          <div class="cable__search-control">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <AInput v-model="searchBar" placeholder="По назначению, точкам или марке..." />
          </div>
        </label>

        <div class="cable__toolbar-actions">
          <span class="cable__result-count">
            {{
              searchBar.trim() ? `Найдено: ${filteredLines.length}` : `Всего: ${cableLines.length}`
            }}
          </span>
          <button v-if="searchBar.trim()" class="cable__reset" @click="searchBar = ''">
            Сбросить
          </button>
        </div>
      </section>

      <div
        v-if="isLoadingLines"
        class="cable__table-card cable-loading"
        aria-label="Загрузка журнала"
      >
        <div v-for="item in 7" :key="item" class="cable-loading__row">
          <div class="skeleton-shimmer cable-loading__number"></div>
          <div v-for="cell in 6" :key="cell" class="skeleton-shimmer cable-loading__cell"></div>
        </div>
      </div>

      <div v-else-if="sortedLines.length === 0" class="cable__state">
        <div class="cable__state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7 3v4M17 3v4M5 7h14v3a7 7 0 0 1-14 0Z" />
            <path d="M12 17v4M8 21h8M8 10v3M12 10v4M16 10v3" />
          </svg>
        </div>
        <template v-if="searchBar.trim()">
          <h2>Кабельные линии не найдены</h2>
          <p>По запросу «{{ searchBar }}» ничего не найдено.</p>
          <AButton class="cable__state-action" @click="searchBar = ''">Сбросить поиск</AButton>
        </template>
        <template v-else>
          <h2>В журнале нет ни одной кабельной линии</h2>
          <p>Добавьте первую линию, чтобы начать вести кабельный журнал.</p>
        </template>
      </div>

      <div v-else class="cable__table-card">
        <div class="cable-table-wrap">
          <table class="cable-table">
            <thead>
              <tr>
                <th class="cable-table__number">
                  <button
                    class="cable-table__sort cable-table__sort--number"
                    title="Сортировать по порядку добавления"
                    @click="toggleSort('id')"
                  >
                    <span>№</span>
                    <span class="cable-table__arrow">{{ sortArrow('id') }}</span>
                  </button>
                </th>
                <th v-for="column in columns" :key="column.key">
                  <button class="cable-table__sort" @click="toggleSort(column.key)">
                    <span>{{ column.label }}</span>
                    <span class="cable-table__arrow">{{ sortArrow(column.key) }}</span>
                  </button>
                </th>
                <th v-if="authStore.isAdmin" class="cable-table__actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in sortedLines" :key="line.id">
                <td class="cable-table__number">
                  <span class="cable-table__num">{{ numsById.get(line.id) }}</span>
                </td>
                <td class="cable-table__purpose">{{ line.linePurpose || '—' }}</td>
                <td>{{ line.startPoint || '—' }}</td>
                <td>{{ line.endPoint || '—' }}</td>
                <td class="cable-table__numeric">{{ line.length }} м</td>
                <td>{{ line.cableTypeName || '—' }}</td>
                <td class="cable-table__numeric">{{ line.coreCount ?? '—' }}</td>
                <td class="cable-table__numeric">
                  {{ line.crossSectionValue == null ? '—' : `${line.crossSectionValue} мм²` }}
                </td>
                <td class="cable-table__notes">{{ line.notes || '—' }}</td>
                <td v-if="authStore.isAdmin" class="cable-table__actions">
                  <div class="cable-table__action-buttons">
                    <button
                      class="cable-table__action cable-table__action--edit"
                      title="Редактировать"
                      aria-label="Редактировать линию"
                      @click="openEditModal(line)"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      class="cable-table__action cable-table__action--delete"
                      title="Удалить"
                      aria-label="Удалить линию"
                      @click="deleteLine(line)"
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
      :title="formTitle"
      :opened="showLineModal"
      class="line-modal"
      @close-emit="closeLineModal"
    >
      <div class="line-form">
        <div class="line-form__intro">
          <h3>{{ formTitle }}</h3>
          <p>{{ formSubtitle }}</p>
        </div>

        <div class="form-group">
          <label for="line-purpose">Назначение *</label>
          <AInput
            id="line-purpose"
            v-model="lineForm.linePurpose"
            placeholder="Например: питание насоса"
            :disabled="isSaving"
          />
        </div>

        <div class="line-form__row">
          <div class="form-group">
            <label for="line-start">Откуда</label>
            <AInput
              id="line-start"
              v-model="lineForm.startPoint"
              placeholder="Например: Щит питания"
              :disabled="isSaving"
            />
          </div>
          <div class="form-group">
            <label for="line-end">Куда</label>
            <AInput
              id="line-end"
              v-model="lineForm.endPoint"
              placeholder="Например: Насос Н1"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div class="line-form__row">
          <div class="form-group">
            <label for="line-length">Длина, м *</label>
            <AInput
              id="line-length"
              v-model="lineForm.length"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0"
              :disabled="isSaving"
            />
          </div>
          <div class="form-group">
            <label for="line-cores">Количество жил</label>
            <AInput
              id="line-cores"
              v-model="lineForm.coreCount"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              :disabled="isSaving"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="line-type">Марка кабеля *</label>
          <select
            id="line-type"
            v-model="lineForm.cableTypeId"
            class="form-select"
            :disabled="isSaving"
          >
            <option value="">Выберите марку кабеля</option>
            <option v-for="type in cableTypes" :key="type.id" :value="type.id">
              {{ type.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="line-section">Сечение кабеля *</label>
          <select
            id="line-section"
            v-model="lineForm.crossSectionId"
            class="form-select"
            :disabled="isSaving"
          >
            <option value="">Выберите сечение</option>
            <option v-for="section in crossSections" :key="section.id" :value="section.id">
              {{ section.value }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="line-notes">Примечание</label>
          <AInput
            id="line-notes"
            v-model="lineForm.notes"
            placeholder="Дополнительная информация"
            :disabled="isSaving"
          />
        </div>

        <p v-if="formError" class="line-form__error">{{ formError }}</p>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="modal-cancel" :disabled="isSaving" @click="closeLineModal">Отмена</button>
          <AButton
            v-if="isEditing"
            class="line-form__duplicate"
            :disabled="!isFormValid || isSaving"
            @click="dublicateCableLine"
          >
            Дублировать
          </AButton>
          <AButton class="line-form__submit" :disabled="!isFormValid || isSaving" @click="saveLine">
            {{ isSaving ? 'Сохранение…' : isEditing ? 'Сохранить' : 'Добавить' }}
          </AButton>
        </div>
      </template>
    </AModal>

    <AModal
      :title="`Сводка по кабельным линиям ${project?.codeName || ''}`"
      :opened="showSummaryModal"
      class="summary-modal"
      sticky
      @close-emit="showSummaryModal = false"
    >
      <div v-if="summaryLoading" class="summary-state">
        <span class="summary-spinner" aria-hidden="true"></span>
        <p>Формируем сводку…</p>
      </div>

      <div v-else-if="summary.length" class="summary-table-wrap">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Марка кабеля</th>
              <th>Жилы</th>
              <th>Сечение</th>
              <th>Кол-во линий</th>
              <th>Общая длина</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in summary"
              :key="`${item.cableTypeId}-${item.coreCount}-${item.crossSectionId}`"
            >
              <td>{{ item.cableTypeName }}</td>
              <td>{{ item.coreCount ?? '—' }}</td>
              <td>{{ item.crossSectionValue }} мм²</td>
              <td>{{ item.linesCount }}</td>
              <td>{{ Math.round(item.totalLength) }} м</td>
            </tr>
            <tr class="summary-total-row">
              <td colspan="4">Всего</td>
              <td>{{ Math.round(totalSummaryLength) }} м</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="summary-state">
        <div class="summary-state__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-3-7 3V5a2 2 0 0 1 2-2Z" />
            <path d="M9 8h6M9 12h4" />
          </svg>
        </div>
        <p>Нет данных для сводки.</p>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="modal-cancel" @click="showSummaryModal = false">Закрыть</button>
          <AButton class="summary-export-btn" :disabled="!hasLines" @click="exportToTxt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            Экспорт TXT
          </AButton>
        </div>
      </template>
    </AModal>
  </div>
</template>

<style scoped>
.global-container {
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.cable-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.cable__header {
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

.cable__heading {
  min-width: 0;
}

.cable__breadcrumb {
  margin-bottom: 14px;
  color: #8a8f98;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.admin-headbar__project {
  color: #4b5563;
  font-weight: 600;
}

.admin-headbar__separator {
  margin: 0 8px;
  color: #cbd5e0;
}

.cable__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.cable__title-icon {
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

.cable__title-icon svg {
  width: 23px;
  height: 23px;
}

.cable__title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cable__title {
  margin: 0;
  color: #2d3748;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.2;
}

.cable__count-badge {
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

.cable__subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.45;
}

.cable__header-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cable__summary-btn.btn,
.files__upload.btn {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  width: 100% !important;
  min-height: 40px !important;
  padding: 9px 14px !important;
  border-radius: 8px !important;
  background: #1f1f1f !important;
  color: #fff !important;
  border-color: #1f1f1f !important;
  font-size: 14px !important;
  font-weight: 500 !important;
}

.cable__summary-btn.btn:hover,
.files__upload.btn:hover {
  background: #fff !important;
  color: #292929 !important;
  border-color: #d1d1d5 !important;
}

.cable__summary-btn.btn:disabled,
.files__upload.btn:disabled,
.cable__summary-btn.btn:hover:disabled,
.files__upload.btn:hover:disabled {
  background: #afafaf !important;
  color: aliceblue !important;
  border-color: #afafaf !important;
  cursor: default !important;
}

.cable__summary-btn svg,
.files__upload svg {
  width: 18px !important;
  height: 18px !important;
}

.cable__toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
}

.cable__search {
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

.cable__search-control {
  position: relative;
}

.cable__search-control > svg {
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

.cable__search-control :deep(.input) {
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

.cable__search-control :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.cable__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cable__result-count {
  margin-right: auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.cable__reset {
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

.cable__reset:hover {
  background: #eef2ff;
}

.cable__table-card {
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
}

.cable-table-wrap {
  overflow-x: auto;
}

.cable-table {
  width: 100%;
  min-width: 1080px;
  border-collapse: separate;
  border-spacing: 0;
  color: #4b5563;
  font-size: 13px;
}

.cable-table th {
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

.cable-table td {
  height: 52px;
  padding: 10px 12px;
  border-bottom: 1px solid #eff1f4;
  vertical-align: middle;
}

.cable-table tbody tr:last-child td {
  border-bottom: 0;
}

.cable-table tbody tr {
  transition: background 0.16s ease;
}

.cable-table tbody tr:hover {
  background: #fafaff;
}

.cable-table__sort {
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

.cable-table__sort:hover {
  color: #4f46e5;
}

.cable-table__arrow {
  color: #a5aab4;
  font-size: 13px;
  line-height: 1;
}

.cable-table__sort:hover .cable-table__arrow {
  color: #6366f1;
}

.cable-table__number {
  width: 56px;
  padding-left: 16px !important;
  text-align: center !important;
}

.cable-table__num {
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
}

.cable-table__purpose {
  min-width: 160px;
  color: #374151;
  font-weight: 600;
}

.cable-table__numeric {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.cable-table__notes {
  min-width: 160px;
  max-width: 240px;
  color: #8a8f98;
}

.cable-table__actions {
  width: 104px;
  padding-right: 16px !important;
  text-align: right !important;
}

.cable-table__action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.cable-table__action {
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

.cable-table__action svg {
  width: 15px;
  height: 15px;
}

.cable-table__action--edit:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}

.cable-table__action--delete:hover {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.cable-loading {
  padding: 6px 16px;
}

.cable-loading__row {
  display: grid;
  grid-template-columns: 48px repeat(6, minmax(90px, 1fr));
  align-items: center;
  gap: 20px;
  height: 52px;
  border-bottom: 1px solid #eff1f4;
}

.cable-loading__row:last-child {
  border-bottom: 0;
}

.cable-loading__number,
.cable-loading__cell {
  height: 10px;
  border-radius: 999px;
  background: #eef0f3;
}

.cable-loading__number {
  width: 28px;
}

.cable-loading__cell:nth-child(3n) {
  width: 72%;
}

.cable-loading__cell:nth-child(3n + 1) {
  width: 84%;
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
  animation: cable-skeleton-slide 1.4s infinite;
}

@keyframes cable-skeleton-slide {
  to {
    transform: translateX(100%);
  }
}

.cable__state {
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

.cable__state-icon {
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

.cable__state-icon svg {
  width: 30px;
  height: 30px;
}

.cable__state h2 {
  margin: 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.cable__state p {
  max-width: 460px;
  margin: 8px 0 0;
  color: #8a8f98;
  font-size: 14px;
  line-height: 1.55;
}

.cable__state-action.btn {
  min-height: 38px;
  margin-top: 20px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
}

.line-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.line-form__intro h3 {
  margin: 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.line-form__intro p {
  margin: 6px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.5;
}

.line-form__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.form-group label {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.form-group :deep(.input),
.form-select {
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
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-select {
  appearance: none;
  padding-right: 34px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-position: right 10px center;
  background-repeat: no-repeat;
  cursor: pointer;
}

.form-group :deep(.input):focus,
.form-select:focus {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-group :deep(.input):disabled,
.form-select:disabled {
  background-color: #f8fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.line-form__error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
  line-height: 1.45;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.modal-cancel,
.modal-actions .btn {
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
  cursor: pointer;
}

.modal-cancel:hover:not(:disabled) {
  border-color: #cbd5e0;
  background: #f9fafb;
  color: #374151;
}

.modal-cancel:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.line-form__duplicate.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
}

.line-form__duplicate.btn:hover {
  border-color: #a5b4fc;
  background: #e0e7ff;
}

.summary-state {
  display: flex;
  min-height: 220px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8a8f98;
  font-size: 14px;
  text-align: center;
}

.summary-state p {
  margin: 0;
}

.summary-state__icon {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 16px;
  background: #eef2ff;
  color: #6366f1;
}

.summary-state__icon svg {
  width: 26px;
  height: 26px;
}

.summary-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: summary-spin 0.8s linear infinite;
}

@keyframes summary-spin {
  to {
    transform: rotate(360deg);
  }
}

.summary-table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.summary-table {
  width: 100%;
  min-width: 620px;
  border-collapse: separate;
  border-spacing: 0;
  color: #4b5563;
  font-size: 14px;
}

.summary-table th {
  padding: 11px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafc;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

.summary-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #eff1f4;
}

.summary-table th:nth-child(n + 2),
.summary-table td:nth-child(n + 2) {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.summary-table tbody tr:last-child td {
  border-bottom: 0;
}

.summary-total-row td {
  border-top: 1px solid #e5e7eb;
  background: #f8f9ff;
  color: #3730a3;
  font-weight: 600;
}

.summary-export-btn.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.summary-export-btn svg {
  width: 17px;
  height: 17px;
}

@media (min-width: 640px) {
  .cable__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
  }

  .cable__header-actions {
    flex-direction: row;
    flex: 0 0 auto;
  }

  .cable__summary-btn.btn,
  .files__upload.btn {
    width: auto !important;
  }

  .cable__toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
  }

  .cable__search {
    width: min(100%, 520px);
  }

  .cable__toolbar-actions {
    flex: 0 0 auto;
  }

  .cable__result-count {
    margin-right: 0;
  }

  .line-form__row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
}

@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .cable-page {
    gap: 20px;
  }

  .cable__header {
    padding: 24px;
  }

  .cable__breadcrumb {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .cable__title-icon {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .cable__title {
    font-size: 26px;
  }

  .cable__subtitle {
    font-size: 14px;
  }

  .cable__summary-btn.btn,
  .files__upload.btn {
    min-height: 42px !important;
    padding: 10px 16px !important;
    font-size: 15px !important;
  }

  .cable__toolbar {
    padding: 14px 16px;
  }

  .cable__search-control :deep(.input) {
    padding-inline: 36px 12px;
    font-size: 14px;
  }

  .cable__state {
    min-height: 380px;
    padding: 48px 24px;
  }
}

@media (max-width: 600px) {
  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-cancel,
  .modal-actions .btn {
    width: 100%;
  }

  .cable-table-wrap {
    scrollbar-width: thin;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .global-container {
    padding: max(8px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
      max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  }

  .cable-page {
    gap: 10px;
  }

  .cable__header {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }

  .cable__breadcrumb {
    margin-bottom: 4px;
  }

  .cable__title-icon {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .cable__title {
    font-size: 20px;
  }

  .cable__subtitle {
    display: none;
  }

  .cable__header-actions {
    flex: 0 0 auto;
    flex-direction: row;
  }

  .cable__toolbar {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
  }

  .cable__search {
    flex: 1;
    min-width: 0;
  }

  .cable__search-control :deep(.input) {
    min-height: 38px;
  }

  .cable__state {
    min-height: 0;
    padding: 24px 16px;
  }

  .cable-table-wrap,
  .summary-table-wrap {
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .line-form__row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .modal-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .modal-cancel,
  .modal-actions .btn {
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cable-table tbody tr,
  .cable__reset,
  .cable-table__action {
    transition: none;
  }

  .skeleton-shimmer::after,
  .summary-spinner {
    animation: none;
  }
}
</style>

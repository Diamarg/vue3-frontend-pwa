<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, computed, onMounted, watch } from 'vue'
import Ainput from '@/components/A-input.vue'
import AModal from '@/components/A-modal.vue'
import Abutton from '@/components/A-button.vue'
import { projectsApi } from '@/api/projects'
import { cableLinesApi } from '@/api/cableLines'
import { referenceApi } from '@/api/reference'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

defineProps(['projectId', 'assemblyId'])

const project = ref(null)
const cableLines = ref([])
const cableTypes = ref([])
const crossSections = ref([])

const authStore = useAuthStore()
const pageStore = usePageStore()

// ===================== ПОИСК И СОРТИРОВКА =====================
const searchBar = ref('')
const sortKey = ref('id')
const sortDir = ref('asc')
const isSaving = ref(false)

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

const getSortValue = (item, key) => {
  if (key === 'id') return item.id
  const val = item[key]
  if (val === null || val === undefined) return ''
  return val
}

const isNumericSort = (key) => ['id', 'length', 'coreCount', 'crossSectionValue'].includes(key)

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

const loadCableLines = async () => {
  try {
    cableLines.value = await cableLinesApi.getLines(route.params.projectId)
  } catch (error) {
    toast.error('Не удалось загрузить кабельные линии')
    console.error('Не удалось загрузить кабельные линии', error)
  }
}

const loadCableTypes = async () => {
  try {
    const raw = await referenceApi.getCableTypes()
    cableTypes.value = (raw || []).map((t) => ({
      id: t.id ?? t.Id,
      name: t.name ?? t.Name ?? `Тип #${t.id ?? t.Id}`,
    }))
  } catch (error) {
    toast.error('Не удалось загрузить типы кабелей')
    console.error('Не удалось загрузить типы кабелей', error)
  }
}

const loadCrossSections = async () => {
  try {
    const raw = await referenceApi.getCrossSections()
    crossSections.value = (raw || []).map((s) => ({
      id: s.id ?? s.Id,
      value: s.value ?? s.Value ?? 0,
    }))
  } catch (error) {
    toast.error('Не удалось загрузить сечения')
    console.error('Не удалось загрузить сечения', error)
  }
}

// ===================== ФИЛЬТРАЦИЯ И СОРТИРОВКА =====================
const filteredLines = computed(() => {
  const q = searchBar.value.trim().toLowerCase()
  if (!q) return cableLines.value

  return cableLines.value.filter((it) =>
    ['linePurpose', 'startPoint', 'endPoint', 'cableTypeName', 'notes'].some((k) =>
      String(it[k] ?? '')
        .toLowerCase()
        .includes(q),
    ),
  )
})

const sortedLines = computed(() => {
  const arr = [...filteredLines.value]
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

// ===================== МОДАЛКА ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ =====================
const showLineModal = ref(false)
const editingLine = ref(null)

const lineForm = ref({
  linePurpose: '',
  startPoint: '',
  endPoint: '',
  length: 0,
  cableTypeId: null,
  coreCount: null,
  crossSectionId: null,
  notes: '',
})

const resetLineForm = () => {
  lineForm.value = {
    linePurpose: '',
    startPoint: '',
    endPoint: '',
    length: 0,
    cableTypeId: null,
    coreCount: null,
    crossSectionId: null,
    notes: '',
  }
}

const openCreateModal = () => {
  editingLine.value = null
  resetLineForm()
  showLineModal.value = true
}

const openEditModal = (line) => {
  editingLine.value = line
  lineForm.value = {
    linePurpose: line.linePurpose || '',
    startPoint: line.startPoint || '',
    endPoint: line.endPoint || '',
    length: line.length || 0,
    cableTypeId: line.cableTypeId ?? null,
    coreCount: line.coreCount ?? null,
    crossSectionId: line.crossSectionId ?? null,
    notes: line.notes || '',
  }
  showLineModal.value = true
}

watch(showLineModal, (isOpen) => {
  if (!isOpen) {
    editingLine.value = null
    resetLineForm()
  }
})

const isFormValid = computed(() => {
  return (
    lineForm.value.linePurpose.trim() !== '' &&
    lineForm.value.length > 0 &&
    lineForm.value.cableTypeId !== null &&
    lineForm.value.crossSectionId !== null
  )
})

const saveLine = async () => {
  if (!isFormValid.value) {
    toast.error('Заполните обязательные поля')
    return
  }

  isSaving.value = true
  try {
    const data = {
      LinePurpose: lineForm.value.linePurpose.trim(),
      StartPoint: lineForm.value.startPoint.trim(),
      EndPoint: lineForm.value.endPoint.trim(),
      Length: Number(lineForm.value.length),
      CableTypeId: Number(lineForm.value.cableTypeId),
      CoreCount: lineForm.value.coreCount ? Number(lineForm.value.coreCount) : null,
      CrossSectionId: Number(lineForm.value.crossSectionId),
      Notes: lineForm.value.notes.trim(),
    }

    if (editingLine.value) {
      await cableLinesApi.updateLine(route.params.projectId, editingLine.value.id, data)
      toast.success('Линия обновлена')
    } else {
      await cableLinesApi.createLine(route.params.projectId, data)
      toast.success('Линия добавлена')
    }
    showLineModal.value = false
    await loadCableLines()
  } catch (error) {
    console.error('Ошибка сохранения линии:', error)
    toast.error(error.response?.data || 'Не удалось сохранить линию')
  } finally {
    isSaving.value = false
  }
}

// ===================== УДАЛЕНИЕ ЛИНИИ =====================
const deleteLine = async (line) => {
  const label = line.linePurpose || `Линия #${line.id}`
  if (!confirm(`Удалить "${label}"?`)) return
  try {
    await cableLinesApi.deleteLine(route.params.projectId, line.id)
    toast.success('Линия удалена')
    await loadCableLines()
  } catch (error) {
    console.error('Ошибка удаления линии:', error)
    toast.error('Не удалось удалить линию')
  }
}

// ===================== ЭКСПОРТ В TXT =====================
const exportToTxt = async () => {
  try {
    const blob = await cableLinesApi.exportToTxt(route.params.projectId)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Ведомость_кабелей_${project.value?.codeName || 'project'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    toast.success('Ведомость экспортирована')
  } catch (error) {
    console.error('Ошибка экспорта:', error)
    toast.error('Не удалось экспортировать ведомость')
  }
}

// ===================== СВОДКА =====================
const showSummaryModal = ref(false)
const summary = ref([])
const summaryLoading = ref(false)

const openSummary = async () => {
  showSummaryModal.value = true
  summaryLoading.value = true
  try {
    summary.value = await cableLinesApi.getCableSummary(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки сводки:', error)
    toast.error('Не удалось загрузить сводку')
  } finally {
    summaryLoading.value = false
  }
}

const totalSummaryLength = computed(() =>
  summary.value.reduce((acc, s) => acc + Number(s.totalLength || 0), 0),
)

onMounted(async () => {
  await loadProject()
  pageStore.pageInfo.name = `Кабельный журнал: ${project.value?.codeName || 'Проект'}`
  await Promise.all([loadCableLines(), loadCableTypes(), loadCrossSections()])
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <!-- === ХЕДЕР В СТИЛЕ ГАЛЕРЕИ === -->
    <div class="gallery__header assembly-header">
      <div class="assembly-header__info">
        <div class="admin-headbar__info">
          <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
          <span class="admin-headbar__separator">/</span>
          <span class="admin-headbar__assembly">Кабельный журнал</span>
        </div>
        <div class="admin-headbar__search">
          <Ainput
            class="admin-headbar__search-input"
            v-model="searchBar"
            placeholder="Поиск по назначению, точкам, марке..."
          />
        </div>
      </div>

      <div class="assembly-header__actions">
        <a class="admin-headbar__back-btn" @click="router.back()">← Назад</a>
        <Abutton @click="openSummary" class="summary-btn">📊 Сводка</Abutton>
        <Abutton @click="exportToTxt" class="export-btn">⬇ Экспорт</Abutton>
        <Abutton v-if="authStore.isAdmin" @click="openCreateModal" class="add-line-btn">
          + Добавить линию
        </Abutton>
      </div>
    </div>

    <!-- === ТАБЛИЦА === -->
    <div class="admin-card admin-table-wrap">
      <div v-if="sortedLines.length === 0" class="admin-empty">
        {{
          searchBar
            ? `По запросу «${searchBar}» ничего не найдено`
            : 'В этом проекте пока нет кабельных линий. Нажмите "Добавить линию"'
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
            <th v-if="authStore.isAdmin" class="admin-table__th admin-table__th--actions">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in sortedLines" :key="line.id" class="admin-table__row">
            <td class="admin-table__td admin-table__td--id">{{ line.id }}</td>
            <td class="admin-table__td">{{ line.linePurpose || '—' }}</td>
            <td class="admin-table__td">{{ line.startPoint || '—' }}</td>
            <td class="admin-table__td">{{ line.endPoint || '—' }}</td>
            <td class="admin-table__td admin-table__td--length">{{ line.length }} м</td>
            <td class="admin-table__td admin-table__td--cable-type">
              {{ line.cableTypeName || '—' }}
            </td>
            <td class="admin-table__td">{{ line.coreCount ?? '—' }}</td>
            <td class="admin-table__td">
              {{
                line.crossSectionValue !== null && line.crossSectionValue !== undefined
                  ? line.crossSectionValue + ' мм²'
                  : '—'
              }}
            </td>
            <td class="admin-table__td admin-table__td--notes">{{ line.notes || '—' }}</td>
            <td v-if="authStore.isAdmin" class="admin-table__td admin-table__td--actions">
              <button
                v-if="authStore.isAdmin"
                class="admin-table__btn"
                @click="openEditModal(line)"
                title="Редактировать"
              >
                ✏️
              </button>
              <button
                v-if="authStore.isAdmin"
                class="admin-table__btn admin-table__btn--del"
                @click="deleteLine(line)"
                title="Удалить"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- === МОДАЛКА ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ЛИНИИ === -->
    <AModal
      @close-emit="showLineModal = false"
      :title="editingLine ? 'Редактировать кабельную линию' : 'Новая кабельная линия'"
      :opened="showLineModal"
    >
      <div class="add-form">
        <div class="add-form__group">
          <label for="line-purpose">Назначение *</label>
          <Ainput
            id="line-purpose"
            v-model="lineForm.linePurpose"
            placeholder="Например: питание шкафа управления обратным осмосом"
          />
        </div>

        <div class="add-form__row">
          <div class="add-form__group">
            <label for="start-point">Откуда</label>
            <Ainput id="start-point" v-model="lineForm.startPoint" placeholder="Например: ШУ1" />
          </div>
          <div class="add-form__group">
            <label for="end-point">Куда</label>
            <Ainput id="end-point" v-model="lineForm.endPoint" placeholder="Например: КЭ1" />
          </div>
        </div>

        <div class="add-form__group">
          <label for="line-length">Длина (м) *</label>
          <input
            id="line-length"
            type="number"
            v-model.number="lineForm.length"
            min="0"
            step="0.1"
            class="admin-input"
          />
        </div>

        <div class="add-form__row">
          <div class="add-form__group">
            <label for="cable-type">Марка кабеля *</label>
            <select id="cable-type" v-model="lineForm.cableTypeId" class="admin-select">
              <option :value="null" disabled>Выберите марку...</option>
              <option v-for="t in cableTypes" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
            <p v-if="cableTypes.length === 0" class="add-form__hint">
              Справочник типов кабелей пуст
            </p>
          </div>

          <div class="add-form__group">
            <label for="core-count">Кол-во жил</label>
            <input
              id="core-count"
              type="number"
              v-model.number="lineForm.coreCount"
              min="1"
              class="admin-input"
              placeholder="Например: 4"
            />
          </div>
        </div>

        <div class="add-form__group">
          <label for="cross-section">Сечение (мм²) *</label>
          <select id="cross-section" v-model="lineForm.crossSectionId" class="admin-select">
            <option :value="null" disabled>Выберите сечение...</option>
            <option v-for="s in crossSections" :key="s.id" :value="s.id">{{ s.value }} мм²</option>
          </select>
          <p v-if="crossSections.length === 0" class="add-form__hint">Справочник сечений пуст</p>
        </div>

        <div class="add-form__group">
          <label for="notes">Примечание</label>
          <Ainput id="notes" v-model="lineForm.notes" placeholder="Необязательное примечание" />
        </div>

        <div class="admin-form__actions" style="margin-top: 24px">
          <Abutton @click="saveLine" :disabled="!isFormValid || isSaving">
            {{ isSaving ? 'Сохранение...' : editingLine ? 'Сохранить' : 'Добавить' }}
          </Abutton>
          <a class="admin-form__cancel" @click="showLineModal = false">Отмена</a>
        </div>
      </div>
    </AModal>

    <!-- === МОДАЛКА СВОДКИ === -->
    <AModal
      class="modal"
      @close-emit="showSummaryModal = false"
      :title="`Сводка по кабельным линиям ${pageStore.pageInfo.projectName}`"
      :opened="showSummaryModal"
    >
      <div v-if="summaryLoading" class="admin-empty">Загрузка...</div>
      <div v-else-if="summary.length === 0" class="admin-empty">Нет данных для сводки</div>
      <div v-else class="summary-view">
        <table class="admin-table summary-table">
          <thead>
            <tr>
              <th class="admin-table__th">Марка кабеля</th>
              <th class="admin-table__th">Жилы</th>
              <th class="admin-table__th">Сечение</th>
              <th class="admin-table__th">Кол-во линий</th>
              <th class="admin-table__th">Общая длина</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in summary"
              :key="`${row.cableTypeId}-${row.coreCount}-${row.crossSectionId}`"
              class="admin-table__row"
            >
              <td class="admin-table__td">{{ row.cableTypeName }}</td>
              <td class="admin-table__td">{{ row.coreCount ?? '—' }}</td>
              <td class="admin-table__td">{{ row.crossSectionValue }} мм²</td>
              <td class="admin-table__td">{{ row.linesCount }}</td>
              <td class="admin-table__td admin-table__td--length">
                {{ Math.round(row.totalLength) }} м
              </td>
            </tr>
            <tr class="admin-table__row summary-total-row">
              <td class="admin-table__td" colspan="4"><strong>ИТОГО:</strong></td>
              <td class="admin-table__td admin-table__td--length">
                <strong>{{ Math.round(totalSummaryLength) }} м</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="admin-form__actions" style="margin-top: 24px">
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

/* === ХЕДЕР В СТИЛЕ ГАЛЕРЕИ === */
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
  flex-wrap: wrap;
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

.admin-headbar__back-btn {
  font-size: 14px;
  color: #4a5568;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s;
  white-space: nowrap;
  cursor: pointer;
}
.admin-headbar__back-btn:hover {
  background-color: #f7fafc;
  color: #2d3748;
}

.summary-btn,
.export-btn,
.add-line-btn {
  white-space: nowrap;
}

.summary-btn {
  background-color: #f3f4f6 !important;
  color: #374151 !important;
  border: 1px solid #d1d5db !important;
}
.summary-btn:hover {
  background-color: #e5e7eb !important;
}

.export-btn {
  background-color: #f3f4f6 !important;
  color: #374151 !important;
  border: 1px solid #d1d5db !important;
}
.export-btn:hover {
  background-color: #e5e7eb !important;
}

/* === ТАБЛИЦА === */
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
  width: 70px;
}
.admin-table__th--actions {
  width: 120px;
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

.admin-table__td--length {
  white-space: nowrap;
  font-weight: 500;
}

.admin-table__td--cable-type {
  font-weight: 500;
  color: #2d3748;
}

.admin-table__td--notes {
  color: #718096;
  font-size: 13px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.add-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 600px) {
  .add-form__row {
    grid-template-columns: 1fr;
  }
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

/* === СВОДКА === */
.summary-view {
  overflow-x: auto;
}
.summary-table {
  min-width: 600px;
}
.summary-total-row {
  background-color: #f7fafc !important;
}
.summary-total-row:hover {
  background-color: #f7fafc !important;
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

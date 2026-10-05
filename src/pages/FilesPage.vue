<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import AButton from '@/components/A-button.vue'
import AModal from '@/components/A-modal.vue'
import { filesApi } from '@/api/files'
import { projectsApi } from '@/api/projects'
import { formatShortDate } from '@/utils/dateFormatter'
import { useToast } from '@/composables/useToast'

const props = defineProps({
  projectId: { type: [String, Number], default: '' },
})

const toast = useToast()
const route = useRoute()
const authStore = useAuthStore()
const pageStore = usePageStore()

// --- Состояние UI ---
const showModal = ref(false)
const isLoadingFiles = ref(true)
const isLoadingCategories = ref(true)
const isSelectionMode = ref(false)
const showCreateCategory = ref(false)
const newCategoryName = ref('')

// --- Данные ---
const files = ref([])
const categories = ref([])
const project = ref({})
const searchQuery = ref('')
const selectedCategoryId = ref(null) // <-- НОВЫЙ ФИЛЬТР ПО КАТЕГОРИИ
const sortBy = ref('date') // 'date' | 'name'
const selectedFileIds = ref(new Set())

const uploadForm = ref({
  file: null,
  fileCategoryId: null,
  description: '',
})

// --- Утилиты ---
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase()
  const icons = {
    pdf: { color: '#ef4444', text: 'PDF' },
    doc: { color: '#3b82f6', text: 'DOC' },
    docx: { color: '#3b82f6', text: 'DOC' },
    xls: { color: '#10b981', text: 'XLS' },
    xlsx: { color: '#10b981', text: 'XLS' },
    zip: { color: '#f59e0b', text: 'ZIP' },
    rar: { color: '#f59e0b', text: 'RAR' },
    '7z': { color: '#f59e0b', text: '7Z' },
    jpg: { color: '#8b5cf6', text: 'IMG' },
    jpeg: { color: '#8b5cf6', text: 'IMG' },
    png: { color: '#8b5cf6', text: 'IMG' },
    gif: { color: '#8b5cf6', text: 'IMG' },
    dwg: { color: '#06b6d4', text: 'DWG' },
  }
  return icons[ext] || { color: '#6b7280', text: ext.toUpperCase().slice(0, 3) }
}

// --- Вычисляемые свойства ---
const hasFiles = computed(() => files.value.length > 0)
const isListLoading = computed(() => isLoadingFiles.value || isLoadingCategories.value)

const filteredFiles = computed(() => {
  let result = files.value

  // Фильтр по имени
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter((f) => f.fileName.toLowerCase().includes(query))
  }

  // Фильтр по категории
  if (selectedCategoryId.value) {
    result = result.filter((f) => f.fileCategoryId === selectedCategoryId.value)
  }

  return result
})

const groupedFiles = computed(() => {
  const groups = {}

  // Инициализируем группы для всех категорий
  categories.value.forEach((cat) => {
    groups[cat.id] = { category: cat, files: [] }
  })

  // Распределяем файлы по группам
  filteredFiles.value.forEach((file) => {
    if (groups[file.fileCategoryId]) {
      groups[file.fileCategoryId].files.push(file)
    }
  })

  // Сортируем файлы внутри каждой группы и возвращаем только непустые группы
  return Object.values(groups)
    .filter((group) => group.files.length > 0)
    .map((group) => ({
      ...group,
      files: [...group.files].sort((a, b) => {
        if (sortBy.value === 'name') {
          return a.fileName.localeCompare(b.fileName, 'ru')
        } else {
          return new Date(b.uploadedAt) - new Date(a.uploadedAt)
        }
      }),
    }))
    .sort((a, b) => a.category.name.localeCompare(b.category.name, 'ru'))
})

// Проверяем, активен ли хоть один фильтр
const hasActiveFilters = computed(() => !!selectedCategoryId.value || !!searchQuery.value.trim())

// --- Watchers ---
watch([filteredFiles, isSelectionMode], () => {
  if (!isSelectionMode.value) selectedFileIds.value.clear()
})

// --- Методы ---
const resetFilters = () => {
  selectedCategoryId.value = null
  searchQuery.value = ''
}

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки проекта:', error)
    project.value = { codeName: 'Неизвестный проект' }
  }
  pageStore.setEntity(project.value.codeName)
}

const loadFiles = async () => {
  isLoadingFiles.value = true
  try {
    files.value = await filesApi.getFiles(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки файлов:', error)
    toast.error('Не удалось загрузить список файлов')
  } finally {
    isLoadingFiles.value = false
  }
}

const loadCategories = async () => {
  isLoadingCategories.value = true
  try {
    categories.value = await filesApi.getCategories(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки категорий:', error)
    toast.error('Не удалось загрузить категории')
  } finally {
    isLoadingCategories.value = false
  }
}

const submitUpload = async () => {
  if (!uploadForm.value.file) {
    toast.error('Выберите файл')
    return
  }
  if (!uploadForm.value.fileCategoryId) {
    toast.error('Выберите категорию')
    return
  }

  const formData = new FormData()
  formData.append('file', uploadForm.value.file)
  formData.append('fileCategoryId', uploadForm.value.fileCategoryId)
  if (uploadForm.value.description) {
    formData.append('description', uploadForm.value.description)
  }

  try {
    showModal.value = false
    await filesApi.uploadFile(route.params.projectId, formData)

    toast.success('Файл успешно загружен')
    uploadForm.value = { file: null, fileCategoryId: null, description: '' }
    await loadFiles()
  } catch (error) {
    toast.error('Ошибка загрузки: ' + (error.response?.data?.message || error.message))
  }
}

const handleFileChange = (event) => {
  uploadForm.value.file = event.target.files[0] || null
}

const deleteFile = async (file) => {
  if (!confirm(`Удалить файл "${file.fileName}"?`)) return
  try {
    await filesApi.deleteFile(route.params.projectId, file.id)
    files.value = files.value.filter((f) => f.id !== file.id)
    toast.success('Файл удалён')
  } catch (error) {
    toast.error('Ошибка удаления файла')
  }
}

const deleteSelectedFiles = async () => {
  if (selectedFileIds.value.size === 0) return
  const count = selectedFileIds.value.size
  if (!confirm(`Удалить ${count} файл(ов)?`)) return

  try {
    await Promise.all(
      Array.from(selectedFileIds.value).map((id) =>
        filesApi.deleteFile(route.params.projectId, id),
      ),
    )
    files.value = files.value.filter((f) => !selectedFileIds.value.has(f.id))
    toast.success(`Удалено ${count} файл(ов)`)
    selectedFileIds.value.clear()
    isSelectionMode.value = false
  } catch (error) {
    toast.error('Ошибка при удалении')
  }
}

const downloadFile = async (file) => {
  try {
    const blob = await filesApi.downloadFile(route.params.projectId, file.id)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    toast.error('Ошибка скачивания файла')
  }
}

const createCategory = async () => {
  if (!newCategoryName.value.trim()) {
    toast.error('Введите название категории')
    return
  }
  try {
    const newCat = await filesApi.createCategory(route.params.projectId, {
      name: newCategoryName.value.trim(),
    })
    categories.value.push(newCat)
    newCategoryName.value = ''
    showCreateCategory.value = false
    toast.success('Категория создана')
  } catch (error) {
    toast.error('Ошибка создания категории: ' + (error.response?.data?.message || error.message))
  }
}

const closeFileModal = () => {
  showModal.value = false
}

const toggleSelection = (id) => {
  if (selectedFileIds.value.has(id)) {
    selectedFileIds.value.delete(id)
  } else {
    selectedFileIds.value.add(id)
  }
}

const toggleSelectAll = () => {
  if (selectedFileIds.value.size === filteredFiles.value.length && filteredFiles.value.length > 0) {
    selectedFileIds.value.clear()
  } else {
    filteredFiles.value.forEach((f) => selectedFileIds.value.add(f.id))
  }
}

// --- Хуки жизненного цикла ---
onMounted(async () => {
  await Promise.all([loadProject(), loadCategories(), loadFiles()])
})
</script>

<template>
  <div class="global-container">
    <div class="files-page">
      <!-- Хедер с фильтрами -->
      <div class="files__header">
        <div v-if="hasFiles" class="files__filter">
          <!-- ФИЛЬТР ПО КАТЕГОРИИ ВМЕСТО ДАТ -->
          <div class="files__category-filter">
            <span>Категория: </span>
            <select v-model="selectedCategoryId" class="form-select-inline">
              <option :value="null">Все категории</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="files__search">
            <a-input v-model="searchQuery" placeholder="Поиск по имени..." />
          </div>

          <div class="files__filter-actions">
            <a-button v-if="hasActiveFilters" @click="resetFilters" class="btn-small">
              Сброс ({{ filteredFiles.length }})
            </a-button>
            <span class="files__total" v-else>Всего: {{ filteredFiles.length }}</span>

            <a-button @click="sortBy = sortBy === 'date' ? 'name' : 'date'" class="btn-small">
              {{ sortBy === 'date' ? 'По дате ↓' : 'По имени ↓' }}
            </a-button>

            <a-button
              v-if="authStore.isAdmin"
              @click="isSelectionMode = !isSelectionMode"
              class="btn-small btn-select-mode"
            >
              {{ isSelectionMode ? 'Отмена' : 'Выбрать' }}
            </a-button>
          </div>
        </div>

        <div class="files__upload-btn-wrapper">
          <a-button @click="showModal = true">Загрузить файл</a-button>
        </div>
      </div>

      <!-- Панель группового удаления -->
      <div v-if="isSelectionMode" class="files__selection-bar">
        <label class="select-all-label">
          <input
            type="checkbox"
            :checked="selectedFileIds.size === filteredFiles.length && filteredFiles.length > 0"
            @change="toggleSelectAll"
          />
          <span>Выбрать все</span>
        </label>
        <span class="selection-count"
          >Выбрано: <strong>{{ selectedFileIds.size }}</strong></span
        >
        <a-button
          @click="deleteSelectedFiles"
          class="btn-small btn-danger"
          :disabled="selectedFileIds.size === 0"
        >
          Удалить
        </a-button>
      </div>

      <!-- Загрузка -->
      <div v-if="isListLoading" class="files__loading">Загрузка...</div>

      <!-- Пустое состояние -->
      <div v-else-if="!hasFiles" class="files__null">
        <div class="empty-icon">📁</div>
        <p>Нет загруженных файлов</p>
      </div>

      <!-- Список файлов по категориям -->
      <div v-else-if="groupedFiles.length > 0" class="files__list">
        <div v-for="group in groupedFiles" :key="group.category.id" class="files__category">
          <div class="files__category-header">
            <h3 class="files__category-title">{{ group.category.name }}</h3>
            <span class="files__category-count">{{ group.files.length }}</span>
          </div>

          <div class="files__table">
            <div
              v-for="file in group.files"
              :key="file.id"
              class="files__row"
              :class="{ 'files__row--selected': selectedFileIds.has(file.id) }"
            >
              <!-- Чекбокс -->
              <div v-if="isSelectionMode" class="files__checkbox">
                <input
                  type="checkbox"
                  :checked="selectedFileIds.has(file.id)"
                  @change="toggleSelection(file.id)"
                />
              </div>

              <!-- Иконка файла -->
              <div
                class="files__icon"
                :style="{ backgroundColor: getFileIcon(file.fileName).color }"
              >
                {{ getFileIcon(file.fileName).text }}
              </div>

              <!-- Информация о файле -->
              <div class="files__info">
                <div class="files__name">{{ file.fileName }}</div>
                <div class="files__meta">
                  <span>{{ formatFileSize(file.fileSize) }}</span>
                  <span>•</span>
                  <span>{{ formatShortDate(file.uploadedAt) }}</span>
                  <span v-if="file.description">• {{ file.description }}</span>
                </div>
              </div>

              <!-- Действия -->
              <div class="files__actions">
                <a-button @click="downloadFile(file)" class="btn-icon btn-download" title="Скачать">
                  ⬇
                </a-button>
                <a-button
                  v-if="authStore.isAdmin && !isSelectionMode"
                  @click="deleteFile(file)"
                  class="btn-icon btn-delete"
                  title="Удалить"
                >
                  🗑
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ни один файл не прошёл фильтрацию либо не имеет категории -->
      <div v-else class="files__null">
        <p>
          {{
            hasActiveFilters
              ? 'Файлы не найдены по заданным фильтрам'
              : 'Нет файлов для отображения'
          }}
        </p>
      </div>
    </div>

    <!-- Модалка загрузки -->
    <a-modal title="Загрузка файла" :opened="showModal" @close-emit="showModal = false">
      <form @submit.prevent="submitUpload" class="upload-form">
        <div class="form-group">
          <div class="form-title-group">
            <label>Выберите файл</label>
            <button
              type="button"
              class="control-btn close-btn"
              @click="closeFileModal"
              title="Закрыть"
            >
              &times;
            </button>
          </div>

          <a-input type="file" @change="handleFileChange" class="form-input" />
          <div v-if="uploadForm.file" class="selected-file">
            {{ uploadForm.file.name }} ({{ formatFileSize(uploadForm.file.size) }})
          </div>
        </div>

        <div class="form-group">
          <label>Категория *</label>
          <select v-model="uploadForm.fileCategoryId" class="form-select">
            <option :value="null" disabled>Выберите категорию...</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>

          <div v-if="!showCreateCategory" class="create-category-link">
            <a @click="showCreateCategory = true">+ Создать новую категорию</a>
          </div>

          <div v-else class="create-category-form">
            <a-input
              v-model="newCategoryName"
              placeholder="Название категории..."
              class="form-input"
            />
            <div class="create-category-actions">
              <a-button @click="createCategory" class="btn-small">Создать</a-button>
              <a-button @click="showCreateCategory = false" class="btn-small btn-cancel">
                Отмена
              </a-button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>Описание (необязательно)</label>
          <a-input
            v-model="uploadForm.description"
            placeholder="Описание файла..."
            class="form-input"
          />
        </div>

        <a-button type="submit" class="full-width-btn">Загрузить</a-button>
      </form>
    </a-modal>
  </div>
</template>

<style scoped>
label {
  margin: 0px;
}

/* === БАЗОВЫЕ СТИЛИ === */
.global-container {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.files-page {
  margin: 0 auto;
}

.files__header,
.files__null,
.files__loading {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: rgb(255, 255, 255);
  padding: 16px;
}

.files__header {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.files__filter {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

/* Стили для нового фильтра по категории */
.files__category-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.form-select-inline {
  padding: 6px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  font-size: 14px;
  background-color: #fff;
  cursor: pointer;
  flex: 1;
}

.files__search {
  grid-column: span 2;
}

.files__filter-actions {
  grid-column: span 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.files__total {
  font-size: 14px;
  color: #6b7280;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
  min-height: 32px;
}

.btn-select-mode {
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border: none;
}
.btn-danger:disabled {
  background: #fca5a5;
  cursor: not-allowed;
}

.btn-cancel {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.files__upload-btn-wrapper {
  width: 100%;
}
.files__upload-btn-wrapper button {
  width: 100%;
}

/* === ПАНЕЛЬ ВЫДЕЛЕНИЯ === */
.files__selection-bar {
  margin-top: 12px;
  padding: 12px 16px;
  background-color: #eff6ff;
  border-radius: 8px;
  border: 1px solid #bfdbfe;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}

.select-all-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.selection-count {
  font-size: 14px;
  color: #4b5563;
  margin-right: auto;
}

.selection-count strong {
  color: #2563eb;
}

/* === ПУСТОЕ СОСТОЯНИЕ === */
.files__null,
.files__loading {
  margin-top: 24px;
  text-align: center;
  padding: 48px 16px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* === СПИСОК ФАЙЛОВ === */
.files__list {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.files__category {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: rgb(255, 255, 255);
  overflow: hidden;
}

.files__category-header {
  padding: 16px;
  background-color: #f9fafb;
  border-bottom: 1px solid rgb(230, 230, 230);
  display: flex;
  align-items: center;
  gap: 12px;
}

.files__category-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.files__category-count {
  background-color: #e5e7eb;
  color: #4b5563;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.files__table {
  display: flex;
  flex-direction: column;
}

.files__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgb(240, 240, 240);
  transition: background-color 0.2s;
}

.files__row:last-child {
  border-bottom: none;
}

.files__row:hover {
  background-color: #f9fafb;
}

.files__row--selected {
  background-color: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.files__checkbox {
  display: flex;
  align-items: center;
}

.files__checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.files__icon {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.files__info {
  flex: 1;
  min-width: 0;
}

.files__name {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.files__meta {
  font-size: 12px;
  color: #6b7280;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.files__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: transparent;
}

.btn-download {
  color: #3b82f6;
}
.btn-download:hover {
  background-color: #dbeafe;
}

.btn-delete {
  color: #ef4444;
}
.btn-delete:hover {
  background-color: #fee2e2;
}

/* === ФОРМЫ === */
.upload-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-title-group {
  display: flex;
  justify-content: space-between;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-input,
.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 6px;
  font-size: 14px;
  background-color: #fff;
}

.form-select {
  cursor: pointer;
}

.selected-file {
  font-size: 13px;
  color: #059669;
  font-weight: 500;
}

.create-category-link {
  margin-top: 4px;
}

.create-category-link a {
  font-size: 13px;
  color: #3b82f6;
  cursor: pointer;
  text-decoration: none;
}
.create-category-link a:hover {
  text-decoration: underline;
}

.create-category-form {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.create-category-actions {
  display: flex;
  gap: 8px;
}

.full-width-btn {
  width: 100%;
}

/* === ДЕСКТОПНЫЕ СТИЛИ === */
@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .files__header {
    flex-direction: row;
    justify-content: space-between;
  }

  .files__filter {
    /* Изменено: категория, поиск, действия в одну строку */
    grid-template-columns: max-content 1fr auto;
    gap: 24px;
    width: auto;
    flex: 1;
  }

  .files__category-filter {
    flex-shrink: 0;
  }

  .form-select-inline {
    width: 200px;
    flex: none;
  }

  .files__search {
    grid-column: auto;
  }

  .files__filter-actions {
    grid-column: auto;
    justify-content: flex-end;
  }

  .files__upload-btn-wrapper {
    width: auto;
  }
  .files__upload-btn-wrapper button {
    width: auto;
  }

  .files__name {
    font-size: 15px;
  }

  .files__meta {
    font-size: 13px;
  }

  .full-width-btn {
    width: auto;
  }
}
</style>

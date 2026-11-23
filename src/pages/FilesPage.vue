<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import FileInput from '@/components/FileInput.vue'
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

const showModal = ref(false)
const isLoadingFiles = ref(true)
const isLoadingCategories = ref(true)
const isSelectionMode = ref(false)
const showCreateCategory = ref(false)
const newCategoryName = ref('')

const files = ref([])
const categories = ref([])
const project = ref({})
const searchQuery = ref('')
const selectedCategoryId = ref(null)
const sortBy = ref('date')
const selectedFileIds = ref(new Set())

const isUploading = ref(false)
const uploadProgress = ref(0)

const uploadForm = ref({
  file: null,
  fileCategoryId: null,
  description: '',
})

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024
const MAX_FILE_SIZE_LABEL = '1 ГБ'

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

const hasFiles = computed(() => files.value.length > 0)
const isListLoading = computed(() => isLoadingFiles.value || isLoadingCategories.value)

const filteredFiles = computed(() => {
  let result = files.value

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter((file) => file.fileName.toLowerCase().includes(query))
  }

  if (selectedCategoryId.value) {
    result = result.filter((file) => file.fileCategoryId === selectedCategoryId.value)
  }

  return result
})

const groupedFiles = computed(() => {
  const groups = {}

  categories.value.forEach((category) => {
    groups[category.id] = { category, files: [] }
  })

  filteredFiles.value.forEach((file) => {
    if (groups[file.fileCategoryId]) {
      groups[file.fileCategoryId].files.push(file)
    }
  })

  return Object.values(groups)
    .filter((group) => group.files.length > 0)
    .map((group) => ({
      ...group,
      files: [...group.files].sort((a, b) => {
        if (sortBy.value === 'name') {
          return a.fileName.localeCompare(b.fileName, 'ru')
        }
        return new Date(b.uploadedAt) - new Date(a.uploadedAt)
      }),
    }))
    .sort((a, b) => a.category.name.localeCompare(b.category.name, 'ru'))
})

const hasActiveFilters = computed(() => !!selectedCategoryId.value || !!searchQuery.value.trim())
const areAllFilteredSelected = computed(
  () =>
    filteredFiles.value.length > 0 &&
    filteredFiles.value.every((file) => selectedFileIds.value.has(file.id)),
)

watch([filteredFiles, isSelectionMode], () => {
  if (!isSelectionMode.value) selectedFileIds.value.clear()
})

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
  if (isUploading.value) return
  if (!uploadForm.value.file) {
    toast.error('Выберите файл')
    return
  }
  if (uploadForm.value.file.size > MAX_FILE_SIZE_BYTES) {
    toast.error(`Максимальный размер файла — ${MAX_FILE_SIZE_LABEL}`)
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

  isUploading.value = true
  uploadProgress.value = 0
  try {
    await filesApi.uploadFile(route.params.projectId, formData, (percent) => {
      uploadProgress.value = percent
    })

    toast.success('Файл успешно загружен')
    uploadForm.value = { file: null, fileCategoryId: null, description: '' }
    showModal.value = false
    await loadFiles()
  } catch (error) {
    const data = error.response?.data
    const reason = typeof data === 'string' ? data : data?.message
    toast.error('Ошибка загрузки: ' + (reason || error.message))
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

const handleFileSelect = ([file]) => {
  if (isUploading.value) return
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error(`Максимальный размер файла ${formatFileSize(file.size)} — ${MAX_FILE_SIZE_LABEL}`)
    return
  }
  uploadForm.value.file = file
}

const deleteFile = async (file) => {
  if (!confirm(`Удалить файл "${file.fileName}"?`)) return
  try {
    await filesApi.deleteFile(route.params.projectId, file.id)
    files.value = files.value.filter((item) => item.id !== file.id)
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
    files.value = files.value.filter((file) => !selectedFileIds.value.has(file.id))
    toast.success(`Удалено ${count} файл(ов)`)
    selectedFileIds.value.clear()
    isSelectionMode.value = false
  } catch (error) {
    toast.error('Ошибка при удалении')
  }
}

const downloadFile = (file) => {
  if (!confirm(`Скачать файл "${file.fileName}"?`)) return
  const link = document.createElement('a')
  link.href = filesApi.getDownloadUrl(route.params.projectId, file.id)
  link.download = file.fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const createCategory = async () => {
  if (!newCategoryName.value.trim()) {
    toast.error('Введите название категории')
    return
  }
  try {
    const newCategory = await filesApi.createCategory(route.params.projectId, {
      name: newCategoryName.value.trim(),
    })
    categories.value.push(newCategory)
    newCategoryName.value = ''
    showCreateCategory.value = false
    toast.success('Категория создана')
  } catch (error) {
    toast.error('Ошибка создания категории: ' + (error.response?.data?.message || error.message))
  }
}

const closeFileModal = () => {
  if (isUploading.value) return
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
  if (areAllFilteredSelected.value) {
    filteredFiles.value.forEach((file) => selectedFileIds.value.delete(file.id))
  } else {
    filteredFiles.value.forEach((file) => selectedFileIds.value.add(file.id))
  }
}

onMounted(async () => {
  await Promise.all([loadProject(), loadCategories(), loadFiles()])
})
</script>

<template>
  <div class="global-container">
    <main class="files-page">
      <header class="files__header">
        <div class="files__heading">
          <div class="files__breadcrumb admin-headbar__info">
            <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
            <span class="admin-headbar__separator">/</span>
            <span>Файлы</span>
          </div>

          <div class="files__title-row">
            <span class="files__title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path
                  d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
                />
                <path d="M3 10h18" />
              </svg>
            </span>
            <div>
              <div class="files__title-line">
                <h1 class="files__title">Файлы</h1>
                <span v-if="!isListLoading" class="files__count-badge">{{ files.length }}</span>
              </div>
              <p class="files__subtitle">Документы, чертежи и материалы проекта</p>
            </div>
          </div>
        </div>

        <a-button
          v-if="authStore.isAdmin"
          class="files__upload"
          :disabled="isUploading"
          @click="showModal = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
          </svg>
          <span>{{ isUploading ? 'Идёт загрузка…' : 'Загрузить файл' }}</span>
        </a-button>
      </header>

      <section
        v-if="!isListLoading && hasFiles"
        class="files__toolbar"
        :class="{ 'files__toolbar--selection': isSelectionMode }"
        aria-label="Фильтры и действия с файлами"
      >
        <div class="files__filters">
          <label class="files__field">
            <span>Категория</span>
            <select
              v-model="selectedCategoryId"
              class="files__select"
              :disabled="isSelectionMode"
              aria-label="Категория файлов"
            >
              <option :value="null">Все категории</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </label>

          <label class="files__field files__search-field">
            <span>Поиск</span>
            <div class="files__search-control">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <a-input
                v-model="searchQuery"
                placeholder="Поиск по имени..."
                aria-label="Поиск файлов по имени"
                :disabled="isSelectionMode"
              />
            </div>
          </label>
        </div>

        <div class="files__toolbar-actions">
          <template v-if="!isSelectionMode">
            <span class="files__result-count">{{ filteredFiles.length }} файл(ов)</span>
            <button v-if="hasActiveFilters" class="files__reset" @click="resetFilters">
              Сбросить
            </button>
            <a-button
              class="files__sort"
              title="Изменить сортировку"
              @click="sortBy = sortBy === 'date' ? 'name' : 'date'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M8 4v16m-4-4 4 4 4-4" />
                <path d="M16 20V4m-4 4 4-4 4 4" />
              </svg>
              <span>{{ sortBy === 'date' ? 'По дате' : 'По имени' }}</span>
            </a-button>
            <a-button
              v-if="authStore.isAdmin"
              class="files__select-mode"
              @click="isSelectionMode = true"
            >
              Выбрать
            </a-button>
          </template>

          <template v-else>
            <span class="selection-count">Выбрано: {{ selectedFileIds.size }}</span>
            <button class="files__reset" @click="toggleSelectAll">
              {{ areAllFilteredSelected ? 'Снять выделение' : 'Выбрать все' }}
            </button>
            <a-button
              class="toolbar-button toolbar-button--danger"
              :disabled="selectedFileIds.size === 0"
              @click="deleteSelectedFiles"
            >
              Удалить
            </a-button>
            <a-button class="toolbar-button" @click="isSelectionMode = false">Отмена</a-button>
          </template>
        </div>
      </section>

      <div v-if="isListLoading" class="files__list" aria-label="Загрузка файлов">
        <div v-for="item in 3" :key="item" class="file-category-skeleton">
          <div class="file-category-skeleton__header">
            <div class="file-category-skeleton__icon skeleton-shimmer"></div>
            <div class="file-category-skeleton__title skeleton-shimmer"></div>
          </div>
          <div class="file-category-skeleton__row">
            <div class="file-category-skeleton__file-icon skeleton-shimmer"></div>
            <div class="file-category-skeleton__lines">
              <div class="skeleton-shimmer"></div>
              <div class="skeleton-shimmer"></div>
            </div>
          </div>
          <div class="file-category-skeleton__row">
            <div class="file-category-skeleton__file-icon skeleton-shimmer"></div>
            <div class="file-category-skeleton__lines">
              <div class="skeleton-shimmer"></div>
              <div class="skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!hasFiles" class="files__empty">
        <div class="files__empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <h2>Здесь появятся файлы</h2>
        <p>Добавьте документы, чертежи, инструкции и другие материалы проекта.</p>
      </div>

      <div v-else-if="groupedFiles.length === 0" class="files__empty">
        <div class="files__empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
            <path d="M8.5 11h5" />
          </svg>
        </div>
        <h2>{{ hasActiveFilters ? 'Файлы не найдены' : 'Нет файлов для отображения' }}</h2>
        <p>
          {{
            hasActiveFilters
              ? 'По выбранной категории и поисковому запросу ничего не найдено.'
              : 'Проверьте категории, к которым привязаны загруженные файлы.'
          }}
        </p>
        <a-button v-if="hasActiveFilters" class="files__empty-action" @click="resetFilters">
          Сбросить фильтры
        </a-button>
      </div>

      <section v-else class="files__list" aria-label="Файлы по категориям">
        <section v-for="group in groupedFiles" :key="group.category.id" class="file-category">
          <header class="file-category__header">
            <span class="file-category__folder" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path
                  d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
                />
                <path d="M3 10h18" />
              </svg>
            </span>
            <h2 class="file-category__title">{{ group.category.name }}</h2>
            <span class="file-category__count">{{ group.files.length }}</span>
          </header>

          <div class="file-list">
            <div
              v-for="file in group.files"
              :key="file.id"
              class="file-row"
              :class="{ 'file-row--selected': selectedFileIds.has(file.id) }"
              :tabindex="isSelectionMode ? 0 : -1"
              @click="isSelectionMode && toggleSelection(file.id)"
              @keydown.enter.prevent="isSelectionMode && toggleSelection(file.id)"
              @keydown.space.prevent="isSelectionMode && toggleSelection(file.id)"
            >
              <label v-if="isSelectionMode" class="file-row__checkbox" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedFileIds.has(file.id)"
                  @change="toggleSelection(file.id)"
                />
                <span class="file-row__checkbox-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
              </label>

              <div
                class="file-row__icon"
                :style="{ backgroundColor: getFileIcon(file.fileName).color }"
              >
                {{ getFileIcon(file.fileName).text }}
              </div>

              <div class="file-row__info">
                <div class="file-row__name" :title="file.fileName">{{ file.fileName }}</div>
                <div class="file-row__meta">
                  <span>{{ formatFileSize(file.fileSize) }}</span>
                  <span class="file-row__meta-dot" aria-hidden="true">·</span>
                  <span>{{ formatShortDate(file.uploadedAt) }}</span>
                  <span
                    v-if="file.description"
                    class="file-row__description"
                    :title="file.description"
                  >
                    {{ file.description }}
                  </span>
                </div>
              </div>

              <div class="file-row__actions">
                <button
                  class="file-row__action file-row__action--download"
                  title="Скачать"
                  aria-label="Скачать файл"
                  @click.stop="downloadFile(file)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 4v12" />
                    <path d="m7 11 5 5 5-5" />
                    <path d="M5 19h14" />
                  </svg>
                </button>
                <button
                  v-if="authStore.isAdmin && !isSelectionMode"
                  class="file-row__action file-row__action--delete"
                  title="Удалить"
                  aria-label="Удалить файл"
                  @click.stop="deleteFile(file)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                    <path d="M4 7h16" />
                    <path d="M9 7V4h6v3" />
                    <path d="m7 7 1 13h8l1-13" />
                    <path d="M10 11v5m4-5v5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  </div>

  <a-modal title="Загрузка файла" :opened="showModal" @close-emit="closeFileModal">
    <div class="upload-form">
      <div class="upload-intro">
        <h3>Добавьте файл</h3>
        <p>Выберите документ, укажите категорию и при необходимости добавьте описание.</p>
      </div>

      <div class="form-group">
        <label>Файл</label>
        <FileInput
          :disabled="isUploading"
          hint="Максимальный размер одного файла — 1 ГБ"
          @select="handleFileSelect"
        />
        <div v-if="uploadForm.file" class="selected-file">
          <span class="selected-file__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <span class="selected-file__name" :title="uploadForm.file.name">
            {{ uploadForm.file.name }}
          </span>
          <span class="selected-file__size">{{ formatFileSize(uploadForm.file.size) }}</span>
          <button
            v-if="!isUploading"
            class="selected-file__clear"
            title="Убрать файл"
            aria-label="Убрать выбранный файл"
            @click="uploadForm.file = null"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>Категория *</label>
        <select v-model="uploadForm.fileCategoryId" class="form-select" :disabled="isUploading">
          <option :value="null" disabled>Выберите категорию...</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>

        <button
          v-if="!showCreateCategory"
          class="create-category-link"
          :disabled="isUploading"
          @click="showCreateCategory = true"
        >
          + Создать новую категорию
        </button>

        <div v-else class="create-category-form">
          <a-input
            v-model="newCategoryName"
            placeholder="Название категории..."
            :disabled="isUploading"
          />
          <div class="create-category-actions">
            <a-button
              class="create-category-submit"
              :disabled="isUploading"
              @click="createCategory"
            >
              Создать
            </a-button>
            <button
              class="create-category-cancel"
              :disabled="isUploading"
              @click="showCreateCategory = false"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>Описание</label>
        <a-input
          v-model="uploadForm.description"
          placeholder="Описание файла..."
          :disabled="isUploading"
        />
      </div>

      <div v-if="isUploading" class="upload-progress">
        <div class="upload-progress__track">
          <div class="upload-progress__fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <div class="upload-progress__label">
          <span
            >Отправлено {{ uploadProgress }}% из {{ formatFileSize(uploadForm.file?.size) }}</span
          >
          <span class="upload-progress__hint">Не закрывайте окно до конца загрузки</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <button class="modal-cancel" :disabled="isUploading" @click="closeFileModal">Отмена</button>
        <a-button
          class="modal-submit"
          :disabled="isUploading || !uploadForm.file || !uploadForm.fileCategoryId"
          @click="submitUpload"
        >
          {{ isUploading ? 'Загрузка…' : 'Загрузить' }}
        </a-button>
      </div>
    </template>
  </a-modal>
</template>

<style scoped>
.global-container {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.files-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
}

.files__header {
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

.files__heading {
  min-width: 0;
}

.files__breadcrumb {
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

.files__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.files__title-icon {
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

.files__title-icon svg {
  width: 23px;
  height: 23px;
}

.files__title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.files__title {
  margin: 0;
  color: #2d3748;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.2;
}

.files__count-badge {
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

.files__subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.45;
}

.files__upload.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: 500;
}

.files__upload svg {
  width: 18px;
  height: 18px;
}

.files__toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
  transition:
    border-color 0.2s,
    background 0.2s;
}

.files__toolbar--selection {
  border-color: #c7d2fe;
  background: #fbfbff;
}

.files__filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  width: 100%;
}

.files__field {
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

.files__select,
.files__search-control :deep(.input) {
  min-width: 0;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-family: inherit;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: normal;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.files__select {
  width: 100%;
  cursor: pointer;
}

.files__select:focus,
.files__search-control :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.files__select:disabled,
.files__search-control :deep(.input):disabled {
  background: #f8fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.files__search-control {
  position: relative;
}

.files__search-control > svg {
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

.files__search-control :deep(.input) {
  width: 100%;
  padding-left: 34px;
}

.files__toolbar-actions {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.files__result-count {
  margin-right: auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.files__reset,
.create-category-link,
.create-category-cancel {
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

.files__reset:hover,
.create-category-link:hover,
.create-category-cancel:hover {
  background: #eef2ff;
}

.files__sort.btn,
.files__select-mode.btn,
.toolbar-button.btn,
.create-category-submit.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}

.files__sort.btn:hover,
.files__select-mode.btn:hover,
.toolbar-button.btn:hover,
.create-category-submit.btn:hover {
  border-color: #c7d2fe;
  background: #f5f3ff;
  color: #4f46e5;
}

.files__sort svg {
  width: 16px;
  height: 16px;
  color: #818cf8;
}

.toolbar-button--danger.btn {
  border-color: #fecaca;
  background: #fff;
  color: #b91c1c;
}

.toolbar-button--danger.btn:hover:not(:disabled) {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #b91c1c;
}

.toolbar-button.btn:disabled,
.create-category-submit.btn:disabled {
  border-color: #e5e7eb;
  background: #f9fafb;
  color: #b6bcc5;
  cursor: not-allowed;
}

.selection-count {
  color: #4f46e5;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.files__list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.file-category,
.file-category-skeleton {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 20px -14px rgba(34, 60, 80, 0.28);
}

.file-category__header,
.file-category-skeleton__header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 12px 14px;
  border-bottom: 1px solid #eceef1;
  background: #f9fafb;
}

.file-category__folder {
  display: grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 8px;
  background: #eef2ff;
  color: #6366f1;
}

.file-category__folder svg {
  width: 17px;
  height: 17px;
}

.file-category__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-category__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f1f3;
  transition:
    background 0.2s,
    box-shadow 0.2s;
}

.file-row:last-child {
  border-bottom: 0;
}

.file-row:hover {
  background: #f9fafb;
}

.file-row:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: -2px;
}

.file-row--selected,
.file-row--selected:hover {
  background: #f5f3ff;
  box-shadow: inset 3px 0 0 #6366f1;
}

.file-row__checkbox {
  position: relative;
  display: grid;
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
  place-items: center;
  cursor: pointer;
}

.file-row__checkbox input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.file-row__checkbox-mark {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #fff;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.file-row__checkbox-mark svg {
  width: 14px;
  height: 14px;
  opacity: 0;
}

.file-row--selected .file-row__checkbox-mark {
  border-color: #6366f1;
  background: #6366f1;
}

.file-row--selected .file-row__checkbox-mark svg {
  opacity: 1;
}

.file-row__icon {
  display: flex;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.file-row__info {
  flex: 1;
  min-width: 0;
}

.file-row__name {
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-row__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-top: 4px;
  overflow: hidden;
  color: #9298a1;
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

.file-row__meta-dot {
  color: #cbd5e0;
}

.file-row__description {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-row__description::before {
  margin-right: 5px;
  color: #cbd5e0;
  content: '·';
}

.file-row__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
}

.file-row__action {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.file-row__action svg {
  width: 17px;
  height: 17px;
}

.file-row__action--download {
  color: #818cf8;
}

.file-row__action--download:hover {
  background: #eef2ff;
  color: #4f46e5;
}

.file-row__action--delete {
  color: #a1a6af;
}

.file-row__action--delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

.file-category-skeleton__header {
  gap: 12px;
}

.file-category-skeleton__icon,
.file-category-skeleton__title,
.file-category-skeleton__file-icon,
.file-category-skeleton__lines div {
  background: #eef0f3;
}

.file-category-skeleton__icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.file-category-skeleton__title {
  width: 42%;
  height: 12px;
  border-radius: 999px;
}

.file-category-skeleton__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid #f0f1f3;
}

.file-category-skeleton__row:last-child {
  border-bottom: 0;
}

.file-category-skeleton__file-icon {
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 10px;
}

.file-category-skeleton__lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.file-category-skeleton__lines div {
  width: 62%;
  height: 9px;
  border-radius: 999px;
}

.file-category-skeleton__lines div:last-child {
  width: 38%;
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
  animation: skeleton-slide 1.4s infinite;
}

@keyframes skeleton-slide {
  to {
    transform: translateX(100%);
  }
}

.files__empty {
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

.files__empty-icon {
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

.files__empty-icon svg {
  width: 30px;
  height: 30px;
}

.files__empty h2 {
  margin: 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.files__empty p {
  max-width: 460px;
  margin: 8px 0 0;
  color: #8a8f98;
  font-size: 14px;
  line-height: 1.55;
}

.files__empty-action.btn {
  min-height: 38px;
  margin-top: 20px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-intro h3 {
  margin: 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.upload-intro p {
  margin: 6px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.5;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.form-select,
.form-group :deep(.input) {
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.form-select {
  cursor: pointer;
}

.form-select:focus,
.form-group :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-select:disabled,
.form-group :deep(.input):disabled {
  background: #f8fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid #d1fae5;
  border-radius: 9px;
  background: #f0fdf4;
}

.selected-file__check {
  display: grid;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #10b981;
  color: #fff;
}

.selected-file__check svg {
  width: 14px;
  height: 14px;
}

.selected-file__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #047857;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-file__size {
  flex: 0 0 auto;
  color: #059669;
  font-size: 11px;
  white-space: nowrap;
}

.selected-file__clear {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

.selected-file__clear svg {
  width: 15px;
  height: 15px;
}

.selected-file__clear:hover {
  background: #fee2e2;
  color: #dc2626;
}

.create-category-link {
  align-self: flex-start;
  padding-left: 0;
}

.create-category-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #f9fafb;
}

.create-category-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.create-category-cancel {
  color: #6b7280;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-progress__track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}

.upload-progress__fill {
  height: 100%;
  border-radius: 999px;
  background: #6366f1;
  transition: width 0.2s ease;
}

.upload-progress__label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.upload-progress__hint {
  color: #8a8f98;
  font-size: 12px;
  font-weight: 400;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-cancel,
.modal-submit.btn {
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

@media (min-width: 560px) {
  .files__filters {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    align-items: end;
  }
}

@media (min-width: 640px) {
  .files__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
  }

  .files__upload.btn {
    width: auto;
  }

  .files__toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
  }

  .files__filters {
    width: auto;
    flex: 0 1 420px;
  }

  .files__toolbar-actions {
    flex: 0 1 auto;
    justify-content: flex-end;
  }

  .files__result-count {
    margin-right: 0;
  }

  .file-category__header {
    padding-inline: 16px;
  }

  .file-row {
    padding-inline: 16px;
  }

  .file-row__name {
    font-size: 14px;
  }

  .file-row__meta {
    font-size: 12px;
  }
}

@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .files-page {
    gap: 20px;
  }

  .files__header {
    padding: 24px;
  }

  .files__breadcrumb {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .files__title-icon {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .files__title {
    font-size: 26px;
  }

  .files__subtitle {
    font-size: 14px;
  }

  .files__upload.btn {
    min-height: 42px;
    padding: 10px 16px;
    font-size: 15px;
  }

  .files__toolbar {
    padding: 14px 16px;
  }

  .files__select,
  .files__search-control :deep(.input) {
    padding-inline: 12px;
    font-size: 14px;
  }

  .files__search-control :deep(.input) {
    padding-left: 36px;
  }

  .files__empty {
    min-height: 380px;
    padding: 48px 24px;
  }
}

@media (min-width: 1100px) {
  .files__list {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
    gap: 20px;
  }
}

@media (max-width: 600px) {
  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-cancel,
  .modal-submit.btn {
    width: 100%;
  }

  .file-row {
    gap: 9px;
    padding-inline: 11px;
  }

  .file-row__icon {
    flex-basis: 38px;
    width: 38px;
    height: 38px;
    border-radius: 9px;
    font-size: 9px;
  }

  .file-row__actions {
    gap: 2px;
  }

  .file-row__action {
    width: 30px;
    height: 30px;
  }

  .file-row__description {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .file-row,
  .file-row__action,
  .files__reset,
  .create-category-link,
  .create-category-cancel {
    transition: none;
  }

  .skeleton-shimmer::after {
    animation: none;
  }
}
</style>

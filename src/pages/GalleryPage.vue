<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import AButton from '@/components/A-button.vue'
import AModal from '@/components/A-modal.vue'
import { galleryApi } from '@/api/gallery'
import { projectsApi } from '@/api/projects'
import { formatShortDate, parseLocalDate, convertDateFormat } from '@/utils/dateFormatter'
import { useToast } from '@/composables/useToast'
import imageCompression from 'browser-image-compression'

const props = defineProps({
  projectId: { type: [String, Number], default: '' },
})

const toast = useToast()
const route = useRoute()
const authStore = useAuthStore()
const pageStore = usePageStore()

// --- Состояние UI ---
const scrollY = ref(0)
const showModal = ref(false)
const showPhotoModal = ref(false)
const isLoadingPhotos = ref(false)
const isModalImageLoading = ref(false)
const hasReversedPhotos = ref(false)

// --- Групповое удаление ---
const isSelectionMode = ref(false)
const selectedPhotoIds = ref(new Set())

// --- Данные ---
const photos = ref([])
const project = ref({})
const startDate = ref(null)
const endDate = ref(null)

const openedImage = ref({ photo: null, date: '' })
const uploadForm = ref({ files: [] })
const compressOnUpload = ref(true)

// --- Утилиты ---
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Б'
  const k = 1024
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getPhotoUrl = (photo) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7011/api'
  return `${baseUrl}/projects/${photo.projectId}/photos/${photo.id}/file`
}

// --- Вычисляемые свойства ---
const filteredPhotos = computed(() => {
  let result = photos.value
  if (startDate.value && endDate.value) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000
    const start = parseLocalDate(startDate.value).getTime()
    const end = parseLocalDate(endDate.value).getTime() + MS_PER_DAY
    result = photos.value.filter((photo) => photo.uploadedAt >= start && photo.uploadedAt < end)
  }
  if (hasReversedPhotos.value) {
    result = [...result].reverse()
  }
  return result
})

const hasDateFilterOn = computed(() => !!(startDate.value && endDate.value))
const hasPhotos = computed(() => photos.value.length > 0)
const showTopBtn = computed(() => scrollY.value > 100)

// --- Логика выделения ---
const toggleSelectAll = () => {
  if (
    selectedPhotoIds.value.size === filteredPhotos.value.length &&
    filteredPhotos.value.length > 0
  ) {
    selectedPhotoIds.value.clear()
  } else {
    filteredPhotos.value.forEach((p) => selectedPhotoIds.value.add(p.id))
  }
}

const toggleSelection = (id) => {
  if (selectedPhotoIds.value.has(id)) {
    selectedPhotoIds.value.delete(id)
  } else {
    selectedPhotoIds.value.add(id)
  }
}

// --- Watchers ---
watch(startDate, (newStartDate) => {
  if (!newStartDate) return
  if (!endDate.value) endDate.value = convertDateFormat(formatShortDate(new Date().getTime()))
  if (startDate.value > endDate.value) endDate.value = startDate.value
})

watch(endDate, (newEndDate) => {
  if (!newEndDate) return
  if (!startDate.value) startDate.value = '2001-01-01'
  if (endDate.value < startDate.value) startDate.value = endDate.value
})

watch([filteredPhotos, isSelectionMode], () => {
  if (!isSelectionMode.value) selectedPhotoIds.value.clear()
})

// Подключаем/отключаем слушатель клавиатуры при открытии/закрытии модалки
watch(showPhotoModal, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
})

// --- Методы ---
const resetDateFilter = () => {
  startDate.value = null
  endDate.value = null
}

const reversePhotos = () => {
  hasReversedPhotos.value = !hasReversedPhotos.value
}

const onScroll = () => {
  scrollY.value = window.scrollY
}
const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    project.value = { codeName: 'Неизвестный проект', customer: 'Заказчик' }
  }
  pageStore.pageInfo.name = `Галерея "${project.value.codeName}"`
}

const loadPhotos = async () => {
  isLoadingPhotos.value = true
  try {
    const data = await galleryApi.getPhotos(route.params.projectId)
    photos.value = data.map((photo) => ({ ...photo, fileSize: photo.fileSize || 0 }))
  } catch (error) {
    toast.error('Не удалось загрузить список фото')
  } finally {
    isLoadingPhotos.value = false
  }
}

const loadPhoto = (photo) => {
  if (isSelectionMode.value) {
    toggleSelection(photo.id)
    return
  }
  openedImage.value.photo = photo
  openedImage.value.date = photo.uploadedAt
  isModalImageLoading.value = true
  showPhotoModal.value = true
}

const onFullImageLoad = () => {
  isModalImageLoading.value = false
}
const onFullImageError = () => {
  isModalImageLoading.value = false
  toast.error('Ошибка загрузки фото')
}

const closePhotoModal = () => {
  showPhotoModal.value = false
  openedImage.value.photo = null
  isModalImageLoading.value = false
}

// === Навигация по фотографиям ===
const goToNextPhoto = () => {
  if (!openedImage.value.photo || filteredPhotos.value.length <= 1) return

  const currentIndex = filteredPhotos.value.findIndex((p) => p.id === openedImage.value.photo.id)

  if (currentIndex !== -1) {
    // Зацикливаем переход: если последнее, переходим к первому
    const nextIndex = (currentIndex + 1) % filteredPhotos.value.length
    loadPhoto(filteredPhotos.value[nextIndex])
  }
}

const goToPreviousPhoto = () => {
  if (!openedImage.value.photo || filteredPhotos.value.length <= 1) return

  const currentIndex = filteredPhotos.value.findIndex((p) => p.id === openedImage.value.photo.id)

  if (currentIndex !== -1) {
    // Зацикливаем переход: если первое, переходим к последнему
    const prevIndex = (currentIndex - 1 + filteredPhotos.value.length) % filteredPhotos.value.length
    loadPhoto(filteredPhotos.value[prevIndex])
  }
}

// Обработчик нажатий клавиш
const handleKeydown = (event) => {
  if (!showPhotoModal.value) return

  if (event.key === 'ArrowRight') {
    goToNextPhoto()
  } else if (event.key === 'ArrowLeft') {
    goToPreviousPhoto()
  } else if (event.key === 'Escape') {
    closePhotoModal()
  }
}

const openInNewTab = () => {
  if (openedImage.value.photo) window.open(getPhotoUrl(openedImage.value.photo), '_blank')
}

const deletePhotoHandler = async (photo) => {
  if (!project.value?.id || !photo?.id) return
  if (confirm('Вы уверены, что хотите удалить это фото?')) {
    try {
      await galleryApi.deletePhoto(project.value.id, photo.id)
      photos.value = photos.value.filter((p) => p.id !== photo.id)
      toast.success('Фото успешно удалено')
    } catch (error) {
      toast.error('Ошибка удаления фото')
    }
  }
}

const deleteSelectedPhotos = async () => {
  if (selectedPhotoIds.value.size === 0) return
  const count = selectedPhotoIds.value.size
  if (!confirm(`Вы уверены, что хотите удалить ${count} фото?`)) return

  try {
    await Promise.all(
      Array.from(selectedPhotoIds.value).map((id) => galleryApi.deletePhoto(project.value.id, id)),
    )
    photos.value = photos.value.filter((p) => !selectedPhotoIds.value.has(p.id))
    toast.success(`Успешно удалено ${count} фото`)
    selectedPhotoIds.value.clear()
    isSelectionMode.value = false
  } catch (error) {
    toast.error('Ошибка при групповом удалении')
  }
}

const compressImage = async (file) => {
  if (file.size < 500 * 1024) return file
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    })
    return new File([compressed], file.name, { type: compressed.type })
  } catch {
    return file
  }
}

const submitUpload = async () => {
  if (!uploadForm.value.files.length) return
  showModal.value = false
  const formData = new FormData()
  try {
    toast.info(compressOnUpload.value ? 'Сжатие изображений...' : 'Подготовка файлов...')
    const filesToUpload = compressOnUpload.value
      ? await Promise.all(uploadForm.value.files.map(compressImage))
      : uploadForm.value.files

    filesToUpload.forEach((file) => formData.append('files', file))
    await galleryApi.uploadPhoto(project.value.id, formData)

    uploadForm.value.files = []
    toast.success('Фотографии успешно загружены')
    resetDateFilter()
    await loadPhotos()
  } catch (error) {
    toast.error('Ошибка загрузки: ' + error.message)
  }
}

const handleFileChange = (event) => {
  uploadForm.value.files = [...uploadForm.value.files, ...Array.from(event.target.files)]
  event.target.value = ''
}

const deleteFileString = (index) => {
  uploadForm.value.files.splice(index, 1)
}

onMounted(async () => {
  await loadProject()
  await loadPhotos()
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="global-container">
    <div v-if="showTopBtn" class="top-btn" @click="scrollToTop"></div>

    <div class="gallery">
      <!-- === ХЕДЕР === -->
      <div class="gallery__header">
        <div v-if="hasPhotos" class="gallery__filter">
          <div class="gallery__date-from">
            <span>От: </span><a-input v-model="startDate" type="date" />
          </div>
          <div class="gallery__date-to">
            <span>До: </span><a-input v-model="endDate" type="date" />
          </div>
          <div>
            <a-button @click="reversePhotos">
              Сначала {{ hasReversedPhotos ? 'новые' : 'старые' }}
            </a-button>
          </div>

          <!-- 4-я колонка: действия и управление выделением -->
          <div class="gallery__filter-actions">
            <template v-if="!isSelectionMode">
              <a-button v-if="hasDateFilterOn" @click="resetDateFilter" class="btn-small">
                Сброс ({{ filteredPhotos.length }})
              </a-button>
              <span class="gallery__total-photos" v-else>Всего: {{ filteredPhotos.length }}</span>

              <a-button
                v-if="authStore.isAdmin"
                @click="isSelectionMode = true"
                class="btn-small btn-select-mode"
              >
                Выбрать
              </a-button>
            </template>

            <template v-else>
              <span class="selection-count">Выбрано: {{ selectedPhotoIds.size }}</span>
              <a-button
                @click="deleteSelectedPhotos"
                class="btn-small btn-danger"
                :disabled="selectedPhotoIds.size === 0"
              >
                Удалить
              </a-button>
              <a-button @click="isSelectionMode = false" class="btn-small btn-cancel">
                Отмена
              </a-button>
            </template>
          </div>
        </div>

        <div class="gallery__upload-btn-wrapper">
          <a-button @click="showModal = true">Загрузить фото</a-button>
        </div>
      </div>

      <div v-if="!hasPhotos" class="gallery__null-photo">Ещё нет загруженных фотографий!</div>

      <!-- === СЕТКА КАРТОЧЕК === -->
      <div v-else class="gallery__cards">
        <div
          v-for="photo in filteredPhotos"
          :key="photo.id"
          class="gallery__card"
          :class="{ 'gallery__card--selected': selectedPhotoIds.has(photo.id) }"
          @click="loadPhoto(photo)"
        >
          <!-- Чекбокс выделения -->
          <div
            v-if="isSelectionMode && authStore.isAdmin"
            class="selection-checkbox"
            @click.stop="toggleSelection(photo.id)"
          >
            <input type="checkbox" :checked="selectedPhotoIds.has(photo.id)" />
          </div>

          <img
            :src="getPhotoUrl(photo)"
            class="gallery__image-preview"
            loading="lazy"
            decoding="async"
            alt="preview"
          />

          <div class="gallery__image-footer">
            <div class="gallery__image-date">{{ formatShortDate(photo.uploadedAt) }}</div>
            <div
              v-if="authStore.isAdmin && !isSelectionMode"
              class="gallery__image-delete"
              @click.stop="deletePhotoHandler(photo)"
            >
              Удалить
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- === МОДАЛКА ЗАГРУЗКИ === -->
  <a-modal title="Загрузка фотографий" :opened="showModal" @close-emit="showModal = false">
    <form enctype="multipart/form-data" @submit.prevent="submitUpload">
      <label>Выберите фото с устройства</label>
      <a-input
        accept="image/*"
        class="form-input"
        type="file"
        multiple
        @change="handleFileChange"
      />

      <div class="compress-option">
        <label class="checkbox-label">
          <input type="checkbox" v-model="compressOnUpload" />
          Сжимать изображения перед загрузкой (рекомендуется)
        </label>
        <p class="compress-hint" v-if="compressOnUpload">Макс. размер: 1 МБ, ширина: 1920px.</p>
      </div>

      <div class="file-names">
        <div v-for="(file, index) in uploadForm.files" :key="index" class="file-string">
          <div class="file-name">{{ file.name }}</div>
          <div class="file-delete" @click="deleteFileString(index)">&times;</div>
        </div>
      </div>
      <a-button class="full-width-btn">Загрузить</a-button>
    </form>
  </a-modal>

  <!-- === МОДАЛКА ПРОСМОТРА === -->
  <a-modal
    title="Просмотр фотографии"
    :opened="showPhotoModal"
    @close-emit="closePhotoModal"
    @click.self="closePhotoModal"
    class="photo-view-modal"
  >
    <div class="modal-image-container">
      <div v-if="isModalImageLoading" class="image-loader">Загрузка изображения...</div>

      <!-- ДОБАВЛЕНО: @click="goToNextPhoto" и подсказка -->
      <img
        v-if="openedImage.photo"
        :src="getPhotoUrl(openedImage.photo)"
        class="image"
        @click="goToNextPhoto"
        @load="onFullImageLoad"
        @error="onFullImageError"
        v-show="!isModalImageLoading"
        alt="Просмотр (кликните для следующего)"
        title="Кликните для просмотра следующего фото"
      />

      <!-- Кнопки управления -->
      <div class="modal-controls">
        <button class="control-btn" @click="openInNewTab" title="Открыть в новой вкладке">↗</button>
        <button class="control-btn close-btn" @click="closePhotoModal" title="Закрыть (Esc)">
          &times;
        </button>
      </div>
    </div>

    <!-- Блок с информацией -->
    <div class="image-info">
      <div class="info-item">
        <span class="info-label">Дата:</span>
        <span>{{ formatShortDate(openedImage.date) }}</span>
      </div>
      <div class="info-item" v-if="openedImage.photo">
        <span class="info-label">Размер:</span>
        <span>{{ formatFileSize(openedImage.photo.fileSize) }}</span>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
/* === БАЗОВЫЕ СТИЛИ (Старый дизайн) === */
.global-container {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.top-btn {
  position: fixed;
  width: 48px;
  height: 48px;
  bottom: 20px;
  right: 20px;
  left: auto;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 100;
}
.top-btn::before {
  content: '↑';
  color: white;
  font-size: 24px;
  font-weight: bold;
}
.top-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.gallery__cards,
.gallery__header,
.gallery__null-photo {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: rgb(255, 255, 255);
  padding: 16px;
}

.gallery__header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.gallery__filter {
  align-items: center;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.gallery__date-from,
.gallery__date-to {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

/* Адаптация 4-й колонки под новые кнопки */
.gallery__filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
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

.selection-count {
  font-size: 14px;
  font-weight: 600;
  color: #4b5563;
  margin-right: 4px;
}

.gallery__upload-btn-wrapper {
  width: 100%;
}
.gallery__upload-btn-wrapper button {
  width: 100%;
}

.gallery__cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 16px;
  align-items: start;
}

.gallery__null-photo {
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  padding: 32px 16px;
}

.gallery__card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
}

.gallery__card:active {
  transform: scale(0.98);
}

/* Стили для выбранной карточки */
.gallery__card--selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

/* Чекбокс выделения */
.selection-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
}

.selection-checkbox input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
  margin: 0;
}

.gallery__image-preview {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
  background-color: #f5f5f5;
}

.gallery__image-footer {
  margin-top: 8px;
  gap: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 400;
  align-items: center;
}

.gallery__image-delete {
  color: rgb(145, 26, 26);
  transition: all 0.2s;
  padding: 6px 10px;
  border-radius: 4px;
  min-height: 36px;
  display: flex;
  align-items: center;
}
.gallery__image-delete:hover {
  color: rgb(219, 21, 21);
  background-color: rgba(219, 21, 21, 0.1);
}

/* === ФОРМЫ И МОДАЛКИ (Старые стили + новые элементы) === */
.form-input {
  margin-bottom: 16px;
  width: 100%;
}

.compress-option {
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  user-select: none;
}

.compress-hint {
  margin-top: 6px;
  margin-left: 26px;
  font-size: 12px;
  color: #6b7280;
}

.file-names {
  margin-bottom: 16px;
  max-height: 150px;
  overflow-y: auto;
}
.file-string {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}
.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 75%;
  font-size: 14px;
}
.file-delete {
  font-weight: 400;
  color: rgb(78, 78, 78);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  padding: 4px 8px;
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.file-delete:hover {
  color: rgb(219, 21, 21);
}
.full-width-btn {
  width: 100%;
}

/* === МОДАЛКА ПРОСМОТРА === */
.modal-image-container {
  position: relative;
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.image {
  max-height: 70vh;
  max-width: 95vw;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  cursor: pointer; /* Показываем, что можно кликнуть */
}

.image-loader {
  color: #6d6d6d;
  font-size: 16px;
  font-weight: 500;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}

/* Новые кнопки управления */
.modal-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 20;
}

.control-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.2s,
    transform 0.2s;
  backdrop-filter: blur(4px);
}
.control-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

/* Новый блок с информацией */
.image-info {
  margin-top: 16px;
  padding: 12px;
  background-color: #f9fafb;
  border-radius: 6px;
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  gap: 6px;
  font-size: 14px;
  color: #4b5563;
}

.info-label {
  font-weight: 600;
  color: #6b7280;
}

/* === ДЕСКТОПНЫЕ СТИЛИ (Старая адаптация) === */
@media (min-width: 768px) {
  .global-container {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .top-btn {
    left: 100px;
    right: auto;
    bottom: 100px;
  }

  .gallery__cards,
  .gallery__header,
  .gallery__null-photo {
    padding: 24px;
  }

  .gallery__header {
    flex-direction: row;
    justify-content: space-between;
    margin-top: 24px;
  }

  /* Возвращаем старую сетку хедера, но 4-ю колонку делаем 1fr, чтобы кнопки не ломали вёрстку */
  .gallery__filter {
    grid-template-columns: max-content max-content max-content 1fr;
    gap: 24px;
    width: auto;
  }

  .gallery__filter-actions {
    justify-content: flex-end;
  }

  .gallery__date-from,
  .gallery__date-to {
    gap: 12px;
    font-size: inherit;
  }

  .gallery__upload-btn-wrapper {
    width: auto;
  }
  .gallery__upload-btn-wrapper button {
    width: auto;
  }

  .gallery__cards {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 24px;
    margin-top: 24px;
  }

  .gallery__null-photo {
    margin-top: 24px;
    font-size: 18px;
    padding: 24px;
  }

  .gallery__card:hover {
    transform: scale(1.02);
  }
  .gallery__card:active {
    transform: none;
  }

  .gallery__image-preview {
    height: 200px;
  }
  .gallery__image-footer {
    font-size: 14px;
    gap: 12px;
  }
  .gallery__image-delete {
    padding: 4px 8px;
    min-height: auto;
  }

  .form-input {
    margin-bottom: 24px;
  }
  .file-names {
    margin-bottom: 25px;
    max-height: 200px;
  }
  .file-string {
    gap: 24px;
  }
  .file-name {
    max-width: 400px;
  }
  .file-delete {
    font-size: 18px;
    min-width: auto;
    min-height: auto;
    padding: 4px;
  }

  .full-width-btn {
    width: auto;
  }

  .image {
    max-height: 75vh;
    max-width: 90vw;
  }
  .image-info {
    margin-top: 20px;
  }
}
</style>

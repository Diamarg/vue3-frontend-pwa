<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import FileInput from '@/components/FileInput.vue'
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

const scrollY = ref(0)
const showModal = ref(false)
const showPhotoModal = ref(false)
const isLoadingPhotos = ref(true)
const isModalImageLoading = ref(false)
const hasReversedPhotos = ref(false)

const isSelectionMode = ref(false)
const selectedPhotoIds = ref(new Set())

const photos = ref([])
const project = ref({})
const startDate = ref(null)
const endDate = ref(null)

const openedImage = ref({ photo: null, date: '' })
const uploadForm = ref({ files: [] })
const compressOnUpload = ref(true)

const UPLOAD_BATCH_SIZE = 3
const UPLOAD_ATTEMPTS = 3
const isUploading = ref(false)
const uploadStage = ref('')

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
const currentPhotoIndex = computed(() =>
  filteredPhotos.value.findIndex((photo) => photo.id === openedImage.value.photo?.id),
)
const areAllVisibleSelected = computed(
  () =>
    filteredPhotos.value.length > 0 &&
    filteredPhotos.value.every((photo) => selectedPhotoIds.value.has(photo.id)),
)
const selectedFilesSize = computed(() =>
  uploadForm.value.files.reduce((total, file) => total + file.size, 0),
)

const toggleSelectAll = () => {
  if (areAllVisibleSelected.value) {
    filteredPhotos.value.forEach((photo) => selectedPhotoIds.value.delete(photo.id))
  } else {
    filteredPhotos.value.forEach((photo) => selectedPhotoIds.value.add(photo.id))
  }
}

const toggleSelection = (id) => {
  if (selectedPhotoIds.value.has(id)) {
    selectedPhotoIds.value.delete(id)
  } else {
    selectedPhotoIds.value.add(id)
  }
}

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

watch(showPhotoModal, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
})

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
  pageStore.setEntity(project.value.codeName)
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

const goToNextPhoto = () => {
  if (!openedImage.value.photo || filteredPhotos.value.length <= 1) return

  const currentIndex = filteredPhotos.value.findIndex((p) => p.id === openedImage.value.photo.id)
  if (currentIndex !== -1) {
    const nextIndex = (currentIndex + 1) % filteredPhotos.value.length
    loadPhoto(filteredPhotos.value[nextIndex])
  }
}

const goToPreviousPhoto = () => {
  if (!openedImage.value.photo || filteredPhotos.value.length <= 1) return

  const currentIndex = filteredPhotos.value.findIndex((p) => p.id === openedImage.value.photo.id)
  if (currentIndex !== -1) {
    const prevIndex = (currentIndex - 1 + filteredPhotos.value.length) % filteredPhotos.value.length
    loadPhoto(filteredPhotos.value[prevIndex])
  }
}

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

const openInNewTab = async () => {
  const photo = openedImage.value.photo
  if (!photo) return

  const newTab = window.open('about:blank', '_blank')
  if (!newTab) {
    toast.error('Браузер заблокировал открытие новой вкладки')
    return
  }
  newTab.opener = null

  try {
    const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
    const objectUrl = URL.createObjectURL(blob)
    newTab.location.replace(objectUrl)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch (error) {
    newTab.close()
    toast.error('Не удалось открыть фото')
  }
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
  if (confirm(`Вы уверены, что хотите удалить ${count} фото?`)) {
    try {
      await Promise.all(
        Array.from(selectedPhotoIds.value).map((id) =>
          galleryApi.deletePhoto(project.value.id, id),
        ),
      )
      photos.value = photos.value.filter((p) => !selectedPhotoIds.value.has(p.id))
      toast.success(`Успешно удалено ${count} фото`)
      selectedPhotoIds.value.clear()
      isSelectionMode.value = false
    } catch (error) {
      toast.error('Ошибка при групповом удалении')
    }
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

const compressAll = async (files) => {
  const result = []
  for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
    const chunk = await Promise.all(files.slice(i, i + UPLOAD_BATCH_SIZE).map(compressImage))
    result.push(...chunk)
    uploadStage.value = `Сжатие ${result.length} из ${files.length}`
  }
  return result
}

const describeUploadError = (error) => {
  const response = error.response
  if (!response) return 'связь оборвалась, пакет не дошёл'
  if (response.status === 413) return 'пакет больше лимита сервера'
  if (response.status === 401) return 'сессия истекла, войди заново'
  return response.data?.message || `сервер ответил ${response.status}`
}

const isRetryable = (error) => !error.response || error.response.status >= 500

const sendBatch = async (batch, projectId) => {
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    const formData = new FormData()
    batch.forEach((file) => formData.append('files', file))
    try {
      const result = await galleryApi.uploadPhoto(projectId, formData)
      return Array.isArray(result)
        ? { accepted: batch.length, rejects: [] }
        : { accepted: result?.data?.length ?? 0, rejects: result?.errors ?? [] }
    } catch (error) {
      const fatal = error.response?.status === 401
      if (!fatal && isRetryable(error) && attempt < UPLOAD_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500))
        continue
      }
      return { text: describeUploadError(error), fatal }
    }
  }
  return null
}

const submitUpload = async () => {
  if (isUploading.value) return
  const files = [...uploadForm.value.files]
  if (!files.length) return

  isUploading.value = true
  const failed = []
  const rejects = []
  let uploaded = 0

  try {
    const prepared = compressOnUpload.value ? await compressAll(files) : files
    const batches = []
    for (let i = 0; i < prepared.length; i += UPLOAD_BATCH_SIZE) {
      batches.push(prepared.slice(i, i + UPLOAD_BATCH_SIZE))
    }

    for (const batch of batches) {
      uploadStage.value = `Отправка ${uploaded + batch.length} из ${prepared.length}`
      const result = await sendBatch(batch, project.value.id)
      if (result?.text) {
        batch.forEach((file) => failed.push({ file, reason: result.text }))
        if (result.fatal) break
        continue
      }
      uploaded += result?.accepted ?? 0
      rejects.push(...(result?.rejects ?? []))
    }

    await loadPhotos()
    resetDateFilter()

    if (failed.length || rejects.length) {
      const reasons = [...new Set(failed.map((f) => f.reason))]
      toast.error(
        `Загружено ${uploaded} из ${prepared.length}: ${[...reasons, ...rejects].join('; ')}`,
      )
      uploadForm.value.files = failed.map((f) => f.file)
    } else {
      toast.success(`Загружено ${prepared.length} фото`)
      uploadForm.value.files = []
      showModal.value = false
    }
  } finally {
    isUploading.value = false
    uploadStage.value = ''
  }
}

const closeUploadModal = () => {
  if (isUploading.value) return
  showModal.value = false
}

const handleFilesSelect = (files) => {
  if (isUploading.value) return
  uploadForm.value.files = [...uploadForm.value.files, ...files]
}

const deleteFileString = (index) => {
  if (isUploading.value) return
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

    <main class="gallery">
      <header class="gallery__header">
        <div class="gallery__heading">
          <div class="gallery__breadcrumb admin-headbar__info">
            <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
            <span class="admin-headbar__separator">/</span>
            <span>Галерея</span>
          </div>

          <div class="gallery__title-row">
            <span class="gallery__title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="8.5" cy="9" r="1.5" />
                <path d="m4 17 5-5 4 4 3-3 4 4" />
              </svg>
            </span>
            <div>
              <div class="gallery__title-line">
                <h1 class="gallery__title">Галерея</h1>
                <span v-if="!isLoadingPhotos" class="gallery__count-badge">{{
                  photos.length
                }}</span>
              </div>
              <p class="gallery__subtitle">Фотографии и снимки выполненных работ</p>
            </div>
          </div>
        </div>

        <a-button v-if="authStore.isAdmin" class="gallery__upload" @click="showModal = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 16V4" />
            <path d="m7 9 5-5 5 5" />
            <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
          </svg>
          <span>Загрузить фото</span>
        </a-button>
      </header>

      <section
        v-if="!isLoadingPhotos && hasPhotos"
        class="gallery__toolbar"
        :class="{ 'gallery__toolbar--selection': isSelectionMode }"
        aria-label="Фильтры и действия галереи"
      >
        <div class="gallery__filters">
          <label class="gallery__date-field">
            <span>С даты</span>
            <a-input
              v-model="startDate"
              type="date"
              aria-label="Дата съёмки от"
              :disabled="isSelectionMode"
            />
          </label>
          <span class="gallery__date-dash" aria-hidden="true">—</span>
          <label class="gallery__date-field">
            <span>По дату</span>
            <a-input
              v-model="endDate"
              type="date"
              aria-label="Дата съёмки по"
              :disabled="isSelectionMode"
            />
          </label>
        </div>

        <div class="gallery__toolbar-actions">
          <template v-if="!isSelectionMode">
            <span class="gallery__result-count">{{ filteredPhotos.length }} фото</span>
            <button v-if="hasDateFilterOn" class="gallery__reset" @click="resetDateFilter">
              Сбросить
            </button>
            <a-button
              class="gallery__sort"
              title="Изменить порядок фотографий"
              @click="reversePhotos"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M8 4v16m-4-4 4 4 4-4" />
                <path d="M16 20V4m-4 4 4-4 4 4" />
              </svg>
              <span>{{ hasReversedPhotos ? 'Сначала старые' : 'Сначала новые' }}</span>
            </a-button>
            <a-button
              v-if="authStore.isAdmin"
              class="gallery__select"
              @click="isSelectionMode = true"
            >
              Выбрать
            </a-button>
          </template>

          <template v-else>
            <span class="selection-count">Выбрано: {{ selectedPhotoIds.size }}</span>
            <button class="gallery__reset" @click="toggleSelectAll">
              {{ areAllVisibleSelected ? 'Снять выделение' : 'Выбрать все' }}
            </button>
            <a-button
              class="toolbar-button toolbar-button--danger"
              :disabled="selectedPhotoIds.size === 0"
              @click="deleteSelectedPhotos"
            >
              Удалить
            </a-button>
            <a-button class="toolbar-button" @click="isSelectionMode = false">Отмена</a-button>
          </template>
        </div>
      </section>

      <div v-if="isLoadingPhotos" class="gallery__grid" aria-label="Загрузка фотографий">
        <div v-for="item in 8" :key="item" class="photo-skeleton">
          <div class="photo-skeleton__media skeleton-shimmer"></div>
          <div class="photo-skeleton__body">
            <div class="photo-skeleton__line photo-skeleton__line--wide skeleton-shimmer"></div>
            <div class="photo-skeleton__line skeleton-shimmer"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!hasPhotos" class="gallery__empty">
        <div class="gallery__empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <circle cx="8.5" cy="9" r="1.5" />
            <path d="m4 17 5-5 4 4 3-3 4 4" />
          </svg>
        </div>
        <h2>Здесь появятся фотографии</h2>
        <p>Снимки монтажных работ, оборудования или хода проекта.</p>
      </div>

      <div v-else-if="filteredPhotos.length === 0" class="gallery__empty">
        <div class="gallery__empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
            <path d="M8.5 11h5" />
          </svg>
        </div>
        <h2>Фотографии не найдены</h2>
        <p>В выбранном периоде нет снимков. Измените даты или сбросьте фильтр.</p>
        <a-button class="gallery__empty-action" @click="resetDateFilter">Сбросить фильтры</a-button>
      </div>

      <section v-else class="gallery__grid" aria-label="Фотографии проекта">
        <article
          v-for="photo in filteredPhotos"
          :key="photo.id"
          class="photo-card"
          :class="{ 'photo-card--selected': selectedPhotoIds.has(photo.id) }"
          :tabindex="isSelectionMode ? -1 : 0"
          :aria-label="photo.fileName || 'Открыть фотографию'"
          @click="loadPhoto(photo)"
          @keydown.enter.prevent="!isSelectionMode && loadPhoto(photo)"
          @keydown.space.prevent="!isSelectionMode && loadPhoto(photo)"
        >
          <div class="photo-card__media">
            <img
              :src="getPhotoUrl(photo)"
              class="photo-card__image"
              loading="lazy"
              decoding="async"
              :alt="photo.fileName || 'Фотография проекта'"
              draggable="false"
            />
            <div class="photo-card__shade" aria-hidden="true"></div>
            <span class="photo-card__open" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M14 4h6v6" />
                <path d="M20 4 11 13" />
                <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
              </svg>
            </span>

            <label
              v-if="isSelectionMode && authStore.isAdmin"
              class="photo-card__checkbox"
              @click.stop
            >
              <input
                type="checkbox"
                :checked="selectedPhotoIds.has(photo.id)"
                @change="toggleSelection(photo.id)"
              />
              <span class="photo-card__checkbox-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </span>
            </label>
          </div>

          <div class="photo-card__body">
            <div class="photo-card__details">
              <h2 class="photo-card__name" :title="photo.fileName || 'Фотография'">
                {{ photo.fileName || 'Фотография' }}
              </h2>
              <p class="photo-card__meta">
                <span>{{ formatShortDate(photo.uploadedAt) }}</span>
                <span class="photo-card__meta-dot" aria-hidden="true">·</span>
                <span>{{ formatFileSize(photo.fileSize) }}</span>
              </p>
            </div>

            <button
              v-if="authStore.isAdmin && !isSelectionMode"
              class="photo-card__delete"
              title="Удалить фотографию"
              aria-label="Удалить фотографию"
              @click.stop="deletePhotoHandler(photo)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path d="M4 7h16" />
                <path d="M9 7V4h6v3" />
                <path d="m7 7 1 13h8l1-13" />
                <path d="M10 11v5m4-5v5" />
              </svg>
            </button>
          </div>
        </article>
      </section>
    </main>
  </div>

  <a-modal title="Загрузка фотографий" :opened="showModal" @close-emit="closeUploadModal">
    <div class="upload-form">
      <div class="upload-intro">
        <h3>Добавьте фотографии</h3>
        <p>Можно выбрать несколько изображений или перетащить их в область загрузки.</p>
      </div>

      <FileInput
        class="file-input"
        accept="image/*"
        multiple
        :disabled="isUploading"
        hint="JPEG, PNG, WebP, GIF или BMP · до 20 МБ на файл"
        @select="handleFilesSelect"
      />

      <label class="compress-option">
        <input type="checkbox" v-model="compressOnUpload" :disabled="isUploading" />
        <span class="compress-option__text">
          <span>Сжимать изображения перед загрузкой</span>
          <small v-if="compressOnUpload">Макс. размер: 1 МБ, ширина: 1920px.</small>
        </span>
      </label>

      <div v-if="uploadForm.files.length" class="selected-files">
        <div class="selected-files__header">
          <span>Выбрано: {{ uploadForm.files.length }}</span>
          <span>{{ formatFileSize(selectedFilesSize) }}</span>
        </div>
        <div class="file-names">
          <div v-for="(file, index) in uploadForm.files" :key="index" class="file-string">
            <div class="file-name" :title="file.name">{{ file.name }}</div>
            <div class="file-size">{{ formatFileSize(file.size) }}</div>
            <button
              v-if="!isUploading"
              class="file-delete"
              title="Убрать файл"
              aria-label="Убрать файл"
              @click="deleteFileString(index)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p v-if="uploadStage" class="upload-stage">
        <span class="upload-stage__spinner" aria-hidden="true"></span>
        {{ uploadStage }}
      </p>
    </div>

    <template #footer>
      <div class="modal-actions">
        <button class="modal-cancel" :disabled="isUploading" @click="closeUploadModal">
          Отмена
        </button>
        <a-button
          class="modal-submit"
          :disabled="isUploading || uploadForm.files.length === 0"
          @click="submitUpload"
        >
          {{ isUploading ? 'Загрузка…' : 'Загрузить' }}
        </a-button>
      </div>
    </template>
  </a-modal>

  <a-modal
    title="Просмотр фотографии"
    :opened="showPhotoModal"
    class="photo-view-modal"
    @close-emit="closePhotoModal"
    @click.self="closePhotoModal"
  >
    <div v-if="openedImage.photo" class="photo-viewer">
      <div class="photo-viewer__stage">
        <div class="photo-viewer__topbar">
          <span class="photo-viewer__counter">
            {{ currentPhotoIndex + 1 }} / {{ filteredPhotos.length }}
          </span>
          <div class="photo-viewer__controls">
            <button
              class="viewer-control"
              title="Открыть в новой вкладке"
              aria-label="Открыть фотографию в новой вкладке"
              @click="openInNewTab"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M14 4h6v6" />
                <path d="M20 4 11 13" />
                <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
              </svg>
            </button>
            <button
              class="viewer-control"
              title="Закрыть (Esc)"
              aria-label="Закрыть просмотр"
              @click="closePhotoModal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <button
          v-if="filteredPhotos.length > 1"
          class="photo-viewer__nav photo-viewer__nav--prev"
          title="Предыдущее фото"
          aria-label="Предыдущее фото"
          @click="goToPreviousPhoto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m15 5-7 7 7 7" />
          </svg>
        </button>

        <div v-if="isModalImageLoading" class="photo-viewer__loader">
          <span aria-hidden="true"></span>
          <span>Загрузка изображения…</span>
        </div>

        <img
          :src="getPhotoUrl(openedImage.photo)"
          class="photo-viewer__image"
          :class="{ 'photo-viewer__image--loading': isModalImageLoading }"
          @click="goToNextPhoto"
          @load="onFullImageLoad"
          @error="onFullImageError"
          :alt="openedImage.photo.fileName || 'Просмотр фотографии'"
          :title="filteredPhotos.length > 1 ? 'Следующее фото' : undefined"
          draggable="false"
        />

        <button
          v-if="filteredPhotos.length > 1"
          class="photo-viewer__nav photo-viewer__nav--next"
          title="Следующее фото"
          aria-label="Следующее фото"
          @click="goToNextPhoto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>

        <div class="photo-viewer__info">
          <div class="photo-viewer__filename">
            {{ openedImage.photo.fileName || 'Фотография' }}
          </div>
          <div class="photo-viewer__meta">
            <span>{{ formatShortDate(openedImage.date) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ formatFileSize(openedImage.photo.fileSize) }}</span>
          </div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.global-container {
  padding: 16px;
}

.gallery {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-btn {
  position: fixed;
  width: 44px;
  height: 44px;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  background: rgba(31, 41, 55, 0.88);
  color: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.2s;
}

.top-btn::before {
  content: '↑';
  font-size: 22px;
  line-height: 1;
}

.top-btn:hover {
  background: rgba(31, 41, 55, 1);
  transform: translateY(-2px);
}

.gallery__header {
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

.gallery__heading {
  min-width: 0;
}

.gallery__breadcrumb {
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

.gallery__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.gallery__title-icon {
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

.gallery__title-icon svg {
  width: 23px;
  height: 23px;
}

.gallery__title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.gallery__title {
  margin: 0;
  color: #2d3748;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.2;
}

.gallery__count-badge {
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

.gallery__subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.45;
}

.gallery__upload.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: 500;
}

.gallery__upload svg {
  width: 18px;
  height: 18px;
}

.gallery__toolbar {
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

.gallery__toolbar--selection {
  border-color: #c7d2fe;
  background: #fbfbff;
}

.gallery__filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  width: 100%;
}

.gallery__date-field {
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

.gallery__date-field :deep(.input) {
  min-width: 0;
  min-height: 38px;
  padding: 8px 10px;
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

.gallery__date-field :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.gallery__date-field :deep(.input):disabled {
  background: #f8fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.gallery__date-dash {
  display: none;
  align-self: end;
  padding-bottom: 10px;
  color: #cbd5e0;
}

.gallery__toolbar-actions {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.gallery__result-count {
  margin-right: auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.gallery__reset {
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

.gallery__reset:hover {
  background: #eef2ff;
}

.gallery__sort.btn,
.gallery__select.btn,
.toolbar-button.btn {
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

.gallery__sort.btn:hover,
.gallery__select.btn:hover,
.toolbar-button.btn:hover {
  border-color: #c7d2fe;
  background: #f5f3ff;
  color: #4f46e5;
}

.gallery__sort svg {
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

.toolbar-button.btn:disabled {
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

.gallery__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.photo-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 20px -14px rgba(34, 60, 80, 0.28);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.photo-card:hover {
  border-color: #d4d7dd;
  box-shadow: 4px 4px 24px -12px rgba(34, 60, 80, 0.34);
  transform: translateY(-2px);
}

.photo-card:active {
  transform: translateY(0);
}

.photo-card:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 3px;
}

.photo-card--selected,
.photo-card--selected:hover {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
}

.photo-card__media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #f1f5f9;
}

.photo-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
  user-select: none;
}

.photo-card:hover .photo-card__image {
  transform: scale(1.035);
}

.photo-card__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.02) 45%, rgba(15, 23, 42, 0.24));
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.photo-card:hover .photo-card__shade,
.photo-card:focus-visible .photo-card__shade {
  opacity: 1;
}

.photo-card__open {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #374151;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.16);
  opacity: 0;
  transform: translateY(-3px);
  transition:
    opacity 0.2s,
    transform 0.2s;
  pointer-events: none;
}

.photo-card__open svg {
  width: 16px;
  height: 16px;
}

.photo-card:hover .photo-card__open,
.photo-card:focus-visible .photo-card__open {
  opacity: 1;
  transform: translateY(0);
}

.photo-card__checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  cursor: pointer;
}

.photo-card__checkbox input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.photo-card__checkbox-mark {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
  color: #fff;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.photo-card__checkbox-mark svg {
  width: 15px;
  height: 15px;
  opacity: 0;
}

.photo-card--selected .photo-card__checkbox-mark {
  border-color: #6366f1;
  background: #6366f1;
}

.photo-card--selected .photo-card__checkbox-mark svg {
  opacity: 1;
}

.photo-card__body {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px;
}

.photo-card__details {
  flex: 1;
  min-width: 0;
}

.photo-card__name {
  margin: 0;
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-card__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 4px 0 0;
  color: #9298a1;
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

.photo-card__meta-dot {
  color: #cbd5e0;
}

.photo-card__delete {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #a1a6af;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.photo-card__delete svg {
  width: 17px;
  height: 17px;
}

.photo-card__delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

.photo-skeleton {
  overflow: hidden;
  border: 1px solid #eceef1;
  border-radius: 12px;
  background: #fff;
}

.photo-skeleton__media {
  aspect-ratio: 4 / 3;
  background: #eef0f3;
}

.photo-skeleton__body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
}

.photo-skeleton__line {
  width: 58%;
  height: 9px;
  border-radius: 999px;
  background: #eef0f3;
}

.photo-skeleton__line--wide {
  width: 82%;
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

.gallery__empty {
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

.gallery__empty-icon {
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

.gallery__empty-icon svg {
  width: 30px;
  height: 30px;
}

.gallery__empty h2 {
  margin: 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.gallery__empty p {
  max-width: 440px;
  margin: 8px 0 0;
  color: #8a8f98;
  font-size: 14px;
  line-height: 1.55;
}

.gallery__empty-action.btn {
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

.file-input {
  margin: 0;
}

.compress-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  color: #4b5563;
  cursor: pointer;
}

.compress-option input {
  width: 17px;
  height: 17px;
  margin: 1px 0 0;
  accent-color: #6366f1;
  cursor: pointer;
}

.compress-option__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
}

.compress-option__text small {
  color: #8a8f98;
  font-size: 12px;
  font-weight: 400;
}

.selected-files {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.selected-files__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef0f3;
  background: #f9fafb;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
}

.file-names {
  max-height: 190px;
  overflow-y: auto;
}

.file-string {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 7px 10px 7px 12px;
  border-bottom: 1px solid #f0f1f3;
}

.file-string:last-child {
  border-bottom: 0;
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #4b5563;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  flex: 0 0 auto;
  color: #9298a1;
  font-size: 11px;
  white-space: nowrap;
}

.file-delete {
  display: grid;
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #9298a1;
  cursor: pointer;
}

.file-delete svg {
  width: 16px;
  height: 16px;
}

.file-delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

.upload-stage {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 500;
}

.upload-stage__spinner,
.photo-viewer__loader span:first-child {
  width: 16px;
  height: 16px;
  border: 2px solid #c7d2fe;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.photo-viewer {
  width: min(1100px, calc(100vw - 32px));
  color: #374151;
}

.photo-viewer__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(68vh, 720px);
  padding: 58px 64px 82px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #f3f4f6;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
}

.photo-viewer__topbar {
  position: absolute;
  top: 12px;
  right: 14px;
  left: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.photo-viewer__counter {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(8px);
}

.photo-viewer__controls {
  display: flex;
  gap: 8px;
}

.viewer-control,
.photo-viewer__nav {
  display: grid;
  place-items: center;
  border: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.92);
  color: #4b5563;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition:
    background 0.2s,
    border-color 0.2s,
    color 0.2s,
    transform 0.2s;
}

.viewer-control {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.viewer-control svg,
.photo-viewer__nav svg {
  width: 19px;
  height: 19px;
}

.viewer-control:hover,
.photo-viewer__nav:hover {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4f46e5;
  transform: scale(1.05);
}

.photo-viewer__nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  transform: translateY(-50%);
}

.photo-viewer__nav:hover {
  transform: translateY(-50%) scale(1.05);
}

.photo-viewer__nav--prev {
  left: 14px;
}

.photo-viewer__nav--next {
  right: 14px;
}

.photo-viewer__image {
  display: block;
  max-width: 100%;
  max-height: 64vh;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  object-fit: contain;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s;
}

.photo-viewer__image--loading {
  opacity: 0;
}

.photo-viewer__loader {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #6b7280;
  font-size: 13px;
  transform: translate(-50%, -50%);
}

.photo-viewer__loader span:first-child {
  width: 26px;
  height: 26px;
  border-color: #d1d5db;
  border-top-color: #6366f1;
}

.photo-viewer__info {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 62px;
  padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
}

.photo-viewer__filename {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-viewer__meta {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: #9298a1;
  font-size: 12px;
  white-space: nowrap;
}

@media (hover: none) {
  .photo-card__open {
    opacity: 0.9;
    transform: none;
  }

  .photo-card__shade {
    opacity: 0.45;
  }
}

@media (max-width: 380px) {
  .gallery__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (min-width: 560px) {
  .gallery__filters {
    grid-template-columns: minmax(140px, 1fr) auto minmax(140px, 1fr);
    align-items: end;
  }

  .gallery__date-dash {
    display: block;
  }
}

@media (min-width: 640px) {
  .gallery__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
  }

  .gallery__upload.btn {
    width: auto;
  }

  .gallery__toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
  }

  .gallery__filters {
    width: auto;
    flex: 0 1 390px;
  }

  .gallery__toolbar-actions {
    flex: 0 1 auto;
    justify-content: flex-end;
  }

  .gallery__result-count {
    margin-right: 0;
  }

  .gallery__grid {
    gap: 16px;
  }

  .photo-card__body {
    padding: 13px;
  }

  .photo-card__name {
    font-size: 14px;
  }

  .photo-card__meta {
    font-size: 12px;
  }

  .modal-actions {
    flex-direction: row;
  }
}

@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .gallery {
    gap: 20px;
  }

  .gallery__header {
    padding: 24px;
  }

  .gallery__breadcrumb {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .gallery__title-icon {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .gallery__title {
    font-size: 26px;
  }

  .gallery__subtitle {
    font-size: 14px;
  }

  .gallery__upload.btn {
    min-height: 42px;
    padding: 10px 16px;
    font-size: 15px;
  }

  .gallery__toolbar {
    padding: 14px 16px;
  }

  .gallery__date-field :deep(.input) {
    padding-inline: 12px;
    font-size: 14px;
  }

  .gallery__grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 18px;
  }

  .gallery__empty {
    min-height: 380px;
    padding: 48px 24px;
  }

  .top-btn {
    right: auto;
    bottom: 92px;
    left: 92px;
  }

  .photo-viewer__stage {
    padding-right: 72px;
    padding-left: 72px;
  }
}

@media (min-width: 1100px) {
  .gallery__grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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

  .photo-viewer {
    width: calc(100vw - 20px);
  }

  .photo-viewer__stage {
    min-height: 62vh;
    padding: 56px 12px 88px;
    border-radius: 12px;
  }

  .photo-viewer__image {
    max-height: 58vh;
  }

  .photo-viewer__nav {
    width: 36px;
    height: 36px;
  }

  .photo-viewer__nav--prev {
    left: 8px;
  }

  .photo-viewer__nav--next {
    right: 8px;
  }

  .photo-viewer__info {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 5px;
    min-height: 76px;
    padding: 10px 14px;
  }

  .photo-viewer__filename {
    width: 100%;
  }
}

@media (max-height: 600px) and (orientation: landscape) {
  .photo-viewer__stage {
    min-height: 76vh;
    padding-top: 48px;
    padding-bottom: 68px;
  }

  .photo-viewer__image {
    max-height: 52vh;
  }

  .photo-viewer__info {
    min-height: 52px;
    padding-block: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-card,
  .photo-card__image,
  .photo-card__open,
  .photo-card__shade,
  .top-btn,
  .viewer-control,
  .photo-viewer__nav {
    transition: none;
  }

  .skeleton-shimmer::after,
  .upload-stage__spinner,
  .photo-viewer__loader span:first-child {
    animation: none;
  }
}
</style>

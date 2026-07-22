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

// --- Данные ---
const photos = ref([])
const project = ref({})
const startDate = ref(null)
const endDate = ref(null)

const openedImage = ref({ photo: null, date: '' })
const uploadForm = ref({ files: [] })

// --- Клиентская пагинация ---
const visibleCount = ref(20)
const loadMore = () => {
  visibleCount.value += 20
}

/**
 * Формирует ПРЯМОЙ URL для тега <img>.
 * Браузер сам прикрепит Cookie auth_token к запросу.
 */
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

// Пагинация зависит от filteredPhotos
const visiblePhotos = computed(() => filteredPhotos.value.slice(0, visibleCount.value))

const hasDateFilterOn = computed(() => !!(startDate.value && endDate.value))
const hasPhotos = computed(() => photos.value.length > 0)
const showTopBtn = computed(() => scrollY.value > 100)

// Сбрасываем пагинацию при изменении фильтра
watch(filteredPhotos, () => {
  visibleCount.value = 20
})

// --- Watchers для дат ---
watch(startDate, (newStartDate) => {
  if (!newStartDate) return
  if (!endDate.value) {
    endDate.value = convertDateFormat(formatShortDate(new Date().getTime()))
  }
  if (startDate.value > endDate.value) {
    endDate.value = startDate.value
  }
})

watch(endDate, (newEndDate) => {
  if (!newEndDate) return
  if (!startDate.value) {
    startDate.value = '2001-01-01'
  }
  if (endDate.value < startDate.value) {
    startDate.value = endDate.value
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
    console.error('Ошибка загрузки проекта:', error)
    project.value = { codeName: 'Неизвестный проект', customer: 'Заказчик' }
  }
  pageStore.pageInfo.name = `Галерея "${project.value.codeName}"`
}

/**
 * Загружает ТОЛЬКО метаданные. Картинки загружаются браузером нативно через <img src>.
 */
const loadPhotos = async () => {
  isLoadingPhotos.value = true
  try {
    const data = await galleryApi.getPhotos(route.params.projectId)
    photos.value = data.map((photo) => ({
      ...photo,
      fileSize: photo.fileSize || 0,
    }))
  } catch (error) {
    console.error('Failed to load photos:', error)
    toast.error('Не удалось загрузить список фото')
  } finally {
    isLoadingPhotos.value = false
  }
}

/**
 * Открывает модалку просмотра. Картинка загружается браузером нативно.
 */
const loadPhoto = (photo) => {
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

const deletePhotoHandler = async (photo) => {
  if (!project.value?.id || !photo?.id) return

  if (confirm('Вы уверены, что хотите удалить это фото?')) {
    try {
      await galleryApi.deletePhoto(project.value.id, photo.id)
      photos.value = photos.value.filter((p) => p.id !== photo.id)
      toast.success('Фото успешно удалено')
    } catch (error) {
      toast.error('Ошибка удаления фото')
      console.error('Ошибка удаления фото', error)
    }
  }
}

const compressImage = async (file) => {
  if (file.size < 500 * 1024) return file

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  }

  try {
    const compressedFile = await imageCompression(file, options)
    return new File([compressedFile], file.name, { type: compressedFile.type })
  } catch (error) {
    console.error('Ошибка сжатия изображения:', error)
    return file
  }
}

const submitUpload = async () => {
  if (!uploadForm.value.files.length) return
  showModal.value = false
  const formData = new FormData()

  toast.info('Сжатие изображений...')

  try {
    const compressedFiles = await Promise.all(uploadForm.value.files.map(compressImage))

    for (const file of compressedFiles) {
      formData.append('files', file)
    }

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
  const newFiles = Array.from(event.target.files)
  uploadForm.value.files = [...uploadForm.value.files, ...newFiles]
  event.target.value = ''
}

const deleteFileString = (index) => {
  uploadForm.value.files.splice(index, 1)
}

// --- Хуки жизненного цикла ---
onMounted(async () => {
  await loadProject()
  await loadPhotos()
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="global-container">
    <div v-if="showTopBtn" class="top-btn" @click="scrollToTop"></div>

    <div class="gallery">
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
          <div>
            <a-button v-if="hasDateFilterOn" @click="resetDateFilter">
              Сброс фильтра ({{ filteredPhotos.length }} фото)
            </a-button>
            <span class="gallery__total-photos" v-else
              >Всего: {{ filteredPhotos.length }} фото</span
            >
          </div>
        </div>

        <div class="gallery__upload-btn-wrapper">
          <a-button @click="showModal = true">Загрузить фото</a-button>
        </div>
      </div>

      <div v-if="!hasPhotos" class="gallery__null-photo">Ещё нет загруженных фотографий!</div>

      <div v-else class="gallery__cards">
        <div
          v-for="photo in visiblePhotos"
          :key="photo.id"
          class="gallery__card"
          @click="loadPhoto(photo)"
        >
          <!-- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: прямой URL вместо Blob -->
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
              v-if="authStore.isAdmin"
              class="gallery__image-delete"
              @click.stop="deletePhotoHandler(photo)"
            >
              Удалить
            </div>
          </div>
        </div>
      </div>

      <div v-if="visibleCount < filteredPhotos.length" class="gallery__load-more">
        <a-button @click="loadMore">
          Показать ещё (осталось {{ filteredPhotos.length - visibleCount }})
        </a-button>
      </div>
    </div>
  </div>

  <!-- Модалка загрузки -->
  <a-modal title="Загрузка фотографий" :opened="showModal" @close-emit="showModal = false">
    <form enctype="multipart/form-data" @submit.prevent="submitUpload">
      <label>Выберите фото с устройства</label>
      <a-input
        accept="image/*"
        class="form-input"
        type="file"
        multiple
        @change="handleFileChange"
      ></a-input>
      <div class="file-names">
        <div v-for="(file, index) in uploadForm.files" :key="index" class="file-string">
          <div class="file-name">{{ file.name }}</div>
          <div class="file-delete" @click="deleteFileString(index)">&times;</div>
        </div>
      </div>
      <a-button class="full-width-btn">Загрузить</a-button>
    </form>
  </a-modal>

  <!-- Модалка просмотра -->
  <a-modal
    title="Просмотр фотографии"
    :opened="showPhotoModal"
    @close-emit="closePhotoModal"
    @click.self="closePhotoModal"
  >
    <div class="modal-image-container">
      <div v-if="isModalImageLoading" class="image-loader">Загрузка изображения...</div>
      <!-- Картинка тоже через прямой URL -->
      <img
        v-if="openedImage.photo"
        :src="getPhotoUrl(openedImage.photo)"
        class="image"
        @load="onFullImageLoad"
        @error="onFullImageError"
        v-show="!isModalImageLoading"
        alt="Просмотр"
      />
    </div>
    <div class="image__date">Загружено: {{ formatShortDate(openedImage.date) }}</div>
  </a-modal>
</template>

<style scoped>
/* === БАЗОВЫЕ СТИЛИ (Mobile First) === */
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
}

.gallery__card:active {
  transform: scale(0.98);
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

.gallery__load-more {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  margin-bottom: 16px;
}

.modal-image-container {
  position: relative;
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
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

.image {
  max-height: 70vh;
  max-width: 95vw;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.form-input {
  margin-bottom: 16px;
  width: 100%;
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

.image__date {
  margin-top: 16px;
  text-align: center;
  font-weight: 400;
  color: #6d6d6d;
  font-size: 14px;
}

.full-width-btn {
  width: 100%;
}

/* === ДЕСКТОПНЫЕ СТИЛИ === */
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

  .gallery__filter {
    grid-template-columns: max-content max-content max-content max-content;
    gap: 24px;
    width: auto;
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

  .image {
    max-height: 75vh;
    max-width: 90vw;
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

  .image__date {
    margin-top: 20px;
    font-size: inherit;
  }

  .full-width-btn {
    width: auto;
  }

  .gallery__load-more {
    margin-bottom: 24px;
  }
}
</style>

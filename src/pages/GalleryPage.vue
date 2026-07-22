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
const imgUrls = ref({}) // Хранилище Blob URL для превью

const openedImage = ref({
  url: '',
  date: '',
})

const uploadForm = ref({
  files: [],
})

// --- Оптимизация: Отслеживание ленивой загрузки ---
const loadingImageIds = new Set()
const observers = new Map()

/**
 * Настраивает IntersectionObserver для ленивой загрузки конкретного фото.
 * Запрос к API делается только когда элемент появляется near viewport.
 */
const setupLazyLoad = (el, photo) => {
  // Если элемент удалён из DOM, очищаем observer
  if (!el) {
    const obs = observers.get(photo.id)
    if (obs) {
      obs.disconnect()
      observers.delete(photo.id)
    }
    return
  }

  // Если уже загружено или сейчас загружается, ничего не делаем
  if (imgUrls.value[photo.id] || loadingImageIds.has(photo.id)) return

  const observer = new IntersectionObserver(
    async (entries) => {
      if (entries[0].isIntersecting) {
        loadingImageIds.add(photo.id)
        try {
          const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
          imgUrls.value[photo.id] = URL.createObjectURL(blob)
        } catch (error) {
          console.error('Ошибка загрузки превью:', error)
        } finally {
          loadingImageIds.delete(photo.id)
          observer.disconnect()
          observers.delete(photo.id)
        }
      }
    },
    { rootMargin: '300px' },
  ) // Начинаем грузить за 300px до появления на экране

  observers.set(photo.id, observer)
  observer.observe(el)
}

// --- Вычисляемые свойства (Computed) ---
// ВАЖНО: filteredPhotos объявлен до любых watch или computed, которые от него зависят
const filteredPhotos = computed(() => {
  let result = photos.value

  if (startDate.value && endDate.value) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000
    const start = parseLocalDate(startDate.value).getTime()
    const end = parseLocalDate(endDate.value).getTime() + MS_PER_DAY
    result = photos.value.filter((photo) => photo.uploadedAt >= start && photo.uploadedAt < end)
  }

  if (hasReversedPhotos.value) {
    result = [...result].reverse() // Совместимая альтернатива toReversed()
  }

  return result
})

const hasDateFilterOn = computed(() => !!(startDate.value && endDate.value))
const hasPhotos = computed(() => photos.value.length > 0)
const showTopBtn = computed(() => scrollY.value > 100)

// --- Watchers ---
watch(startDate, (newStartDate) => {
  if (!newStartDate) return
  if (!endDate.value) {
    const nowTimestamp = new Date().getTime()
    endDate.value = convertDateFormat(formatShortDate(nowTimestamp))
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
 * Загружает ТОЛЬКО метаданные. Blob-файлы загрузятся лениво.
 */
const loadPhotos = async () => {
  isLoadingPhotos.value = true

  // Очистка старой памяти
  Object.values(imgUrls.value).forEach((url) => URL.revokeObjectURL(url))
  imgUrls.value = {}

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
 * Мгновенно открывает модалку и загружает полное фото в фоне.
 */
const loadPhoto = async (photo) => {
  showPhotoModal.value = true
  isModalImageLoading.value = true

  // Очищаем предыдущее фото, чтобы не было мерцания старого изображения
  if (openedImage.value.url) {
    URL.revokeObjectURL(openedImage.value.url)
    openedImage.value.url = ''
  }
  openedImage.value.date = photo.uploadedAt

  try {
    const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
    openedImage.value.url = URL.createObjectURL(blob)
  } catch (error) {
    toast.error('Ошибка загрузки фото с сервера')
    console.error('Ошибка загрузки фото:', error)
  } finally {
    isModalImageLoading.value = false
  }
}

const closePhotoModal = () => {
  if (openedImage.value.url) {
    URL.revokeObjectURL(openedImage.value.url)
    openedImage.value.url = ''
  }
  showPhotoModal.value = false
  isModalImageLoading.value = false
}

const deletePhotoHandler = async (photo) => {
  if (!project.value?.id || !photo?.id) return

  if (confirm('Вы уверены, что хотите удалить это фото?')) {
    try {
      await galleryApi.deletePhoto(project.value.id, photo.id)

      // Точечная очистка памяти и массива без полной перезагрузки (работает мгновенно)
      if (imgUrls.value[photo.id]) {
        URL.revokeObjectURL(imgUrls.value[photo.id])
        delete imgUrls.value[photo.id]
      }
      photos.value = photos.value.filter((p) => p.id !== photo.id)
      toast.success('Фото успешно удалено')
    } catch (error) {
      toast.error('Ошибка удаления фото')
      console.error('Ошибка удаления фото', error)
    }
  }
}

const compressImage = async (file) => {
  // Если файл меньше 500 КБ, пропускаем сжатие для экономии времени
  if (file.size < 500 * 1024) return file

  const options = {
    maxSizeMB: 1, // Максимальный размер файла: 1 МБ
    maxWidthOrHeight: 1920, // Максимальное разрешение по большей стороне
    useWebWorker: true, // ВАЖНО: сжатие в фоновом потоке, интерфейс не зависнет
    fileType: 'image/jpeg', // Конвертируем в JPEG для максимального сжатия
    initialQuality: 0.8, // Баланс между качеством и размером
  }

  try {
    const compressedFile = await imageCompression(file, options)
    // Библиотека возвращает File, но с новым именем. Вернём оригинальное имя, чтобы на сервере было красиво
    return new File([compressedFile], file.name, { type: compressedFile.type })
  } catch (error) {
    console.error('Ошибка сжатия изображения:', error)
    return file // В случае ошибки отправляем оригинал
  }
}

const submitUpload = async () => {
  if (!uploadForm.value.files.length) return
  showModal.value = false
  const formData = new FormData()

  // Показываем уведомление о начале сжатия
  toast.info('Сжатие изображений...')

  try {
    // Сжимаем все файлы параллельно
    const compressedFiles = await Promise.all(
      uploadForm.value.files.map((file) =>
        compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
          mimeType: 'image/jpeg',
          maxSizeBytes: 500 * 1024, // 500 КБ
        }),
      ),
    )

    // Добавляем в FormData уже сжатые файлы
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
  await loadPhotos() // Загружаем только метаданные
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
})

onBeforeUnmount(() => {
  // 1. Отключаем все наблюдатели
  observers.forEach((obs) => obs.disconnect())

  // 2. Освобождаем все Blob URL превью
  Object.values(imgUrls.value).forEach((url) => URL.revokeObjectURL(url))
  imgUrls.value = {}

  // 3. Освобождаем URL открытого изображения
  if (openedImage.value.url) {
    URL.revokeObjectURL(openedImage.value.url)
  }

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
            <span v-else>Всего: {{ filteredPhotos.length }} фото</span>
          </div>
        </div>

        <div>
          <a-button @click="showModal = true">Загрузить фото</a-button>
        </div>
      </div>

      <div v-if="!hasPhotos" class="gallery__null-photo">Ещё нет загруженных фотографий!</div>

      <div v-else class="gallery__cards">
        <div
          v-for="photo in filteredPhotos"
          :key="photo.id"
          class="gallery__card"
          @click="loadPhoto(photo)"
        >
          <!-- Если Blob уже загружен, показываем его с нативным lazy loading -->
          <img
            v-if="imgUrls[photo.id]"
            class="gallery__image-preview"
            :src="imgUrls[photo.id]"
            loading="lazy"
            alt="preview"
          />
          <!-- Если Blob ещё не загружен, показываем заглушку и вешаем на неё Observer -->
          <img
            v-else
            :ref="(el) => setupLazyLoad(el, photo)"
            class="gallery__image-placeholder"
            src="/src/img/camera.png"
            alt="loading"
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
      <a-button>Загрузить</a-button>
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
      <!-- Индикатор загрузки внутри модалки -->
      <div v-if="isModalImageLoading" class="image-loader">Загрузка изображения...</div>

      <!-- Само изображение (показываем через v-show, чтобы не схлопывало модалку до загрузки) -->
      <img
        v-show="!isModalImageLoading && openedImage.url"
        class="image"
        :src="openedImage.url"
        alt="Просмотр"
      />
    </div>
    <div class="image__date">Загружено: {{ formatShortDate(openedImage.date) }}</div>
  </a-modal>
</template>

<style scoped>
.top-btn {
  position: fixed;
  width: 48px;
  height: 48px;
  bottom: 100px;
  left: 100px;
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
  padding: 24px;
}

.gallery__cards {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(280px, auto));
  margin-top: 24px;
  align-items: start; /* Изменено с center для корректной работы grid */
}

.gallery__null-photo {
  margin-top: 24px;
  text-align: center;
  font-size: 18px;
}

.gallery__card {
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.gallery__card:hover {
  transform: scale(1.02);
}

.gallery__header {
  display: flex;
  margin-top: 24px;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.gallery__filter {
  display: grid;
  grid-template-columns: max-content max-content max-content max-content;
  align-items: center;
  justify-items: center;
  gap: 24px;
}

.gallery__date-from,
.gallery__date-to {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gallery__image-preview,
.gallery__image-placeholder {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 4px;
  display: block;
  background-color: #f5f5f5; /* Фон пока грузится */
}

.gallery__image-footer {
  margin-top: 8px;
  gap: 12px;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 400;
  align-items: center;
}

.gallery__image-delete {
  color: rgb(145, 26, 26);
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 4px;
}

.gallery__image-delete:hover {
  color: rgb(219, 21, 21);
  background-color: rgba(219, 21, 21, 0.1);
}

/* Стили для модального окна просмотра */
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
  max-height: 75vh;
  max-width: 90vw;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.form-input {
  margin-bottom: 24px;
  width: 100%;
}

.file-names {
  margin-bottom: 25px;
  max-height: 200px;
  overflow-y: auto;
}

.file-string {
  display: flex;
  gap: 24px;
  text-align: center;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
  font-size: 14px;
}

.file-delete {
  font-weight: 400;
  color: rgb(78, 78, 78);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 4px;
}

.file-delete:hover {
  color: rgb(219, 21, 21);
}

.image__date {
  margin-top: 20px;
  text-align: center;
  font-weight: 400;
  color: #6d6d6d;
}

/* Адаптивность для фильтров на мобильных */
@media (max-width: 768px) {
  .gallery__filter {
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }
  .gallery__header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

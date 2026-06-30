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


const props = defineProps({
  projectId: '',
})

const route = useRoute()
const authStore = useAuthStore()
const pageStore = usePageStore()

const scrollY = ref(0)
const showModal = ref(false)
const showPhotoModal = ref(false)
const photos = ref([])
const startDate = ref(null)
const endDate = ref(null)
const project = ref({})
const imgUrls = ref({})
const isLoadingPhotos = ref(false)

const openedImage = ref({
  url: '',
  date: '',
})

const uploadForm = ref({
  files: [],
})

watch(startDate, (newStartDate) => {
  if (!newStartDate) return



  if (!endDate.value ) {
    const nowTimestamp = new Date().getTime();
    const shortDate = formatShortDate(nowTimestamp)
    endDate.value = convertDateFormat(shortDate) ;
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
    console.log("endDate: ", endDate.value)
  }

})

const hasDateFilterOn = computed(() => {
  if (startDate.value && endDate.value) return true
})

const resetDateFilter = () => {
  startDate.value = null
  endDate.value = null
}

const hasPhotos = computed(() => photos.value.length > 0)

const filteredPhotos = computed(() => {
  if (!startDate.value || !endDate.value) return photos.value

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const start = parseLocalDate(startDate.value).getTime()
  const end = parseLocalDate(endDate.value).getTime() + MS_PER_DAY

  return photos.value.filter((photo) => photo.uploadedAt >= start && photo.uploadedAt < end)
})

const showTopBtn = computed(() => scrollY.value > 100)

const onScroll = () => {
  scrollY.value = window.scrollY
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}
const submitUpload = async () => {
  if (!uploadForm.value.files.length) {
    console.log('Нет файлов для загрузки')
    return
  }

  const formData = new FormData()
  for (const file of uploadForm.value.files) {
    formData.append('files', file)
  }

  try {
    await galleryApi.uploadPhoto(project.value.id, formData)
    uploadForm.value.files = []
    showModal.value = false
    await loadPhotos()
  } catch (error) {
    console.error('Ошибка загрузки:', error)
  }
}

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Failed to load project:', error)
    project.value = { codeName: 'Неизвестный проект', customer: 'Заказчик' }
  }
  pageStore.pageInfo.name = `Галерея "${project.value.codeName}"`
}

const loadPhotos = async () => {
  isLoadingPhotos.value = true

  // Освобождаем старые blob URL
  Object.values(imgUrls.value).forEach((url) => URL.revokeObjectURL(url))
  imgUrls.value = {}

  try {
    const data = await galleryApi.getPhotos(route.params.projectId)
    photos.value = data.map((photo) => ({
      ...photo,
      fileSize: photo.fileSize || 0,
    }))

    // Параллельная загрузка всех фото
    const results = await Promise.allSettled(
      photos.value.map(async (photo) => {
        const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
        return { id: photo.id, blob }
      }),
    )

    // Создаем URL только для успешно загруженных
    for (const result of results) {
      if (result.status === 'fulfilled') {
        imgUrls.value[result.value.id] = URL.createObjectURL(result.value.blob)
      }
    }
  } catch (error) {
    console.error('Failed to load photos:', error)
  } finally {
    isLoadingPhotos.value = false
  }
}

const loadPhoto = async (photo) => {
  try {
    const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
    openedImage.value.url = URL.createObjectURL(blob)
    openedImage.value.date = photo.uploadedAt
    showPhotoModal.value = true
  } catch (error) {
    alert('Ошибка загрузки фото с сервера')
    console.error('Ошибка загрузки фото:', error)
  }
}

const deletePhotoHandler = async (photo) => {
  if (!project.value?.id || !photo?.id) {
  console.warn('Некорректные данные для удаления');
  return;
}
  if (confirm('Вы уверены, что хотите удалить это фото?')) {
  try {
    await galleryApi.deletePhoto(project.value.id, photo.id)
    await loadPhotos()
  } catch (error) {
    console.error("Ошибка удаления фото", error)
  }

} else {
  console.log('Удаление фото отменено!');
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

onMounted(async () => {
  await loadProject()
  await loadPhotos()
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
  console.log(formatShortDate('2025-12-05'))
})

onBeforeUnmount(() => {
  // Освобождаем все blob URL
  Object.values(imgUrls.value).forEach((url) => URL.revokeObjectURL(url))
  imgUrls.value = {}

  // Освобождаем URL открытого изображения
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
            <a-button v-if="hasDateFilterOn" @click="resetDateFilter">Сброс</a-button>
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
          <img v-if="imgUrls[photo.id]" class="gallery__image-preview" :src="imgUrls[photo.id]"></img>
          <img v-else class="gallery__image-placeholder" src="/src/img/camera.png" />
          <div class="gallery__image-footer">
            <div class="gallery__image-date"> {{ formatShortDate(photo.uploadedAt) }}</div>
            <div v-if="authStore.isAdmin" class="gallery__image-delete" @click.stop="deletePhotoHandler(photo)">Удалить</div>
          </div>
          
        </div>
      </div>
    </div>
  </div>
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
  <a-modal
    title="Просмотр фотографии"
    :opened="showPhotoModal"
    @close-emit="showPhotoModal = false"
    @click.self="showPhotoModal = false"
  >
    <div>
      <img class="image" :src="openedImage.url" />
    </div>
    <div class="image__date">Загружено: {{ formatShortDate(openedImage.date) }}</div>
  </a-modal>
</template>

<style scoped>
.top-btn {
  position: fixed;
  width: 48px;
  height: 48px;
  bottom: 24px;
  right: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
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
  align-items: center;
}

.gallery__null-photo {
  margin-top: 24px;
  text-align: center;
  font-size: 18px;
}

.gallery__card {
  cursor: pointer;
  transition: transform 0.2s;
}

.gallery__card:hover {
  transform: scale(1.00);
}

.gallery__header {
  display: flex;
  margin-top: 24px;
  justify-content: space-between;
}

.gallery__filter {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
}

.gallery__date-from,
.gallery__date-to {
  display: flex;
  align-items: center;
  gap: 20px;
}


.gallery__image-preview,
.gallery__image-placeholder {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 4px;
}

.gallery__image-footer {
  margin-top: 8px; 
  gap: 12px;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 400;
  align-items: center;
  justify-content: center;
}


.gallery__image-date {
 
}

.gallery__image-delete {

  color: rgb(145, 26, 26);

  transition: all 0.2s;
}
.gallery__image-delete:hover {
  color: rgb(219, 21, 21);

}

.image {
  max-height: 75vh;
  max-width: 90vw;
  width: auto;
  height: auto;
  object-fit: contain;
}

.form-input {
  margin-bottom: 24px;
}

.file-names {
  margin-bottom: 25px;
}

.file-string {
  display: flex;
  gap: 24px;
  text-align: center;
  justify-content: space-between;
}

.file-name {
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.file-delete {
  font-weight: 400;
  color: rgb(78, 78, 78);
  cursor: pointer;
}

.file-delete:hover {
  color: rgb(3, 3, 3);
}

.image__date {
  margin-top: 20px;
  text-align: center;
  font-weight: 400;
  color: #6d6d6d;
}
</style>

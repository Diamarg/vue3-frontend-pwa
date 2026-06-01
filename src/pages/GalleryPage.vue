<script setup>
import { computed, ref } from 'vue'
import { onMounted } from 'vue'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import AButton from '@/components/A-button.vue'
import AModal from '@/components/A-modal.vue'
import { galleryApi } from '@/api/gallery'
import { projectsApi } from '@/api/projects'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'

const props = defineProps({
  projectId: '',
})

const router = useRouter()
const route = useRoute()

const authStore = useAuthStore()
const pageStore = usePageStore()

const scrollY = ref(0)
const showModal = ref(false)
const showPhotoModal = ref(false)
const photos = ref([])
const project = ref({})
const error = ref({})
const imgUrls = ref({})
const isLoadingPhotos = ref(false)

const imgUrl = ref('')
const openedImage = ref({
  url: '',
  date: '',
})

const uploadForm = ref({
  files: [],
})

const selectionMode = ref(false)
const selectedPhotoIds = ref([])

const onScroll = () => {
  scrollY.value = window.scrollY
}

const nullPhotos = computed(() => {
  return photos.value.length === 0 ? true : false
})

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
    console.log('uploadForm.value.files: ', uploadForm.value.files)
    console.log('File: ', file)
    formData.append('files', file)
  }

  try {
    await galleryApi.uploadPhoto(project.value.id, formData)
    console.log('Загружаем: ', formData)
    loadPhotos()
  } catch (error) {
    console.log('Ошибка: ', error)
  }
}

const showTopBtn = computed(() => scrollY.value > 100)

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Failed to load project:', error)
    project.value = { codeName: `Проект #${project.value.id}`, customer: 'Заказчик' }
  } finally {
    pageStore.pageInfo.name = `Галерея - ${project.value.codeName}`
    console.log(project.value)
  }
}

const loadPhotos = async () => {
  isLoadingPhotos.value = true
  try {
    const data = await galleryApi.getPhotos(route.params.projectId)
    photos.value = data.map((photo) => ({
      ...photo,
      fileSize: photo.fileSize || 0,
    }))

    imgUrls.value = {}
    for (const photo of photos.value) {
      try {
        const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
        imgUrls.value[photo.id] = URL.createObjectURL(blob)
      } catch (error) {
        console.log('Ошибка загрузки фотографий: ', error)
      }
    }
  } catch (error) {
    console.error('Failed to load photos:', error)
    showToast('Ошибка при загрузке галереи', 'error')
  } finally {
    isLoadingPhotos.value = false
  }
}

async function loadPhoto(photo) {
  console.log(photo.uploadedAt)
  try {
    const blob = await galleryApi.getPhotoFile(photo.projectId, photo.id)
    // imgUrl.value = URL.createObjectURL(blob)
    openedImage.value.url = URL.createObjectURL(blob)
    openedImage.value.date = photo.uploadedAt
    showPhotoModal.value = true

    console.log(blob)
  } catch (error) {
    console.log(error)
  }
}

const showNextImage = () => {}

const handleFileChange = (event) => {
  const newFiles = Array.from(event.target.files)
  console.log('новые файлы: ', newFiles)
  uploadForm.value.files = [...uploadForm.value.files, ...newFiles]
  console.log('files.value ', uploadForm.value.files)
  event.target.value = ''
}

const deleteFileString = (index) => {
  console.log(index)
  uploadForm.value.files.splice(index, 1)
  console.log(uploadForm.value.files)
}

const formatShortDate = (isoString) => {
  if (!isoString) return '—'

  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '—' // защита от невалидных строк

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

onMounted(async () => {
  loadProject()
  loadPhotos()
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
})

// onBeforeUnmount(() => {
//   Object.values(imageUrls.value).forEach((url) => {
//     URL.revokeObjectURL(url)
//   })
//   imageUrls.value = {}
// })

// onUnmounted(() => {
//   window.removeEventListener('scroll')
// })
</script>

<template>
  <div class="global-container">
    <div v-if="showTopBtn" class="top-btn" @click="scrollToTop"></div>
    <div class="gallery">
      <div class="gallery__header">
        <div v-if="!nullPhotos" class="gallery__filter">
          <div class="gallery__date-from"><span>От: </span><a-input type="date" /></div>
          <div class="gallery__date-to"><span>До: </span><a-input type="date" /></div>
        </div>
        <div class="gallery__add-btn btn">
          <a-button @click="showModal = true">Загрузить фото</a-button>
        </div>
      </div>
      <div v-if="nullPhotos" class="gallery__null-photo">Ещё нет загруженных фотографий!</div>
      <div v-else class="gallery__cards">
        <div v-for="(photo, index) in photos" class="gallery__card" @click="loadPhoto(photo)">
          <img class="gallery__image-preview" :src="imgUrls[photo.id]" />
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
        placeholder="Выберите файлы"
        multiple
        @change="handleFileChange"
      ></a-input>
      <div class="file-names">
        <div v-for="(file, index) in uploadForm.files" class="file-string">
          <div class="file-name">{{ file.name }}</div>
          <!-- <div class="file-delete" @click="uploadForm.files.splice(index, 1)">X</div> -->
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
      <img class="image" :src="openedImage.url" @click="showNextImage" />
    </div>
    <div class="image__date">Загружено: {{ formatShortDate(openedImage.date) }}</div>
  </a-modal>
</template>

<style scoped>
.top-btn {
  position: fixed;
  width: 260px;
  height: 100%;
  top: 0;
  left: 0;
  cursor: pointer;
}

.top-btn:hover {
  background-image: linear-gradient(90deg, #e0eefa, #fafafa);
}

/* Базовые стили, общие для всех контейнеров галереи */
.gallery__cards,
.gallery__header,
.gallery__null-photo {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230); /* Объединили 3 свойства в одно */
  background-color: rgb(255, 255, 255);
  padding: 24px;
}

/* Уникальные стили для списка карточек */
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
/* Уникальные стили для одной карточки */
.gallery__card {
  cursor: pointer;
}

/* Уникальные стили для пустого состояния */
.gallery__header {
  display: flex;
  margin-top: 24px;
  justify-content: space-between;
}

.gallery__filter {
  display: flex;
  gap: 24px;
}

.gallery__date-from,
.gallery__date-to {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* Остальные стили без изменений */
.gallery__image-preview {
  background-color: rgb(94, 94, 94);
  width: 100%;
  height: 200px;
  object-fit: cover; /* Добавлено для корректного отображения фото */
}

.gallery__date {
  margin-top: 20px;
  text-align: center;
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

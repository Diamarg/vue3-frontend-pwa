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
  projectId: { type: String, required: true },
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

const uploadForm = ref({
  files: [],
})

const files = ref([
  {
    name: '',
  },
])

const selectionMode = ref(false)
const selectedPhotoIds = ref([])

const onScroll = () => {
  scrollY.value = window.scrollY
}

const nullPhotos = computed(() => {
  if (photos.value.length === 0) return true
  return false
})

const clickPhotoCard = () => {
  showPhotoModal.value = true
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}

const submitUpload = () => {
  console.log(files.value)
}

const showTopBtn = computed(() => scrollY.value > 100)

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Failed to load project:', error)
    project.value = { codeName: `Проект #${projectId.value}`, customer: 'Заказчик' }
  } finally {
    pageStore.pageInfo.name = `Галерея - ${project.value.codeName}`
    console.log(project)
  }
}

const loadPhotos = async () => {
  try {
    const data = await galleryApi.getPhotos(route.params.projectId)
    photos.value = data.map((photo) => ({
      ...photo,
      fileSize: photo.fileSize || 0,
    }))
  } catch (error) {
    console.error('Failed to load photos:', error)
    showToast('Ошибка при загрузке галереи', 'error')
  } finally {
    console.log(photos.value)
  }
}

const handleFileChange = (event) => {
  const newFiles = Array.from(event.target.files)
  console.log('новые файлы: ', newFiles)
  uploadForm.value.files = [...uploadForm.value.files, ...newFiles]
  console.log('files.value ', uploadForm.value.files)
  // event.target.value = ''
}

const deleteFileString = (index) => {
  console.log(index)
  uploadForm.value.files.splice(index, 1)
  console.log(uploadForm.value.files)
}

onMounted(async () => {
  loadProject()
  loadPhotos()
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
})

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
        <div v-for="photo in photos" class="gallery__card" @click="clickPhotoCard(photo.id)">
          <img class="gallery__image-preview" />
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
          <div class="file-delete" @click="deleteFileString(index)">X</div>
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
    <div class="image"></div>
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
  min-width: 900px;
  min-height: 600px;
}
.form-input {
  margin-bottom: 24px;
}

.file-names {
  margin-bottom: 25px;
}

.file-string {
  display: flex;
  justify-content: space-between;
}

.file-name {
  margin-bottom: 8px;
}

.file-delete {
  font-weight: 400;
  color: rgb(78, 78, 78);
  cursor: pointer;
}

.file-delete:hover {
  color: rgb(3, 3, 3);
}
</style>

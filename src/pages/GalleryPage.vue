<script setup>
import { computed, ref } from 'vue'
import { onMounted } from 'vue'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import AButton from '@/components/A-button.vue'
import AModal from '@/components/A-modal.vue'

const authStore = useAuthStore()
const pageStore = usePageStore()

const scrollY = ref(0)
const showModal = ref(false)
const showPhotoModal = ref(false)
const photos = ref([1])

const onScroll = () => {
  scrollY.value = window.scrollY
}

const nullPhotos = computed(() => {
  if (photos.value.length === 0) return true
  return false
})

const clickPhotoCard = () => {
  console.log('клик')
  showPhotoModal.value = true
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
}

const showTopBtn = computed(() => scrollY.value > 100)

onMounted(async () => {
  pageStore.pageInfo.name = `Галерея - ${pageStore.pageInfo.projectName}`
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  await authStore.fetchMe()
})
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
          <img class="gallery__image" />
          <div class="gallery__date">26-01-2026</div>
        </div>
      </div>
    </div>
  </div>
  <a-modal title="Загрузка фотографий" :opened="showModal" @close-emit="showModal = false">
    <form enctype="multipart/form-data">
      <label>Выберите фото с устройства</label>
      <a-input type="file" multiple></a-input>
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
  font-size: 16px;
  font-weight: 300;
  width: 200px;
  height: 100%;
  top: 0;
  left: 0;
  cursor: pointer;
  color: rgb(72, 72, 194);
  text-decoration: underline;
}

.top-btn:hover {
  background-color: rgb(222, 255, 242, 0.5);
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
.gallery__image {
  background-color: rgb(122, 129, 128);
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
</style>

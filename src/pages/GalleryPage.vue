<script setup>
import { computed, ref } from 'vue'
import { onMounted } from 'vue'
import { usePageStore } from '@/stores/pages'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import AButton from '@/components/A-button.vue'

const authStore = useAuthStore()
const pageStore = usePageStore()
const photos = ref([1])

const nullProjects = computed(() => {
  if (photos.value.length === 0) return true
  return false
})

const mouseOnCard = () => {
  console.log('Мышь на карточке')
}

onMounted(async () => {
  pageStore.nowpage = 'Галерея'
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <div class="gallery">
      <div class="gallery__header">
        <div class="gallery__filter">
          <div class="gallery__date-from"><span>От: </span><a-input type="date" /></div>
          <div class="gallery__date-to"><span>До: </span><a-input type="date" /></div>
        </div>
        <div class="gallery__add-btn btn"><a-button>Загрузить фото</a-button></div>
      </div>
      <div v-if="nullProjects" class="gallery__null-photo">Ещё нет загруженных фотографий!</div>
      <div v-else class="gallery__cards">
        <div v-for="photo in photos" class="gallery__card" @mouseenter="mouseOnCard">
          <img class="gallery__image" />
          <div class="gallery__date">Загружено: 26-01-2026</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Базовые стили, общие для всех контейнеров галереи */
.gallery__cards,
.gallery__card,
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
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.2);
  grid-template-columns: 5fr minmax(150px, 1fr);
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
  background-color: rgb(83, 139, 130);
  width: 100%;
  height: 200px;
  object-fit: cover; /* Добавлено для корректного отображения фото */
}

.gallery__date {
  margin-top: 20px;
  text-align: center;
}
</style>

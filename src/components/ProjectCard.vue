<script setup>
const props = defineProps({
  codename: { type: String, default: 'АС__' },
  customer: { type: String, default: 'заказчик' },
  description: { type: String, default: 'описание' },
  creationDate: { type: String, default: '09.06.89' },
  isAdmin: { type: Boolean, default: false },
})

const formatShortDate = (timestamp) => {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  return isNaN(date.getTime()) ? '—' : shortDateFormatter.format(date)
}

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
</script>

<template>
  <div class="project-card">
    <div class="project-card__header">
      <div class="project-card__codename" :title="'Описание проекта: ' + props.description">
        {{ props.codename }}
      </div>
      <div v-if="isAdmin" class="project-card__actions">
        <a class="project-card__link project-card__link--edit">Изменить</a
        ><a class="project-card__link project-card__link--delete" @click="$emit('onDelete')"
          >Удалить</a
        >
      </div>
    </div>
    <hr />
    <div class="project-card__content">
      <div class="project-card__customer">
        <span class="project-card__customer-label">Заказчик:</span
        ><span class="project-card__customer-text">{{ props.customer }}</span>
      </div>
    </div>
    <div class="project-card__creation">
      <span class="project-card__creation-label">Создано:</span
      ><span class="project-card__creation-date">{{ formatShortDate(props.creationDate) }}</span>
    </div>
    <hr />
    <div class="project-card__links">
      <a class="project-card__link project-card__link--outline" @click="$emit('toGallery')"
        >Галерея</a
      >
      <!-- <a class="project-card__link project-card__link--outline" @click="$emit('toFiles')">Файлы</a> -->
      <!-- <a class="project-card__link project-card__link--outline" @click="$emit('toAssemblies')">Сборки</a> -->
    </div>
  </div>
</template>

<script setup></script>

<style scoped>
.project-card {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.2);
  display: grid;
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  transition: all 0.5s;
}

.project-card:hover {
  box-shadow: 4px 4px 20px -10px rgba(44, 70, 90, 0.4);
  border-color: rgb(210, 210, 210);
}

.project-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.project-card__codename {
  color: rgb(82, 82, 82);
  cursor: help;
  font-size: 20px;
  font-weight: 600;
}

.project-card__actions {
  font-size: 13px;
  display: flex;
  gap: 12px;
}
.project-card__content {
  color: rgb(82, 82, 82);
}
.project-card__customer {
  display: flex;
  justify-content: space-between;
  margin-block: 24px;
}

.project-card__description {
  margin-bottom: 24px;
}

.project-card__creation {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24px;
}

.project-card__creation-label,
.project-card__customer-label,
.project-card__description-label {
  font-weight: 400;
  color: rgb(150, 150, 150);
}

.project-card__customer-text,
.project-card__creation-date {
  font-weight: 300;
  color: rgb(109, 109, 109);
}
.project-card__links {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.project-card__link {
  color: rgb(80, 80, 80);
  font-size: 14px;
  text-decoration: none;
}

.project-card__link--outline {
  padding: 8px 24px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  transition: all 0.3s;
}

.project-card__link--outline:hover {
  border-color: rgb(150, 150, 150);
}

.project-card__link--edit {
  color: rgb(196, 167, 0);
}

.project-card__link--edit:hover {
  color: rgb(172, 146, 0);
}

.project-card__link--delete {
  color: rgb(177, 29, 29);
}

.project-card__link--delete:hover {
  color: rgb(85, 9, 9);
}
</style>

<script setup>
import { formatShortDate } from '@/utils/dateFormatter'

const props = defineProps({
  codename: { type: String, default: 'АС__' },
  customer: { type: String, default: '' },
  description: { type: String, default: '' },
  creationDate: { type: String, default: '' },
  photosCount: { type: Number, default: 0 },
  filesCount: { type: Number, default: 0 },
  assembliesCount: { type: Number, default: 0 },
  cableLinesCount: { type: Number, default: 0 },
})

defineEmits(['toGallery', 'toFiles', 'toAssemblies', 'toCableJournal'])
</script>

<template>
  <article class="project-card">
    <h3 class="project-card__codename">{{ props.codename }}</h3>

    <dl class="project-card__facts">
      <div class="project-card__fact">
        <dt class="project-card__fact-label">Заказчик:</dt>
        <dd class="project-card__fact-value">{{ props.customer || '—' }}</dd>
      </div>
      <div class="project-card__fact">
        <dt class="project-card__fact-label">Описание:</dt>
        <dd
          class="project-card__fact-value"
          :class="{ 'project-card__fact-value--empty': !props.description }"
        >
          {{ props.description || 'не заполнено' }}
        </dd>
      </div>
      <div class="project-card__fact project-card__fact--date">
        <dt class="project-card__fact-label">Создано:</dt>
        <dd class="project-card__fact-value">{{ formatShortDate(props.creationDate) }}</dd>
      </div>
    </dl>

    <nav class="project-card__links">
      <button type="button" class="project-card__link" @click="$emit('toGallery')">
        <span class="project-card__link-label">Изображения</span>
        <span
          class="project-card__link-count"
          :class="{ 'project-card__link-count--none': !props.photosCount }"
        >
          {{ props.photosCount ? props.photosCount + ' шт.' : 'пусто' }}
        </span>
      </button>
      <button type="button" class="project-card__link" @click="$emit('toFiles')">
        <span class="project-card__link-label">Файлы</span>
        <span
          class="project-card__link-count"
          :class="{ 'project-card__link-count--none': !props.filesCount }"
        >
          {{ props.filesCount ? props.filesCount + ' шт.' : 'пусто' }}
        </span>
      </button>
      <button type="button" class="project-card__link" @click="$emit('toAssemblies')">
        <span class="project-card__link-label">Сборки ШУ</span>
        <span
          class="project-card__link-count"
          :class="{ 'project-card__link-count--none': !props.assembliesCount }"
        >
          {{ props.assembliesCount ? props.assembliesCount + ' шт.' : 'пусто' }}
        </span>
      </button>
      <button type="button" class="project-card__link" @click="$emit('toCableJournal')">
        <span class="project-card__link-label">Кабельный журнал</span>
        <span
          class="project-card__link-count"
          :class="{ 'project-card__link-count--none': !props.cableLinesCount }"
        >
          {{ props.cableLinesCount ? props.cableLinesCount + ' стр.' : 'пусто' }}
        </span>
      </button>
    </nav>
  </article>
</template>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background-color: rgb(255, 255, 255);
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.2);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.project-card:hover {
  box-shadow: 4px 4px 20px -10px rgba(44, 70, 90, 0.4);
  border-color: rgb(210, 210, 210);
}

.project-card__codename {
  margin: 0;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(235, 235, 235);
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  color: rgb(70, 70, 70);
  overflow-wrap: anywhere;
}

/* Подпись слева, значение у правого края: в ряду карточек правые края
   заказчика, описания и даты сходятся в одну колонку */
.project-card__facts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Блок забирает всё свободное место карточки, чтобы дату можно было
     прижать к её нижней границе, а не к концу текста */
  flex: 1;
  margin: 0;
  font-size: 13px;
}

.project-card__fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.project-card__fact-label {
  flex: none;
  color: rgb(150, 150, 150);
}

.project-card__fact-value {
  flex: 1;
  min-width: 0;
  margin: 0;
  text-align: right;
  line-height: 1.45;
  color: rgb(85, 85, 85);
  overflow-wrap: anywhere;
}

.project-card__fact-value--empty {
  color: rgb(175, 175, 175);
  font-style: italic;
}

/* Дате — нижняя грань блока: в ряду карточек с разной длиной описания
   «Создано» и разделитель над кнопками остаются на одной линии */
.project-card__fact--date {
  margin-top: auto;
}

.project-card__links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgb(235, 235, 235);
}

.project-card__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background: rgb(255, 255, 255);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.project-card__link:hover {
  border-color: rgb(150, 150, 150);
}

.project-card__link:focus-visible {
  outline: 2px solid rgb(99, 102, 241);
  outline-offset: 2px;
}

.project-card__link-label {
  font-size: 13px;
  color: rgb(75, 75, 75);
}

.project-card__link-count {
  font-size: 12px;
  color: rgb(150, 150, 150);
  white-space: nowrap;
}

.project-card__link-count--none {
  color: rgb(195, 195, 195);
}

@media (max-width: 600px) {
  .project-card {
    gap: 10px;
    padding: 12px;
  }

  .project-card__codename {
    font-size: 16px;
  }

  /* Две колонки оставляем и на телефоне: четыре строки переходами — это
     половина экрана на один проект, а подписи переносятся, а не режутся */
  .project-card__link {
    padding: 8px;
  }

  .project-card__link-label {
    font-size: 12.5px;
  }
}
</style>

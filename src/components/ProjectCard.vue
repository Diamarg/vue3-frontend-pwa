<script setup>
import { ref } from 'vue'
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

// Строка живёт в списке одна, детали — по касанию: так четыре проекта влезают
// в экран телефона, а не один
const expanded = ref(false)
</script>

<template>
  <article class="project-row" :class="{ 'project-row--open': expanded }">
    <div class="project-row__top">
      <h3 class="project-row__codename">{{ props.codename }}</h3>
      <button
        type="button"
        class="project-row__toggle"
        :aria-expanded="expanded"
        :aria-label="expanded ? 'Свернуть сведения о проекте' : 'Показать сведения о проекте'"
        @click="expanded = !expanded"
      >
        {{ expanded ? '⌃' : '⌄' }}
      </button>
    </div>

    <!-- Числа и есть переходы: подпись короткая, а «пусто» replaced серым нулём -->
    <div class="project-row__stats">
      <button
        type="button"
        class="stat"
        :class="{ 'stat--empty': !photosCount }"
        @click="$emit('toGallery')"
      >
        <span class="stat__count">{{ photosCount }}</span>
        <span class="stat__label">фото</span>
      </button>
      <button
        type="button"
        class="stat"
        :class="{ 'stat--empty': !filesCount }"
        @click="$emit('toFiles')"
      >
        <span class="stat__count">{{ filesCount }}</span>
        <span class="stat__label">файлы</span>
      </button>
      <button
        type="button"
        class="stat"
        :class="{ 'stat--empty': !assembliesCount }"
        @click="$emit('toAssemblies')"
      >
        <span class="stat__count">{{ assembliesCount }}</span>
        <span class="stat__label">сборки</span>
      </button>
      <button
        type="button"
        class="stat"
        :class="{ 'stat--empty': !cableLinesCount }"
        @click="$emit('toCableJournal')"
      >
        <span class="stat__count">{{ cableLinesCount }}</span>
        <span class="stat__label">линии</span>
      </button>
    </div>

    <div v-if="expanded" class="project-row__details">
      <div class="project-row__line">
        <span class="project-row__label">Заказчик</span>
        <span class="project-row__value">{{ customer || '—' }}</span>
      </div>
      <div class="project-row__line">
        <span class="project-row__label">Создан</span>
        <span class="project-row__value">{{ formatShortDate(creationDate) }}</span>
      </div>
      <p v-if="description" class="project-row__description">{{ description }}</p>
    </div>
  </article>
</template>

<style scoped>
.project-row {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 2px 2px 14px -8px rgba(34, 60, 80, 0.25);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.project-row:hover {
  border-color: rgb(197, 197, 197);
}

.project-row--open {
  border-color: rgb(160, 170, 190);
  box-shadow: 2px 2px 18px -8px rgba(34, 60, 80, 0.4);
}

.project-row__top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.project-row__codename {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: rgb(55, 65, 81);
  overflow-wrap: anywhere;
}

.project-row__toggle {
  flex: none;
  width: 32px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: none;
  color: rgb(140, 140, 140);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.project-row__toggle:hover {
  background: rgb(241, 245, 249);
  color: rgb(70, 70, 70);
}

.project-row__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.stat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 4px 6px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 8px;
  background: rgb(248, 250, 252);
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.stat:hover {
  border-color: rgb(150, 150, 150);
  background: #fff;
}

.stat__count {
  font-size: 14px;
  font-weight: 600;
  color: rgb(59, 73, 102);
}

.stat__label {
  font-size: 11px;
  color: rgb(120, 120, 120);
  white-space: nowrap;
}

.stat--empty {
  background: #fff;
}

.stat--empty .stat__count,
.stat--empty .stat__label {
  color: rgb(185, 185, 185);
}

.project-row__details {
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgb(235, 235, 235);
}

.project-row__line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 13px;
}

.project-row__label {
  flex: none;
  color: rgb(150, 150, 150);
}

.project-row__value {
  text-align: right;
  color: rgb(90, 90, 90);
  overflow-wrap: anywhere;
}

.project-row__description {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgb(100, 100, 100);
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .project-row {
    padding: 10px;
  }

  /* На телефоне палец должен попадать по числу без промаха, поэтому
     метки уходят под счётчик, а сам счётчик остаётся крупной кнопкой */
  .stat {
    flex-direction: column;
    gap: 0;
    min-height: 44px;
  }

  .project-row__line {
    font-size: 14px;
  }
}
</style>

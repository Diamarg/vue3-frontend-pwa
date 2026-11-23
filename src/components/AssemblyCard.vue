<script setup>
const props = defineProps({
  projectName: { type: String, default: '' },
  assemblyName: { type: String, default: 'Сборка' },
  description: { type: String, default: '' },
  devicesCount: { type: Number, default: 0 },
  totalQuantity: { type: Number, default: 0 },
})

defineEmits(['toDevices', 'toPanelEditor'])
</script>

<template>
  <article class="project-card">
    <h3 class="project-card__codename">{{ props.assemblyName }}</h3>

    <dl class="project-card__facts">
      <div class="project-card__fact">
        <dt class="project-card__fact-label">Проект:</dt>
        <dd class="project-card__fact-value">{{ props.projectName || '—' }}</dd>
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
        <dt class="project-card__fact-label">Устройства:</dt>
        <dd class="project-card__fact-value">
          {{ props.devicesCount }} шт.<span v-if="props.totalQuantity !== props.devicesCount">
            · всего {{ props.totalQuantity }}</span
          >
        </dd>
      </div>
    </dl>

    <nav class="project-card__links">
      <button type="button" class="project-card__link" @click="$emit('toDevices')">
        <span class="project-card__link-label">Устройства</span>
        <span
          class="project-card__link-count"
          :class="{ 'project-card__link-count--none': !props.devicesCount }"
        >
          {{ props.devicesCount ? props.devicesCount + ' шт.' : 'пусто' }}
        </span>
      </button>
      <button type="button" class="project-card__link" @click="$emit('toPanelEditor')">
        <span class="project-card__link-label">Монтажная панель</span>
        <span class="project-card__link-count" aria-hidden="true">→</span>
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

.project-card__facts {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
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

  .project-card__link {
    padding: 8px;
  }

  .project-card__link-label {
    font-size: 12.5px;
  }
}
</style>

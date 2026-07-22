<script setup>
const props = defineProps({
  projectName: { type: String, default: 'АС__' },
  assemblyName: { type: String, default: 'заказчик' },
  creationDate: { type: String, default: '09.06.89' },
  description: { type: String, default: '...Описание...' },
  isAdmin: { type: Boolean, default: true },
})
</script>

<template>
  <div class="project-card">
    <div class="project-card__header">
      <div class="project-card__assemblyname">
        {{ props.assemblyName }}
      </div>
      <div v-if="isAdmin" class="project-card__actions">
        <!-- <a class="project-card__link project-card__link--edit">Изменить</a> -->
        <a class="project-card__link project-card__link--delete" @click="$emit('onDelete')"
          >Удалить</a
        >
      </div>
    </div>
    <hr />
    <div class="project-card__line">
      <span class="project-card__line-text">{{ props.description }}</span>
    </div>
    <hr />
    <div class="project-card__links">
      <a class="project-card__link project-card__link--outline" @click="$emit('toDevices')"
        >Устройства</a
      >
      <a class="project-card__link project-card__link--outline" @click="$emit('toPanelEditor')"
        >Монтажная панель</a
      >
      <a class="project-card__link project-card__link--outline" @click="$emit('toCableJournal')"
        >Кабельный журнал</a
      >
    </div>
  </div>
</template>

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

.project-card__assemblyname {
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
.project-card__line {
  display: flex;
  justify-content: space-between;
  margin-block: 12px;
}

.project-card__description {
  margin-bottom: 24px;
}

.project-card__line-label {
  font-weight: 400;
  color: rgb(150, 150, 150);
}

.project-card__line-text {
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

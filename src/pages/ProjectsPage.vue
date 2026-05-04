<script setup>
import Abutton from '@/components/A-button.vue'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { onMounted } from 'vue'
import Ainput from '@/components/A-input.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import AddIcon from '@/components/icons/AddIcon.vue'
import AModal from '@/components/A-modal.vue'
import { projectsApi } from '@/api/projects'

const authStore = useAuthStore()
const pageStore = usePageStore()
const loadError = ref('')
const loading = ref(false)
const projects = ref([])
const searchBar = ref('')
const showModal = ref(false)

const filteredProjects = computed(() => {
  const query = searchBar.value.trim().toLowerCase()

  if (!query) return projects.value

  return projects.value.filter(
    (p) =>
      (p.codeName || '').toLowerCase().includes(query) ||
      (p.customer || '').toLowerCase().includes(query),
  )
})

onMounted(async () => {
  fethProjects()
  pageStore.nowpage = 'Проекты'
  await authStore.fetchMe()
})

const fethProjects = async () => {
  loading.value = true
  try {
    projects.value = await projectsApi.getProjects()
  } catch (error) {
    loadError.value = true
    console.log(error)
    console.error('Failed to load projects:', error)
    showToast('Ошибка при загрузке проектов', 'error')
  } finally {
    loading.value = false
  }
}

const sendForm = async () => {
  try {
  } catch {
  } finally {
    console.log('Форма отправлена')
    closeModal()
  }
}

const closeModal = () => {
  showModal.value = false
}
</script>

<template>
  <div v-if="authStore.user" class="global-container">
    <div class="projects">
      <div class="projects-headbar">
        <div class="projects-headbar__searchbar">
          <div class="project-headbar__searchbar-label">Поиск:</div>
          <ainput
            class="projects-headbar__searchinput"
            v-model="searchBar"
            placeholder="Найти по имени проекта или заказчику..."
          ></ainput>
        </div>
        <!-- <Abutton @click="showModal = true"
          ><template #icon><add-icon color="white" /></template>Новый проект
        </Abutton> -->
      </div>
      <div v-if="!loading" class="projects-cards">
        <ProjectCard
          v-for="project in filteredProjects"
          :codename="project.codeName"
          :customer="project.customer"
          :description="project.description"
          :creation-date="project.dateOfCreation"
          :is-admin="authStore.isAdmin"
        />
        <div v-if="filteredProjects == 0" class="project-cards__notfound">Проекты не найдены!</div>
      </div>
      <div v-else class="project-cards__loading">Загрузка...</div>
    </div>
  </div>
  <a-modal v-if="showModal" @close-emit="closeModal">
    <form class="modal__form">
      <div class="modal_form-group">
        <label>Кодовое название*</label>
        <ainput placeholder="АС-101" />
        <p class="valid-error">Заполните название</p>
      </div>
      <div class="modal_form-group">
        <label>Заказчик*</label>
        <ainput placeholder='ООО "Пивозавр"' />
        <p class="valid-error">Заполните информацию о заказчике</p>
      </div>
      <div class="modal_form-group">
        <label>Описание проекта*</label>
        <ainput placeholder="Установка обратного осмоса" />
        <p class="valid-error">Заполните описание проекта</p>
      </div>
      <div class="modal_form-group">
        <label>Дата создания*</label>
        <ainput type="date" />
        <p class="valid-error">Выберите дату создания проекта</p>
      </div>

      <div class="modal__actions">
        <abutton @click="sendForm" type="button">Изменить</abutton>
        <a @click="closeModal" class="form__back-link">Закрыть</a>
      </div>
    </form>
  </a-modal>
</template>

<style scoped>
.global-container {
  height: 100vh;
  max-width: 1400px;
  margin-inline: auto;
  padding-inline: 20px;
  width: 100%;
}

.projects {
  display: grid;
  gap: 24px;
  grid-template-rows: auto 1fr;
}

.projects-headbar {
  display: grid;
  gap: 24px;
  grid-template-columns: 5fr minmax(150px, 1fr);
  border-radius: 8px;
  border-color: #d9d9d9;
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  margin-top: 24px;
  align-items: center;
}

@media (max-width: 600px) {
  .projects-headbar {
    grid-template-rows: 1fr 1fr;
    grid-template-columns: auto;
  }
}

.projects-headbar__searchbar {
  display: grid;
  grid-template-columns: 80px 1fr;
  text-align: center;
}

.project-headbar__searchbar-label {
  align-content: center;
}

.projects-cards {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(280px, auto));
  border-radius: 8px;
  border-color: #d9d9d9;
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
}

@media (min-width: 900px) {
  .projects-cards {
    grid-template-columns: repeat(auto-fit, minmax(350px, auto));
  }
}

.project-cards__notfound,
.project-cards__loading {
  font-weight: 300;
  text-align: center;
  color: gray;
}

/* Модалка */

.modal__actions {
  display: flex;
  justify-content: end;
}

.form__back-link {
  font-size: 16px;
  align-self: center;
  padding: 0px 24px;
}

.modal__form {
  display: grid;
  gap: 24px;
}
</style>

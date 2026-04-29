<script setup>
import Abutton from '@/components/A-button.vue'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { onMounted } from 'vue'
import Ainput from '@/components/A-input.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import AddIcon from '@/components/icons/AddIcon.vue'
import { projectsApi } from '@/api/projects'

const authStore = useAuthStore()
const pageStore = usePageStore()
const loadError = ref('')
const loading = ref(false)
const projects = ref([])
const searchBar = ref('')

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
        <Abutton
          ><template #icon><add-icon color="white" /></template>Новый проект
        </Abutton>
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

.projects-headbar__searchinput {
  /* margin-inline: 16px; */
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
</style>

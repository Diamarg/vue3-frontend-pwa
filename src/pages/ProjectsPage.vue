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
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const pageStore = usePageStore()
const router = useRouter()

const toast = useToast()

const loadError = ref('')
const loading = ref(false)
const projects = ref([])
const searchBar = ref('')
const showModal = ref(false)

const form = ref({
  codeName: '',
  codeNameTouched: false,
  customer: '',
  customerTouched: false,
  description: '',
  descriptionTouched: false,
  creationDate: '',
  creationDateTouched: false,
})

const codeNameValidation = computed(() => {
  const regexp = new RegExp(/^[а-яА-ЯёЁ0-9_-\s]{4,30}$/)

  if (form.value.codeNameTouched && !regexp.test(form.value.codeName))
    return 'Заполните кодовое имя проекта'
  return ''
})

const customerValidation = computed(() => {
  const regexp = new RegExp(/^[а-яА-ЯёЁ0-9_-\s\"]{3,50}$/)

  if (form.value.customerTouched && !regexp.test(form.value.customer)) return 'Заполните заказчика'
  return ''
})

const descriptionValidation = computed(() => {
  const regexp = new RegExp(/^[а-яА-ЯёЁ0-9_-\s\"\(\)]{3,200}$/)

  if (form.value.descriptionTouched && !regexp.test(form.value.description))
    return `Заполните краткое описание`
  return ''
})

const creationDateValidation = computed(() => {
  const regexp = new RegExp(/^[а-яА-ЯёЁ0-9_-]{3,30}$/)

  if (form.value.creationDateTouched && !regexp.test(form.value.creationDate))
    return 'Выберите дату создания проекта'
  return ''
})

const formReady = computed(() => {
  return (
    form.value.codeName !== '' &&
    form.value.customer !== '' &&
    form.value.description !== '' &&
    form.value.creationDate !== '' &&
    !codeNameValidation.value &&
    !customerValidation.value &&
    !descriptionValidation.value &&
    !creationDateValidation.value
  )
})

const filteredProjects = computed(() => {
  const query = searchBar.value.trim().toLowerCase()

  if (!query) return projects.value

  return projects.value.filter(
    (p) =>
      (p.codeName || '').toLowerCase().includes(query) ||
      (p.customer || '').toLowerCase().includes(query),
  )
})

const fethProjects = async () => {
  loading.value = true
  try {
    projects.value = await projectsApi.getProjects()
  } catch (error) {
    loadError.value = true
    console.log(error)
    console.error('Failed to load projects:', error)
    toast.error('Ошибка при загрузке проектов', 'error')
  } finally {
    loading.value = false
  }
}

const saveProject = async () => {
  if (!authStore.isAdmin) {
    toast.error('У вас нет прав для редактирования проектов')
    return
  }

  const projectData = {
    codeName: form.value.codeName,
    customer: form.value.customer,
    description: form.value.description,
    dateOfCreation: form.value.creationDate,
  }

  try {
    await projectsApi.createProject(projectData)
    toast.success(`Проект ${form.value.codeName} был добавлен`)
  } catch (error) {
    console.error('Failed to save project:', error)
    toast.error(error)
  } finally {
    fethProjects()
    form.value = {}
    showModal.value = false
  }
}

const deleteProject = async (project) => {
  if (confirm(`Вы действительно хотите удалить проект ${project.codeName} (ID - ${project.id})?`)) {
    try {
      await projectsApi.deleteProject(project.id)
      toast.success(`Проект ${project.codeName} был удалён!`)
    } catch (error) {
      toast.error('Ошибка удаления! ' + error)
    } finally {
      fethProjects()
    }
  }
}

const goToAssemblies = (projectId) => {
  router.push(`/projects/${projectId}/assemblies`)
}

const goToGallery = (project) => {
  router.push(`${project.id}/gallery`)
  pageStore.pageInfo.projectName = project.codeName
}

const goToFiles = (projectId) => {
  router.push(`/projects/${projectId}/files`)
}

const goToCableLines = (projectId) => {
  router.push(`/projects/${projectId}/cableLines`)
}

onMounted(async () => {
  fethProjects()
  pageStore.pageInfo.name = 'Проекты'
  await authStore.fetchMe()
})
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
        <Abutton class="sticky-button" @click="showModal = true"
          ><template #icon><add-icon color="white" /></template>Новый проект
        </Abutton>
      </div>
      <div v-if="!loading" class="projects-cards">
        <ProjectCard
          v-for="project in filteredProjects"
          :key="project.id"
          :codename="project.codeName"
          :customer="project.customer"
          :description="project.description"
          :creation-date="project.dateOfCreation"
          :is-admin="authStore.isAdmin"
          @on-delete="deleteProject(project)"
          @to-gallery="goToGallery(project)"
        />
        <div v-if="filteredProjects == 0" class="project-cards__notfound">
          По запросу '{{ searchBar }}' не найдено проектов.
        </div>
      </div>
      <div v-else class="project-cards__loading">Загрузка...</div>
    </div>
  </div>

  <a-modal @close-emit="showModal = false" :title="'Новый проект'" :opened="showModal">
    <form class="modal__form">
      <div class="modal_form-group">
        <label for="codename">Кодовое название*</label>
        <ainput
          id="codename"
          placeholder="АС-101"
          v-model="form.codeName"
          @on-touch="form.codeNameTouched = true"
        />
        <p class="valid-error">{{ codeNameValidation }}</p>
      </div>
      <div class="modal_form-group">
        <label for="customer">Заказчик*</label>
        <ainput
          id="customer"
          placeholder="Название объекта"
          v-model="form.customer"
          @on-touch="form.customerTouched = true"
        />
        <p class="valid-error">{{ customerValidation }}</p>
      </div>
      <div class="modal_form-group">
        <label for="description">Описание проекта*</label>
        <ainput
          id="description"
          placeholder="Состав или вид оборудования, особенности и т.д."
          v-model="form.description"
          @on-touch="form.descriptionTouched = true"
        />
        <p class="valid-error">{{ descriptionValidation }}</p>
      </div>
      <div class="modal_form-group">
        <label for="date">Дата создания*</label>
        <ainput
          id="date"
          type="date"
          v-model="form.creationDate"
          @on-touch="form.creationDateTouched = true"
        />
        <p class="valid-error">{{ creationDateValidation }}</p>
      </div>

      <div class="modal__actions">
        <abutton @click="saveProject" type="button" :disabled="!formReady">Создать</abutton>
        <a @click="showModal = false" class="form__back-link">Закрыть</a>
      </div>
    </form>
  </a-modal>
</template>

<style scoped>
.projects {
  display: grid;
  gap: 24px;
  grid-template-rows: auto 1fr;
}

.projects-headbar {
  display: grid;
  gap: 24px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  grid-template-columns: 5fr minmax(150px, 1fr);
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
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

.sticky-button {
  position: sticky;
}

.projects-cards {
  display: grid;
  gap: 24px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);

  grid-template-columns: repeat(auto-fit, minmax(280px, auto));
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  margin-bottom: 24px;
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

<script setup>
import AButton from '@/components/A-button.vue'
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AInput from '@/components/A-input.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import AModal from '@/components/A-modal.vue'
import { projectsApi } from '@/api/projects'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const toast = useToast()

const filteredProjectsIsReverse = ref(true)
const loadError = ref('')
const loading = ref(true)
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

  const filtered = projects.value.filter(
    (p) =>
      !query ||
      (p.codeName || '').toLowerCase().includes(query) ||
      (p.customer || '').toLowerCase().includes(query),
  )

  filtered.sort((a, b) => a.dateOfCreation.localeCompare(b.dateOfCreation))

  return filteredProjectsIsReverse.value ? filtered.reverse() : filtered
})

const reverseFilteredProjects = () => {
  filteredProjectsIsReverse.value = !filteredProjectsIsReverse.value
}

const fethProjects = async () => {
  loading.value = true
  loadError.value = false
  try {
    projects.value = (await projectsApi.getProjects()) || []
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

const goToAssemblies = (project) => {
  router.push(`${project.id}/assemblies`)
}

const goToGallery = (project) => {
  router.push(`${project.id}/gallery`)
}

const goToFiles = (project) => {
  router.push(`${project.id}/files`)
}

const toCableJournal = (project) => {
  router.push(`${project.id}/cableJournal`)
}

onMounted(async () => {
  fethProjects()
  await authStore.fetchMe()
})
</script>

<template>
  <div v-if="authStore.user" class="global-container">
    <main class="projects-page">
      <header class="projects__header">
        <div class="projects__heading">
          <div class="projects__breadcrumb">Главная</div>
          <div class="projects__title-row">
            <span class="projects__title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path
                  d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
                />
                <path d="M3 10h18" />
              </svg>
            </span>
            <div>
              <div class="projects__title-line">
                <h1 class="projects__title">Проекты</h1>
                <span v-if="!loading" class="projects__count-badge">{{ projects.length }}</span>
              </div>
              <p class="projects__subtitle">Объекты, заказчики и разделы текущих работ</p>
            </div>
          </div>
        </div>

        <div class="projects__header-actions">
          <a-button v-if="authStore.isAdmin" class="projects__create" @click="showModal = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Создать проект</span>
          </a-button>
        </div>
      </header>

      <section class="projects__toolbar" aria-label="Поиск проектов">
        <label class="projects__search">
          <span>Поиск</span>
          <div class="projects__search-control">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <AInput v-model="searchBar" placeholder="По названию проекта или заказчику..." />
          </div>
        </label>

        <AButton
          type="button"
          class="projects__sort"
          :title="
            filteredProjectsIsReverse ? 'Показать по возрастанию даты' : 'Показать по убыванию даты'
          "
          :aria-label="
            filteredProjectsIsReverse ? 'Показать по возрастанию даты' : 'Показать по убыванию даты'
          "
          :aria-pressed="filteredProjectsIsReverse"
          @click="reverseFilteredProjects"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M8 4v16m-4-4 4 4 4-4" />
            <path d="M16 20V4m-4 4 4-4 4 4" />
          </svg>
          <span class="projects__sort-label">
            {{ filteredProjectsIsReverse ? 'Сначала новые' : 'Сначала старые' }}
          </span>
        </AButton>

        <div class="projects__toolbar-actions">
          <span class="projects__result-count">
            {{
              searchBar.trim() ? `Найдено: ${filteredProjects.length}` : `Всего: ${projects.length}`
            }}
          </span>
          <button v-if="searchBar.trim()" class="projects__reset" @click="searchBar = ''">
            Сбросить
          </button>
        </div>
      </section>

      <div v-if="loading" class="projects-cards projects-skeleton" aria-label="Загрузка проектов">
        <div v-for="item in 6" :key="item" class="project-skeleton">
          <div class="project-skeleton__title skeleton-shimmer"></div>
          <div class="project-skeleton__facts">
            <div class="skeleton-shimmer"></div>
            <div class="skeleton-shimmer"></div>
            <div class="skeleton-shimmer"></div>
          </div>
          <div class="project-skeleton__links">
            <div v-for="link in 4" :key="link" class="skeleton-shimmer"></div>
          </div>
        </div>
      </div>

      <div v-else-if="loadError" class="projects__state">
        <div class="projects__state-icon projects__state-icon--error" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <h2>Не удалось загрузить проекты</h2>
        <p>Проверьте соединение и повторите попытку.</p>
        <AButton class="projects__state-action" @click="fethProjects">Повторить</AButton>
      </div>

      <div v-else-if="projects.length === 0" class="projects__state">
        <div class="projects__state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <path d="M3 10h18M12 14v4M10 16h4" />
          </svg>
        </div>
        <h2>Пока нет проектов</h2>
        <p>Создайте первый проект, чтобы добавить заказчика и перейти к разделам работ.</p>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="projects__state">
        <div class="projects__state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4M8.5 11h5" />
          </svg>
        </div>
        <h2>Проекты не найдены</h2>
        <p>По запросу «{{ searchBar }}» ничего не найдено.</p>
        <AButton class="projects__state-action" @click="searchBar = ''">Сбросить поиск</AButton>
      </div>

      <div v-else class="projects-cards">
        <ProjectCard
          v-for="project in filteredProjects"
          :key="project.id"
          :codename="project.codeName"
          :customer="project.customer"
          :description="project.description"
          :creation-date="project.dateOfCreation"
          :photos-count="project.photosCount"
          :files-count="project.filesCount"
          :assemblies-count="project.assembliesCount"
          :cable-lines-count="project.cableLinesCount"
          @to-gallery="goToGallery(project)"
          @to-assemblies="goToAssemblies(project)"
          @to-files="goToFiles(project)"
          @to-cable-journal="toCableJournal(project)"
        />
      </div>
    </main>

    <AModal title="Новый проект" :opened="showModal" @close-emit="showModal = false">
      <form class="project-form" @submit.prevent="formReady && saveProject()">
        <div class="project-form__intro">
          <h3>Создание проекта</h3>
          <p>Укажите кодовое название, заказчика и краткое описание объекта.</p>
        </div>

        <div class="project-form__grid">
          <div class="project-form__group">
            <label for="codename">Кодовое название *</label>
            <AInput
              id="codename"
              placeholder="АС-101"
              v-model="form.codeName"
              @on-touch="form.codeNameTouched = true"
            />
            <p class="valid-error">{{ codeNameValidation }}</p>
          </div>

          <div class="project-form__group">
            <label for="customer">Заказчик *</label>
            <AInput
              id="customer"
              placeholder="Название объекта"
              v-model="form.customer"
              @on-touch="form.customerTouched = true"
            />
            <p class="valid-error">{{ customerValidation }}</p>
          </div>

          <div class="project-form__group project-form__group--wide">
            <label for="description">Описание проекта *</label>
            <AInput
              id="description"
              placeholder="Состав или вид оборудования, особенности и т.д."
              v-model="form.description"
              @on-touch="form.descriptionTouched = true"
            />
            <p class="valid-error">{{ descriptionValidation }}</p>
          </div>

          <div class="project-form__group">
            <label for="date">Дата создания *</label>
            <AInput
              id="date"
              type="date"
              v-model="form.creationDate"
              @on-touch="form.creationDateTouched = true"
            />
            <p class="valid-error">{{ creationDateValidation }}</p>
          </div>
        </div>
      </form>

      <template #footer>
        <div class="project-form__actions">
          <button class="modal-cancel" @click="showModal = false">Отмена</button>
          <AButton type="button" :disabled="!formReady" @click="saveProject">Создать</AButton>
        </div>
      </template>
    </AModal>
  </div>
</template>

<style scoped>
.global-container {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.projects-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
}

.projects__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: linear-gradient(135deg, #fff 0%, #fff 62%, #f5f3ff 100%);
  box-shadow: 4px 4px 24px -14px rgba(34, 60, 80, 0.28);
}

.projects__heading {
  min-width: 0;
}

.projects__breadcrumb {
  margin-bottom: 14px;
  color: #8a8f98;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.projects__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.projects__title-icon {
  display: grid;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  background: #eef2ff;
  color: #4f46e5;
}

.projects__title-icon svg {
  width: 23px;
  height: 23px;
}

.projects__title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.projects__title {
  margin: 0;
  color: #2d3748;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.2;
}

.projects__count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #6b7280;
  font-size: 12px;
  font-weight: 600;
}

.projects__subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.45;
}

.projects__header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.projects__sort.btn,
.projects__create.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.projects__sort.btn {
  flex: 0 0 auto;
  background: #fff;
  border-color: #e5e7eb;
  color: #4b5563;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.projects__sort.btn:hover {
  border-color: #c7d2fe;
  background: #f8faff;
}

.projects__create.btn {
  width: 100%;
}

.projects__sort svg,
.projects__create svg {
  width: 18px;
  height: 18px;
}

.projects__sort-label {
  display: none;
}

.projects__toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
}

.projects__search {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  margin: 0;
  color: #8a8f98;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.projects__search-control {
  position: relative;
}

.projects__search-control > svg {
  position: absolute;
  top: 50%;
  left: 11px;
  z-index: 1;
  width: 16px;
  height: 16px;
  color: #9298a1;
  pointer-events: none;
  transform: translateY(-50%);
}

.projects__search-control :deep(.input) {
  box-sizing: border-box;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px 8px 34px;
  border-color: #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: normal;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.projects__search-control :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.projects__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.projects__result-count {
  margin-right: auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.projects__reset {
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #6366f1;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.projects__reset:hover {
  background: #eef2ff;
}

.projects-cards {
  display: grid;
  gap: 14px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 14px;
  margin-bottom: 24px;
}

.project-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #eceef1;
  border-radius: 8px;
  background: #fff;
}

.project-skeleton__title,
.project-skeleton__facts div,
.project-skeleton__links div {
  background: #eef0f3;
}

.project-skeleton__title {
  width: 58%;
  height: 20px;
  border-radius: 999px;
}

.project-skeleton__facts {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ebebeb;
}

.project-skeleton__facts div {
  width: 100%;
  height: 12px;
  border-radius: 999px;
}

.project-skeleton__facts div:nth-child(2) {
  width: 82%;
}

.project-skeleton__facts div:nth-child(3) {
  width: 48%;
}

.project-skeleton__links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.project-skeleton__links div {
  height: 44px;
  border-radius: 8px;
}

.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    rgba(255, 255, 255, 0.75) 50%,
    transparent 80%
  );
  content: '';
  transform: translateX(-100%);
  animation: skeleton-slide 1.4s infinite;
}

@keyframes skeleton-slide {
  to {
    transform: translateX(100%);
  }
}

.projects__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 36px 18px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
  text-align: center;
}

.projects__state-icon {
  display: grid;
  width: 64px;
  height: 64px;
  margin-bottom: 18px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 18px;
  background: #eef2ff;
  color: #6366f1;
}

.projects__state-icon--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.projects__state-icon svg {
  width: 30px;
  height: 30px;
}

.projects__state h2 {
  margin: 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.projects__state p {
  max-width: 460px;
  margin: 8px 0 0;
  color: #8a8f98;
  font-size: 14px;
  line-height: 1.55;
}

.projects__state-action.btn {
  min-height: 38px;
  margin-top: 20px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
}

.project-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.project-form__intro h3 {
  margin: 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.project-form__intro p {
  margin: 6px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.5;
}

.project-form__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.project-form__group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.project-form__group label {
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.project-form__group :deep(.input) {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  padding: 9px 12px;
  border-color: #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-size: 14px;
  font-weight: 400;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.project-form__group :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.valid-error {
  min-height: 0;
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 1.4;
}

.valid-error:empty {
  display: none;
}

.project-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-cancel,
.project-form__actions :deep(.btn) {
  min-height: 38px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.modal-cancel {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
}

.modal-cancel:hover {
  border-color: #cbd5e0;
  background: #f9fafb;
  color: #374151;
}

@media (min-width: 640px) {
  .projects__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
  }

  .projects__header-actions {
    flex: 0 0 auto;
  }

  .projects__create.btn {
    width: auto;
  }

  .projects__toolbar {
    flex-direction: row;
    align-items: flex-end;
    justify-content: flex-start;
    gap: 12px;
    padding: 12px 14px;
  }

  .projects__search {
    width: min(100%, 460px);
  }

  .projects__toolbar-actions {
    flex: 0 0 auto;
    align-self: center;
    margin-left: auto;
  }

  .projects__result-count {
    margin-right: 0;
  }

  .project-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .project-form__group--wide {
    grid-column: 1 / -1;
  }
}

@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .projects-page {
    gap: 20px;
  }

  .projects__header {
    padding: 24px;
  }

  .projects__breadcrumb {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .projects__title-icon {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .projects__title {
    font-size: 26px;
  }

  .projects__subtitle {
    font-size: 14px;
  }

  .projects__create.btn {
    min-height: 42px;
    padding: 10px 16px;
    font-size: 15px;
  }

  .projects__toolbar {
    padding: 14px 16px;
  }

  .projects__search-control :deep(.input) {
    padding-inline: 36px 12px;
    font-size: 14px;
  }

  .projects__state {
    min-height: 380px;
    padding: 48px 24px;
  }
}

@media (min-width: 1100px) {
  .projects__sort-label {
    display: inline;
  }
}

@media (min-width: 900px) {
  .projects-cards {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}

@media (max-width: 600px) {
  .projects__header {
    gap: 14px;
    padding: 14px;
  }

  .projects__header-actions {
    display: flex;
  }

  .projects__create.btn {
    width: 100%;
  }

  .projects__toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42px;
    align-items: end;
    gap: 10px;
  }

  .projects__search {
    grid-column: 1;
    grid-row: 1;
  }

  .projects__sort.btn {
    display: flex;
    grid-column: 2;
    grid-row: 1;
    align-self: end;
    min-width: 42px;
    padding: 0;
  }

  .projects__toolbar-actions {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .projects__result-count {
    margin-right: auto;
  }

  .projects-cards {
    gap: 10px;
    padding: 10px;
    grid-template-columns: 1fr;
  }

  .project-form__actions {
    flex-direction: column-reverse;
  }

  .modal-cancel,
  .project-form__actions :deep(.btn) {
    width: 100%;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .global-container {
    padding: max(8px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
      max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  }

  .projects-page {
    gap: 10px;
  }

  .projects__header {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }

  .projects__breadcrumb {
    margin-bottom: 4px;
  }

  .projects__title-icon {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .projects__title {
    font-size: 20px;
  }

  .projects__subtitle {
    display: none;
  }

  .projects__header-actions {
    flex: 0 0 auto;
  }

  .projects__toolbar {
    flex-direction: row;
    align-items: end;
    gap: 10px;
    padding: 10px 12px;
  }

  .projects__search {
    flex: 1;
    min-width: 0;
  }

  .projects__search-control :deep(.input) {
    min-height: 38px;
  }

  .projects-cards {
    gap: 10px;
    margin-bottom: 12px;
    padding: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .projects__reset,
  .projects__sort.btn {
    transition: none;
  }

  .skeleton-shimmer::after {
    animation: none;
  }
}
</style>

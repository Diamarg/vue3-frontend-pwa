<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { computed, onMounted, ref } from 'vue'
import { usePageStore } from '@/stores/pages'
import { projectsApi } from '@/api/projects'
import AssemblyCard from '@/components/AssemblyCard.vue'
import AModal from '@/components/A-modal.vue'
import AInput from '@/components/A-input.vue'
import AButton from '@/components/A-button.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const project = ref(null)
const assemblies = ref([])
const loading = ref(true)
const loadError = ref(false)

const authStore = useAuthStore()
const pageStore = usePageStore()

const searchQuery = ref('')

const filteredAssemblies = computed(() => {
  if (!searchQuery.value.trim()) return assemblies.value

  const query = searchQuery.value.toLowerCase()
  return assemblies.value.filter(
    (assembly) =>
      assembly.codeName?.toLowerCase().includes(query) ||
      assembly.description?.toLowerCase().includes(query),
  )
})

const showCreateModal = ref(false)
const newAssemblyName = ref('')
const newAssemblyDesc = ref('')
const isCreating = ref(false)

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    toast.error('Ошибка загрузки проекта')
    console.error('Ошибка загрузки проекта:', error)
    project.value = { codeName: 'Неизвестный проект', customer: 'Заказчик' }
  }
  pageStore.setEntity(project.value.codeName)
}

const loadAssemblies = async () => {
  loading.value = true
  loadError.value = false
  try {
    const data = await projectsApi.getAssembliesByProjectId(route.params.projectId)
    assemblies.value = data || []
  } catch (error) {
    loadError.value = true
    console.error('Ошибка загрузки сборок:', error)
  } finally {
    loading.value = false
  }
}

const toDevices = (assemblyId) => {
  router.push(`/${route.params.projectId}/assemblies/${assemblyId}/devices`)
}

const toPanelEditor = (assemblyId) => {
  router.push(`/${route.params.projectId}/assemblies/${assemblyId}/panelEditor`)
}

const createAssembly = async () => {
  if (!newAssemblyName.value.trim()) {
    toast.error('Введите название сборки')
    return
  }

  isCreating.value = true
  try {
    await projectsApi.createAssembly({
      CodeName: newAssemblyName.value.trim(),
      ProjectId: Number(route.params.projectId),
      Description: newAssemblyDesc.value.trim() || null,
    })

    toast.success('Сборка успешно создана')
    showCreateModal.value = false
    newAssemblyName.value = ''
    newAssemblyDesc.value = ''

    await loadAssemblies()
  } catch (error) {
    console.error('Ошибка создания сборки:', error)
    toast.error(error.response?.data?.message || 'Не удалось создать сборку')
  } finally {
    isCreating.value = false
  }
}

onMounted(async () => {
  authStore.fetchMe()
  await Promise.all([loadProject(), loadAssemblies()])
})
</script>

<template>
  <div class="global-container">
    <main class="assemblies-page">
      <header class="assemblies__header">
        <div class="assemblies__heading">
          <div class="assemblies__breadcrumb admin-headbar__info">
            <span class="admin-headbar__project">{{ project?.codeName || 'Проект' }}</span>
            <span class="admin-headbar__separator">/</span>
            <span>Сборки ШУ</span>
          </div>

          <div class="assemblies__title-row">
            <span class="assemblies__title-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                <path d="m12 3 9 5-9 5-9-5Z" />
                <path d="m3 12 9 5 9-5" />
                <path d="m3 16 9 5 9-5" />
              </svg>
            </span>
            <div>
              <div class="assemblies__title-line">
                <h1 class="assemblies__title">Сборки ШУ</h1>
                <span v-if="!loading" class="assemblies__count-badge">{{ assemblies.length }}</span>
              </div>
              <p class="assemblies__subtitle">Щиты управления и монтажные панели проекта</p>
            </div>
          </div>
        </div>

        <a-button
          v-if="authStore.isAdmin"
          class="assemblies__create"
          :disabled="isCreating"
          @click="showCreateModal = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Добавить сборку</span>
        </a-button>
      </header>

      <section
        v-if="!loading && !loadError && assemblies.length > 0"
        class="assemblies__toolbar"
        aria-label="Поиск сборок"
      >
        <label class="assemblies__search">
          <span>Поиск</span>
          <div class="assemblies__search-control">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <AInput v-model="searchQuery" placeholder="По названию или описанию..." />
          </div>
        </label>

        <div class="assemblies__toolbar-actions">
          <span class="assemblies__result-count">
            {{
              searchQuery.trim()
                ? `Найдено: ${filteredAssemblies.length}`
                : `Всего: ${assemblies.length}`
            }}
          </span>
          <button v-if="searchQuery.trim()" class="assemblies__reset" @click="searchQuery = ''">
            Сбросить
          </button>
        </div>
      </section>

      <div v-if="loading" class="assembly-grid" aria-label="Загрузка сборок">
        <div v-for="item in 6" :key="item" class="assembly-skeleton">
          <div class="assembly-skeleton__title skeleton-shimmer"></div>
          <div class="assembly-skeleton__facts">
            <div class="skeleton-shimmer"></div>
            <div class="skeleton-shimmer"></div>
            <div class="skeleton-shimmer"></div>
          </div>
          <div class="assembly-skeleton__actions">
            <div class="skeleton-shimmer"></div>
            <div class="skeleton-shimmer"></div>
          </div>
        </div>
      </div>

      <div v-else-if="loadError" class="assemblies__state">
        <div class="assemblies__state-icon assemblies__state-icon--error" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <h2>Не удалось загрузить сборки</h2>
        <p>Проверьте соединение и повторите попытку.</p>
        <AButton class="assemblies__state-action" @click="loadAssemblies">Повторить</AButton>
      </div>

      <div v-else-if="filteredAssemblies.length > 0" class="assembly-grid">
        <AssemblyCard
          v-for="assembly in filteredAssemblies"
          :key="assembly.id"
          :project-name="project?.codeName || ''"
          :assembly-name="assembly.codeName"
          :description="assembly.description"
          :devices-count="assembly.devicesCount ?? 0"
          :total-quantity="assembly.totalQuantity ?? 0"
          @toDevices="toDevices(assembly.id)"
          @toPanelEditor="toPanelEditor(assembly.id)"
        />
      </div>

      <div v-else-if="assemblies.length === 0" class="assemblies__state">
        <div class="assemblies__state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="m12 3 9 5-9 5-9-5Z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 16 9 5 9-5" />
          </svg>
        </div>
        <h2>В этом проекте пока нет сборок</h2>
        <p>Добавьте первую сборку, чтобы перейти к устройствам и монтажной панели.</p>
      </div>

      <div v-else class="assemblies__state">
        <div class="assemblies__state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
            <path d="M8.5 11h5" />
          </svg>
        </div>
        <h2>Сборки не найдены</h2>
        <p>По запросу «{{ searchQuery }}» ничего не найдено.</p>
        <AButton class="assemblies__state-action" @click="searchQuery = ''">Сбросить поиск</AButton>
      </div>
    </main>

    <AModal title="Новая сборка" :opened="showCreateModal" @close-emit="showCreateModal = false">
      <div class="create-form">
        <div class="create-intro">
          <h3>Создание сборки</h3>
          <p>Укажите название и при необходимости добавьте краткое описание.</p>
        </div>

        <div class="form-group">
          <label for="asm-name">Название сборки *</label>
          <AInput
            id="asm-name"
            v-model="newAssemblyName"
            placeholder="Например: ШУ1"
            :disabled="isCreating"
            @keyup.enter="createAssembly"
          />
        </div>

        <div class="form-group">
          <label for="asm-desc">Описание</label>
          <AInput
            id="asm-desc"
            v-model="newAssemblyDesc"
            placeholder="Например: Шкаф управления обратным осмосом"
            :disabled="isCreating"
            @keyup.enter="createAssembly"
          />
        </div>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button class="modal-cancel" :disabled="isCreating" @click="showCreateModal = false">
            Отмена
          </button>
          <AButton
            class="modal-submit"
            :disabled="isCreating || !newAssemblyName.trim()"
            @click="createAssembly"
          >
            {{ isCreating ? 'Создание…' : 'Создать' }}
          </AButton>
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

.assemblies-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
}

.assemblies__header {
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

.assemblies__heading {
  min-width: 0;
}

.assemblies__breadcrumb {
  margin-bottom: 14px;
  color: #8a8f98;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.admin-headbar__project {
  color: #4b5563;
  font-weight: 600;
}

.admin-headbar__separator {
  margin: 0 8px;
  color: #cbd5e0;
}

.assemblies__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.assemblies__title-icon {
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

.assemblies__title-icon svg {
  width: 23px;
  height: 23px;
}

.assemblies__title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.assemblies__title {
  margin: 0;
  color: #2d3748;
  font-size: 23px;
  font-weight: 600;
  line-height: 1.2;
}

.assemblies__count-badge {
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

.assemblies__subtitle {
  margin: 5px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.45;
}

.assemblies__create.btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: 500;
}

.assemblies__create svg {
  width: 18px;
  height: 18px;
}

.assemblies__toolbar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgb(230, 230, 230);
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 24px -16px rgba(34, 60, 80, 0.24);
}

.assemblies__search {
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

.assemblies__search-control {
  position: relative;
}

.assemblies__search-control > svg {
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

.assemblies__search-control :deep(.input) {
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

.assemblies__search-control :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.assemblies__toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.assemblies__result-count {
  margin-right: auto;
  color: #6b7280;
  font-size: 13px;
  white-space: nowrap;
}

.assemblies__reset {
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

.assemblies__reset:hover {
  background: #eef2ff;
}

.assembly-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.assembly-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #eceef1;
  border-radius: 8px;
  background: #fff;
  box-shadow: 4px 4px 20px -14px rgba(34, 60, 80, 0.28);
}

.assembly-skeleton__title,
.assembly-skeleton__facts div,
.assembly-skeleton__actions div {
  background: #eef0f3;
}

.assembly-skeleton__title {
  width: 54%;
  height: 18px;
  margin: 0 auto 12px;
  border-radius: 999px;
}

.assembly-skeleton__facts {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.assembly-skeleton__facts div {
  width: 100%;
  height: 10px;
  border-radius: 999px;
}

.assembly-skeleton__facts div:nth-child(2) {
  width: 78%;
}

.assembly-skeleton__facts div:nth-child(3) {
  width: 88%;
}

.assembly-skeleton__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebebeb;
}

.assembly-skeleton__actions div {
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

.assemblies__state {
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

.assemblies__state-icon {
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

.assemblies__state-icon--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #dc2626;
}

.assemblies__state-icon svg {
  width: 30px;
  height: 30px;
}

.assemblies__state h2 {
  margin: 0;
  color: #374151;
  font-size: 18px;
  font-weight: 600;
}

.assemblies__state p {
  max-width: 460px;
  margin: 8px 0 0;
  color: #8a8f98;
  font-size: 14px;
  line-height: 1.55;
}

.assemblies__state-action.btn {
  min-height: 38px;
  margin-top: 20px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 500;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-intro h3 {
  margin: 0;
  color: #374151;
  font-size: 16px;
  font-weight: 600;
}

.create-intro p {
  margin: 6px 0 0;
  color: #8a8f98;
  font-size: 13px;
  line-height: 1.5;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  margin: 0;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
}

.form-group :deep(.input) {
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

.form-group :deep(.input):focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-group :deep(.input):disabled {
  background: #f8fafc;
  cursor: not-allowed;
  opacity: 0.7;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-cancel,
.modal-submit.btn {
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

.modal-cancel:hover:not(:disabled) {
  border-color: #cbd5e0;
  background: #f9fafb;
  color: #374151;
}

.modal-cancel:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (min-width: 640px) {
  .assemblies__header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
  }

  .assemblies__create.btn {
    width: auto;
  }

  .assemblies__toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
  }

  .assemblies__search {
    width: min(100%, 460px);
  }

  .assemblies__toolbar-actions {
    flex: 0 0 auto;
  }

  .assemblies__result-count {
    margin-right: 0;
  }

  .assembly-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
}

@media (min-width: 768px) {
  .global-container {
    padding: 24px;
  }

  .assemblies-page {
    gap: 20px;
  }

  .assemblies__header {
    padding: 24px;
  }

  .assemblies__breadcrumb {
    margin-bottom: 16px;
    font-size: 13px;
  }

  .assemblies__title-icon {
    flex-basis: 48px;
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .assemblies__title {
    font-size: 26px;
  }

  .assemblies__subtitle {
    font-size: 14px;
  }

  .assemblies__create.btn {
    min-height: 42px;
    padding: 10px 16px;
    font-size: 15px;
  }

  .assemblies__toolbar {
    padding: 14px 16px;
  }

  .assemblies__search-control :deep(.input) {
    padding-inline: 36px 12px;
    font-size: 14px;
  }

  .assembly-grid {
    gap: 20px;
  }

  .assemblies__state {
    min-height: 380px;
    padding: 48px 24px;
  }
}

@media (min-width: 1100px) {
  .assembly-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  }
}

@media (max-width: 600px) {
  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-cancel,
  .modal-submit.btn {
    width: 100%;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .global-container {
    padding: max(8px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
      max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  }

  .assemblies-page {
    gap: 10px;
  }

  .assemblies__header {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }

  .assemblies__breadcrumb {
    margin-bottom: 4px;
  }

  .assemblies__title-icon {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .assemblies__title {
    font-size: 20px;
  }

  .assemblies__subtitle {
    display: none;
  }

  .assemblies__header-actions {
    flex: 0 0 auto;
  }

  .assemblies__toolbar {
    flex-direction: row;
    align-items: end;
    gap: 10px;
    padding: 10px 12px;
  }

  .assemblies__search {
    flex: 1;
    min-width: 0;
  }

  .assemblies__search-control :deep(.input) {
    min-height: 38px;
  }

  .assembly-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .assemblies__state {
    min-height: 0;
    padding: 24px 16px;
  }

  .modal-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .modal-cancel,
  .modal-submit.btn {
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .assemblies__reset {
    transition: none;
  }

  .skeleton-shimmer::after {
    animation: none;
  }
}
</style>

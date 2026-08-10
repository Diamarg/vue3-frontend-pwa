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

const authStore = useAuthStore()
const pageStore = usePageStore()

// --- Фильтрация и поиск ---
const searchQuery = ref('')

const filteredAssemblies = computed(() => {
  if (!searchQuery.value.trim()) return assemblies.value

  const q = searchQuery.value.toLowerCase()
  return assemblies.value.filter(
    (a) => a.codeName?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q),
  )
})

// --- Модалка создания ---
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
  pageStore.pageInfo.name = `Сборки "${project.value.codeName}"`
}

const loadAssemblies = async () => {
  try {
    const data = await projectsApi.getAssembliesByProjectId(route.params.projectId)
    assemblies.value = data || []
  } catch (error) {
    toast.error('Ошибка загрузки сборок')
    console.error('Ошибка загрузки сборок:', error)
  }
}

const toDevices = (assemblyId) => {
  router.push(`/${project.value.id}/assemblies/${assemblyId}/devices`)
}

const toPanelEditor = (assemblyId) => {
  router.push(`/${project.value.id}/assemblies/${assemblyId}/panelEditor`)
}

const deleteAssembly = async (assembly) => {
  if (confirm(`Действительно удалить сборку "${assembly.codeName}"?`)) {
    try {
      await projectsApi.deleteAssembly(assembly.id)
      toast.success('Сборка удалена')
      await loadAssemblies()
    } catch (error) {
      toast.error(`Ошибка удаления: возможно, в сборке есть устройства`)
      console.error(`Ошибка удаления сборки ${assembly.codeName}`, error)
    }
  }
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
  await loadProject()
  await loadAssemblies()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <!-- === ХЕДЕР В СТИЛЕ ГАЛЕРЕИ === -->
    <div class="gallery__header">
      <div v-if="assemblies.length > 0 || searchQuery" class="gallery__filter">
        <div class="gallery__search-wrapper">
          <span class="search-label">Поиск:</span>
          <AInput
            v-model="searchQuery"
            placeholder="По названию или описанию..."
            class="search-input"
          />
        </div>

        <div class="gallery__info-block">
          <!-- Группируем текст в один блок -->
          <div class="info-text-group">
            <span class="gallery__total-photos" v-if="!searchQuery">
              Всего: {{ assemblies.length }} сборок
            </span>
            <span class="gallery__total-photos" v-else>
              Найдено: {{ filteredAssemblies.length }}
            </span>
          </div>

          <a-button
            v-if="authStore.isAdmin"
            @click="showCreateModal = true"
            class="btn-secondary-style"
          >
            + Добавить сборку
          </a-button>
        </div>
      </div>

      <!-- Если сборок нет, показываем большую кнопку по центру -->
      <div v-if="assemblies.length === 0 && !searchQuery" class="empty-action-wrapper">
        <a-button
          v-if="authStore.isAdmin"
          @click="showCreateModal = true"
          class="btn-primary full-width-btn"
        >
          + Создать первую сборку
        </a-button>
      </div>
    </div>
    <div class="assembly-cards">
      <!-- === СЕТКА КАРТОЧЕК === -->
      <div v-if="filteredAssemblies.length > 0" class="gallery__cards assembly-grid">
        <AssemblyCard
          v-for="assembly in filteredAssemblies"
          :key="assembly.id"
          :project-name="project?.codeName || ''"
          :assembly-name="assembly.codeName"
          :description="assembly.description"
          :is-admin="authStore.isAdmin"
          @onDelete="deleteAssembly(assembly)"
          @toDevices="toDevices(assembly.id)"
          @toPanelEditor="toPanelEditor(assembly.id)"
        />
      </div>

      <div v-else-if="assemblies.length === 0 && !searchQuery" class="gallery__null-photo">
        <div class="empty-icon">📦</div>
        <p>В этом проекте пока нет сборок</p>
      </div>

      <div v-else class="gallery__null-photo">
        <p>Ничего не найдено по запросу "{{ searchQuery }}"</p>
      </div>
    </div>

    <!-- === МОДАЛКА СОЗДАНИЯ === -->
    <AModal title="Новая сборка" :opened="showCreateModal" @close-emit="showCreateModal = false">
      <div class="create-form">
        <div class="form-group">
          <label for="asm-name">Название сборки *</label>
          <AInput
            id="asm-name"
            v-model="newAssemblyName"
            placeholder="Например: ШУ1"
            @keyup.enter="createAssembly"
          />
        </div>

        <div class="form-group">
          <label for="asm-desc">Описание</label>
          <AInput
            id="asm-desc"
            v-model="newAssemblyDesc"
            placeholder="Например: Шкаф управления обратным осмосом"
          />
        </div>

        <!-- Блок действий с кнопкой Отмена -->
        <div class="modal-actions">
          <AButton
            @click="createAssembly"
            :disabled="isCreating || !newAssemblyName.trim()"
            class="full-width-btn btn-primary"
          >
            {{ isCreating ? 'Создание...' : 'Создать' }}
          </AButton>
          <a class="btn-cancel-link" @click="showCreateModal = false">Отмена</a>
        </div>
      </div>
    </AModal>
  </div>
</template>

<style scoped>
/* === БАЗОВЫЕ СТИЛИ (из GalleryPage) === */
.global-container {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.gallery__header {
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: rgb(255, 255, 255);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* АДАПТИВНАЯ СЕТКА ДЛЯ ХЕДЕРА */
.gallery__filter {
  align-items: center;
  display: grid;
  /* По умолчанию (мобильные) - 1 колонка */
  grid-template-columns: 1fr;
  gap: 12px;
  width: 100%;
}

.gallery__search-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.search-label {
  font-size: 14px;
  color: #6b7280;
  white-space: nowrap;
}

.search-input {
  flex: 1;
  max-width: none;
}

/* Блок с информацией и кнопкой */
.gallery__info-block {
  display: flex;
  align-items: center;
  /* На мобильном: пространство между текстом и кнопкой */
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.info-text-group {
  /* Чтобы текст не сжимался */
  white-space: nowrap;
}

.gallery__total-photos {
  font-size: 14px;
  color: #6b7280;
}

.empty-action-wrapper {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.full-width-btn {
  width: 100%;
}

/* Ссылка-кнопка Отмена (в стиле GalleryPage) */
.btn-cancel-link {
  display: block;
  text-align: center;
  margin-top: 12px;
  font-size: 14px;
  color: #718096;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.2s;
}

.btn-cancel-link:hover {
  color: #4a5568;
  text-decoration: underline;
}

.gallery__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  margin-top: 16px;
  background-color: #ffffff;
  padding: 24px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
  border-style: solid;
  border-width: 1px;
}

.gallery__null-photo {
  margin-top: 16px;
  text-align: center;
  font-size: 16px;
  padding: 32px 16px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  border-radius: 8px;
  border: 1px solid rgb(230, 230, 230);
  background-color: rgb(255, 255, 255);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* === ФОРМА В МОДАЛКЕ === */
.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.modal-actions {
  margin-top: 8px;
}

/* === ДЕСКТОПНАЯ АДАПТАЦИЯ === */
@media (min-width: 768px) {
  .global-container {
    margin: 0 auto;
  }

  .gallery__header {
    flex-direction: row;
    justify-content: space-between;
    padding: 24px;
  }

  /* На десктопе возвращаем 2 колонки: поиск слева, инфо+кнопка справа */
  .gallery__filter {
    grid-template-columns: 1fr auto;
    gap: 24px;
    width: auto;
  }

  .search-input {
    max-width: 400px;
  }

  .gallery__info-block {
    /* НА ДЕСКТОПЕ: Разносим текст и кнопку по краям */
    justify-content: space-between;
    width: auto;
    min-width: 300px; /* Минимальная ширина, чтобы они не слипались */
    gap: 24px;
  }

  .gallery__cards {
    margin-top: 24px;
  }

  .gallery__null-photo {
    margin-top: 24px;
    font-size: 18px;
    padding: 48px 24px;
  }
}
</style>

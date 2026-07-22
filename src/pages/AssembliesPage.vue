<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { onMounted, ref } from 'vue'
import { usePageStore } from '@/stores/pages'
import { projectsApi } from '@/api/projects'
import AssemblyCard from '@/components/AssemblyCard.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const project = ref(null)
const assemblies = ref(null)
const assemblyDevices = ref(null)

const authStore = useAuthStore()
const pageStore = usePageStore()

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
    assemblies.value = await projectsApi.getAssembliesByProjectId(route.params.projectId)
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

const toCableJournal = (assemblyId) => {
  router.push(`/${project.value.id}/assemblies/${assemblyId}/cableJournal`)
}

const deleteAssembly = async (assembly) => {
  console.log(`Удалить сборку ${assembly.codeName} id: ${assembly.id}`)
  if (confirm('Действительно удалить сборку?')) {
    try {
      await projectsApi.deleteAssembly(assembly.id)
    } catch (error) {
      toast.error(`Ошибка удаления ${assembly.codeName}, возможно в сборке есть устройства`)
      console.error(`Ошибка удаления сборки ${assembly.codeName}`, error)
    }
  }

  await loadAssemblies()
}

onMounted(async () => {
  await loadProject()
  await loadAssemblies()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <div v-if="assemblies" class="assembly-cards">
      <AssemblyCard
        v-for="assembly in assemblies"
        :project-name="project.codeName"
        :assembly-name="assembly.codeName"
        :description="assembly.description"
        :is-admin="authStore.isAdmin"
        @onDelete="deleteAssembly(assembly)"
        @toDevices="toDevices(assembly.id)"
        @toPanelEditor="toPanelEditor(assembly.id)"
        @toCableJournal="toCableJournal(assembly.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.assembly-cards {
  display: grid;
  gap: 24px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);

  grid-template-columns: repeat(auto-fit, minmax(400px, auto));
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  margin-block: 24px;
}
</style>

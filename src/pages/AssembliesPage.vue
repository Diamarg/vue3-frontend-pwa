<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { onMounted, ref } from 'vue'
import { usePageStore } from '@/stores/pages'
import { projectsApi } from '@/api/projects'
import AssemblyCard from '@/components/AssemblyCard.vue'

const route = useRoute()
const router = useRouter()

const project = ref(null)
const assemblies = ref(null)

const authStore = useAuthStore()
const pageStore = usePageStore()

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки проекта:', error)
    project.value = { codeName: 'Неизвестный проект', customer: 'Заказчик' }
  }
  pageStore.pageInfo.name = `Сборки "${project.value.codeName}"`
}

const loadAssemblies = async () => {
  try {
    assemblies.value = await projectsApi.getAssembliesByProjectId(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки сборок:', error)
  }
}
const toDevices = (assemblyId) => {
  console.log(assemblyId)
  console.log(project.value.id)
  router.push(`/${project.value.id}/assemblies/${assemblyId}/devices`)
}

const deleteAssembly = (assembly) => {
  console.log(`Удалить сборку ${assembly.codeName}`)
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
      />
    </div>
    <div v-else><h1>!!!!!!!!!!!!!!</h1></div>
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

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { onMounted, ref } from 'vue'
import { usePageStore } from '@/stores/pages'
import { projectsApi } from '@/api/projects'

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

onMounted(async () => {
  await loadProject()
  await loadAssemblies()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <div class="placeholder">Сборки</div>
    <div v-if="assemblies" v-for="assembly in assemblies" class="assembly-card">
      {{ assembly.id }}: {{ assembly.codeName }}
      <a @click="toDevices(assembly.id)">клик</a>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  font-size: 24px;
  font-weight: 200;
  color: rgb(66, 66, 66);
  text-align: center;
  margin-top: 24px;
}
</style>

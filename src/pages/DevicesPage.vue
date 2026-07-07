<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'
import { projectsApi } from '@/api/projects'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'

const route = useRoute()
const router = useRouter()

const project = ref(null)
const assembly = ref(null)

const authStore = useAuthStore()
const pageStore = usePageStore()

const loadProject = async () => {
  try {
    project.value = await projectsApi.getProjectById(route.params.projectId)
  } catch (error) {
    console.error('Ошибка загрузки проекта:', error)
  }
  pageStore.pageInfo.name = `Устройства "${project.value.codeName}"`
}

const loadAssembly = async () => {
  try {
    assembly.value = await projectsApi.getAssemblyById(route.params.assemblyId)
  } catch (error) {
    console.error('Ошибка загрузки сборок:', error)
  }
}

onMounted(async () => {
  await loadProject()
  await loadAssembly()
  await authStore.fetchMe()
})
</script>

<template>
  <h1 v-if="project && assembly">
    Устройства проекта {{ project.codeName }}, Сборка {{ assembly.codeName }}
  </h1>
</template>

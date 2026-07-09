<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import { projectsApi } from '@/api/projects'
import { devicesApi } from '@/api/devices'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()

defineProps(['projectId', 'assemblyId'])

const project = ref(null)
const assembly = ref(null)
const allDevices = ref([])
const assemblyDevices = ref([])
const assemblyDeviceIDs = ref([])

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
const loadAllDevices = async () => {
  try {
    allDevices.value = await devicesApi.getAll()
    console.log(allDevices.value)
  } catch (error) {
    toast.error('Не удалось загрузить все устройства')
    console.log('Не удалось загрузить все устройства', error)
  }
}

const loadAssemblyDevices = async () => {
  try {
    assemblyDevices.value = await projectsApi.getAssemblyDevicesByAssemblyId(
      route.params.assemblyId,
    )

    assemblyDeviceIDs.value = assemblyDevices.value.map((device) => device.deviceId)

    console.log('assembly devices: ', assemblyDevices.value)
  } catch (error) {
    toast.error('Не удалось загрузить устройства сборки')
    console.log('Не удалось загрузить устройства сборки', error)
  }
}

const assemblyDevicesFilter = computed(() => {
  return allDevices.value.filter((device) => assemblyDeviceIDs.value.includes(device.id))
})

onMounted(async () => {
  await loadProject()
  await loadAssembly()
  await loadAssemblyDevices()
  await loadAllDevices()
  await authStore.fetchMe()
})
</script>

<template>
  <div class="global-container">
    <div class="device-string" v-for="device in assemblyDevicesFilter">
      {{ device.description }}
    </div>
  </div>
</template>

<style scoped>
.global-container {
  margin-top: 24px;
}

.device-string {
  box-shadow: 4px 4px 20px -10px rgba(34, 60, 80, 0.2);
  gap: 8px;
  border-radius: 8px;
  border-color: rgb(230, 230, 230);
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  transition: all 0.5s;
  margin-top: 8px;
}
</style>

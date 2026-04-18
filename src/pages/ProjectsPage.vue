<script setup>
import Abutton from '@/components/Abutton.vue'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePageStore } from '@/stores/pages'
import { onMounted } from 'vue'
import Ainput from '@/components/Ainput.vue'
import ProjectCard from '@/components/ProjectCard.vue'
import AddIcon from '@/components/icons/AddIcon.vue'

const authStore = useAuthStore()
const pageStore = usePageStore()

const search = ref('')
const loading = ref(true)

onMounted(async () => {
  pageStore.nowpage = 'Проекты'
  await authStore.fetchMe()
  loading.value = false
})
</script>

<template>
  <div v-if="authStore.user" class="global-container">
    <div class="projects">
      <div class="projects-headbar">
        <div>Поиск:</div>
        <ainput
          class="projects-headbar__searchinput"
          v-model="search"
          placeholder="Найти по имени проекта или заказчику..."
        ></ainput>
        <Abutton
          ><template #icon><add-icon color="white" /></template> Создать новый проект</Abutton
        >
      </div>
      <div class="projects-cards">
        <ProjectCard></ProjectCard>
        <ProjectCard></ProjectCard>
        <ProjectCard></ProjectCard>
        <ProjectCard></ProjectCard>
        <ProjectCard></ProjectCard>
      </div>
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
  grid-template-columns: auto 1fr auto;
  border-radius: 8px;
  border-color: #d9d9d9;
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
  margin-top: 24px;
  align-items: center;
}

.projects-headbar__searchinput {
  max-width: 400px;
  margin-left: 16px;
}

.projects-cards {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(300px, auto));
  border-radius: 8px;
  border-color: #d9d9d9;
  border-style: solid;
  border-width: 1px;
  background-color: rgb(255, 255, 255);
  padding: 24px;
}
</style>

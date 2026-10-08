<template>
  <div class="navbar" :class="{ 'navbar--back': showBack }">
    <button v-if="showBack" class="navbar-back" aria-label="Назад" @click="goBack">←</button>

    <div class="navbar-pagename">{{ pageStore.title }}</div>

    <div class="navbar-links">
      <a @click="goToProjects">Проекты</a>
      <a v-if="authStore.isAdmin" @click="toAdminPanel">Админка</a>
    </div>

    <div v-if="currentUser" class="navbar-account">
      <div class="navbar-user" :class="{ admin: authStore.isAdmin }">
        {{ currentUser.fullName }}
      </div>
      <a @click="handleLogout">Выйти</a>
    </div>

    <button
      class="navbar-menu-btn"
      aria-label="Меню навигации"
      :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen"
    >
      &#8942;
    </button>

    <div v-if="menuOpen" class="navbar-backdrop" @click="menuOpen = false"></div>
    <div v-if="menuOpen" class="navbar-menu" role="menu">
      <div
        v-if="currentUser?.fullName"
        class="navbar-menu__user"
        :class="{ admin: authStore.isAdmin }"
      >
        {{ currentUser.fullName }}
      </div>
      <button class="navbar-menu__item" role="menuitem" @click="goToProjects">Проекты</button>
      <button
        v-if="authStore.isAdmin"
        class="navbar-menu__item"
        role="menuitem"
        @click="toAdminPanel"
      >
        Админка
      </button>
      <button
        class="navbar-menu__item navbar-menu__item--danger"
        role="menuitem"
        @click="handleLogout"
      >
        Выйти
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue' // Используем computed вместо onMounted/ref
import { useAuthStore } from '@/stores/auth'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { usePageStore } from '@/stores/pages'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const toast = useToast()
const pageStore = usePageStore()

const menuOpen = ref(false)

// Безопасное получение текущего пользователя через computed
const currentUser = computed(() => authStore.user)

// На главной возвращаться некуда, поэтому кнопка «назад» там не нужна
const showBack = computed(() => route.path !== '/')

const closeMenu = () => {
  menuOpen.value = false
}

const goBack = () => {
  // При прямом заходе по URL (или из PWA-шортката) истории нет — уводим на проекты
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/')
  }
}

const goToProjects = () => {
  closeMenu()
  router.push('/')
}

const toAdminPanel = () => {
  closeMenu()
  router.push('/admin')
}

const handleLogout = () => {
  closeMenu()
  // 1. СОХРАНЯЕМ данные пользователя в локальную переменную ДО выхода
  const userName = authStore.user?.userName || 'Пользователь'
  const fullName = authStore.user?.fullName || ''

  // 2. Показываем тост с сохраненными данными
  toast.info(`${fullName} (${userName}) выходит из системы`)

  // 3. Выполняем выход (очищает стор)
  authStore.logout()

  // 4. Перенаправляем на логин
  router.push('/login')
}

// Смена маршрута (в том числе по ссылке из меню) всегда закрывает меню
watch(() => route.fullPath, closeMenu)
</script>

<style scoped>
/* Стили остаются без изменений */
.navbar {
  display: grid;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.2);
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas: 'back title menu';
  align-items: center;
  height: var(--navbar-height);
  gap: 10px;
  padding-inline: 16px;
  /* Прилипание вместо fixed: навбар остаётся в потоке, поэтому страницам
     не приходится добавлять себе отступ сверху */
  position: sticky;
  top: 0;
  /* Выше плавающих кнопок страниц, но ниже модальных окон (z-index 1000) */
  z-index: 120;
  border-color: rgba(0, 0, 0, 0);
  border-bottom-width: 1px;
  border-bottom-color: rgb(230, 230, 230);
  border-style: solid;
  background-color: rgb(255, 255, 255);
}

.navbar-back {
  grid-area: back;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  font-size: 20px;
  color: rgb(60, 60, 60);
  background-color: rgb(245, 245, 245);
  transition: background-color 0.2s;
}

.navbar-back:focus-visible {
  outline: 2px solid rgb(99, 102, 241);
  outline-offset: 2px;
}

/* Наведение имеет смысл только там, где есть курсор */
@media (hover: hover) {
  .navbar-back:hover {
    background-color: rgb(230, 230, 230);
  }
}

.navbar-pagename {
  grid-area: title;
  font-size: 17px;
  font-weight: 300;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-links,
.navbar-account {
  display: none;
}

.navbar-menu-btn {
  display: flex;
  grid-area: menu;
  justify-self: end;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  font-size: 24px;
  line-height: 1;
  color: rgb(60, 60, 60);
  background-color: rgb(245, 245, 245);
}

.navbar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
}

.navbar-menu {
  position: absolute;
  top: calc(100% - 6px);
  right: 8px;
  z-index: 160;
  display: grid;
  gap: 2px;
  min-width: 190px;
  padding: 6px;
  background-color: rgb(255, 255, 255);
  border: 1px solid rgb(230, 230, 230);
  border-radius: 10px;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.4);
}

.navbar-menu__user {
  padding: 10px 12px;
  font-weight: 400;
  font-size: 14px;
  text-align: center;
  color: rgb(99, 99, 99);
  border-bottom: 1px solid rgb(238, 238, 238);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-menu__item {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 16px;
  text-align: left;
  color: rgb(40, 40, 40);
}

.navbar-menu__item:active {
  background-color: rgb(240, 240, 240);
}

.navbar-menu__item--danger {
  color: rgb(180, 40, 40);
}

.admin {
  color: rgb(173, 0, 0);
}

/* === ДЕСКТОП: «назад», название, ссылки и аккаунт в одну строку, меню не нужен === */
@media (min-width: 701px) {
  .navbar {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    grid-template-areas: 'title links account';
    gap: 16px;
    padding-inline: 24px;
  }

  .navbar--back {
    /* отдельная колонка под «назад» появляется только когда кнопка есть,
       иначе на главной у названия лишний сдвиг */
    grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
    grid-template-areas: 'back title links account';
  }

  .navbar-menu-btn,
  .navbar-menu,
  .navbar-backdrop {
    display: none;
  }

  .navbar-pagename {
    justify-self: start;
    font-size: 20px;
  }

  .navbar-links {
    grid-area: links;
    display: flex;
    gap: 20px;
  }

  .navbar-account {
    grid-area: account;
    justify-self: end;
    display: grid;
    align-items: center;
    grid-template-columns: auto auto;
    gap: 12px;
    min-width: 0;
  }

  .navbar-user {
    font-weight: 400;
    text-align: center;
    color: rgb(99, 99, 99);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

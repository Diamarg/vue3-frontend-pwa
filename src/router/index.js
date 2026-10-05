import { createRouter, createWebHistory } from 'vue-router'
import { usePageStore } from '@/stores/pages'
import AdminPanelPage from '@/pages/AdminPanelPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import ProjectsPage from '@/pages/ProjectsPage.vue'
import GalleryPage from '@/pages/GalleryPage.vue'
import AssembliesPage from '@/pages/AssembliesPage.vue'
import FilesPage from '@/pages/FilesPage.vue'
import DevicesPage from '@/pages/DevicesPage.vue'
import PanelEditorPage from '@/pages/PanelEditorPage.vue'
import CableJournalPage from '@/pages/CableJournalPage.vue'
import TestPage from '@/pages/TestPage.vue'
import { getStoredToken } from '@/utils/token'

const routes = [
  {
    path: '/admin',
    component: AdminPanelPage,
    meta: { title: 'Админ-панель', requiresAuth: true, requiresAdmin: true },
  },
  { path: '/login', component: LoginPage, meta: { title: 'Вход', guest: true } },
  { path: '/register', component: RegisterPage, meta: { title: 'Регистрация', guest: true } },
  {
    path: '/',
    component: ProjectsPage,
    props: true,
    meta: { title: 'Проекты', requiresAuth: true },
  },
  {
    path: '/:projectId/gallery',
    component: GalleryPage,
    props: true,
    meta: { title: 'Галерея', requiresAuth: true },
  },
  {
    path: '/:projectId/assemblies',
    component: AssembliesPage,
    props: true,
    meta: { title: 'Сборки', requiresAuth: true },
  },
  {
    path: '/:projectId/assemblies/:assemblyId/panelEditor',
    component: PanelEditorPage,
    props: true,
    meta: { title: 'Редактор панели', requiresAuth: true },
  },
  {
    path: '/:projectId/cableJournal',
    component: CableJournalPage,
    props: true,
    meta: { title: 'Кабельный журнал', requiresAuth: true },
  },
  {
    path: '/:projectId/assemblies/:assemblyId/devices',
    component: DevicesPage,
    props: true,
    meta: { title: 'Устройства', requiresAuth: true },
  },
  {
    path: '/:projectId/files',
    component: FilesPage,
    props: true,
    meta: { title: 'Файлы', requiresAuth: true },
  },
  { path: '/test', component: TestPage, props: true, meta: { title: 'Тест', requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, left: 0, behavior: 'smooth' }
  },
})

router.beforeEach((to, from) => {
  const token = getStoredToken()
  const isAuthenticated = !!token

  // 1. Если страница для гостей (login/register), а пользователь уже вошел → редирект на главную
  if (to.meta.guest && isAuthenticated) {
    return '/'
  }

  // 2. Если маршрут требует авторизацию, а токена нет → редирект на логин с сохранением пути
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // 3. Если маршрут требует роль Admin → проверяем payload токена
  if (to.meta.requiresAdmin && isAuthenticated) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const roles =
        payload?.role ||
        payload?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        []

      const isAdmin = Array.isArray(roles) ? roles.includes('Admin') : roles === 'Admin'

      if (!isAdmin) {
        console.warn('Доступ запрещен: недостаточно прав')
        return '/'
      }
    } catch (error) {
      console.error('Ошибка парсинга токена при проверке прав:', error)
      localStorage.removeItem('token')
      return '/login'
    }
  }

  // Если ничего не возвращаем — переход разрешается автоматически
})

// Pinia подключается в main.js раньше роутера, поэтому стор здесь уже доступен
router.afterEach((to) => {
  usePageStore().setRouteTitle(to.meta.title)
})

export default router

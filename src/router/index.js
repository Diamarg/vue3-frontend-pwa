import { createRouter, createWebHistory } from 'vue-router'
import AdminPanelPage from '@/pages/AdminPanelPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import ProjectsPage from '@/pages/ProjectsPage.vue'
import GalleryPage from '@/pages/GalleryPage.vue'
import AssembliesPage from '@/pages/AssembliesPage.vue'
import FilesPage from '@/pages/FilesPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/admin', component: AdminPanelPage, meta: { guest: false, requiresAuth: true } },
    { path: '/login', component: LoginPage, meta: { guest: true } },
    { path: '/register', component: RegisterPage, meta: { guest: true } },
    { path: '/', component: ProjectsPage, props: true, meta: { requiresAuth: true } },
    {
      path: '/:projectId/gallery',
      component: GalleryPage,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/:projectId/assemblies',
      component: AssembliesPage,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/:projectId/files',
      component: FilesPage,
      props: true,
      meta: { requiresAuth: true },
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    // 1. Восстанавливаем позицию при навигации через историю браузера
    if (savedPosition) return savedPosition

    // 2. При любом другом переходе → наверх
    return { top: 0, left: 0, behavior: 'smooth' }
  },
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const isAuthenticated = !!token

  // Если страница для гостей (login/register) и пользователь авторизован — редирект на /
  if (to.meta.guest && isAuthenticated) {
    return '/'
  }

  // Если маршрут требует авторизацию
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // Если маршрут требует роль Admin — проверяем JWT payload
  if (to.meta.requiresAdmin && isAuthenticated) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const roles = payload?.role || []
      const isAdmin = Array.isArray(roles) ? roles.includes('Admin') : roles === 'Admin'
      if (!isAdmin) {
        return '/'
      }
    } catch {
      return '/login'
    }
  }
})

export default router

<template>
  <nav class="navbar" :class="{ 'navbar--back': showBack }" aria-label="Основная навигация">
    <div class="navbar__inner">
      <button v-if="showBack" class="navbar-back" aria-label="Назад" @click="goBack">
        <svg
          class="navbar-back__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>

      <div class="navbar__identity">
        <span class="navbar__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="4" y="4" width="6" height="6" rx="1.5" />
            <rect x="14" y="4" width="6" height="6" rx="1.5" />
            <rect x="4" y="14" width="6" height="6" rx="1.5" />
            <rect x="14" y="14" width="6" height="6" rx="1.5" />
          </svg>
        </span>
        <div class="navbar__heading">
          <span class="navbar__app-name">А-Сервис</span>
          <div class="navbar-pagename" :title="pageStore.title">{{ pageStore.title }}</div>
        </div>
      </div>

      <div class="navbar-links">
        <button
          type="button"
          class="navbar__link"
          :class="{ 'navbar__link--active': route.path === '/' }"
          :aria-current="route.path === '/' ? 'page' : undefined"
          @click="goToProjects"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <path d="M3 10h18" />
          </svg>
          <span>Проекты</span>
        </button>
        <button
          type="button"
          class="navbar__link"
          :class="{ 'navbar__link--active': route.path === '/chat' }"
          :aria-current="route.path === '/chat' ? 'page' : undefined"
          @click="goToChat"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
          <span>Чат</span>
          <span v-if="chatStore.totalUnread" class="navbar__badge">
            {{ chatStore.totalUnread > 99 ? '99+' : chatStore.totalUnread }}
          </span>
        </button>
        <button
          v-if="authStore.isAdmin"
          type="button"
          class="navbar__link"
          :class="{ 'navbar__link--active': route.path.startsWith('/admin') }"
          :aria-current="route.path.startsWith('/admin') ? 'page' : undefined"
          @click="toAdminPanel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="m12 3-8 3v5.5c0 4.6 3.2 7.8 8 9.5 4.8-1.7 8-4.9 8-9.5V6Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Админка</span>
        </button>
      </div>

      <div v-if="currentUser" class="navbar-account">
        <div
          class="navbar-user"
          :class="{ 'navbar-user--admin': authStore.isAdmin }"
          :title="displayName"
        >
          <span class="navbar-user__avatar" aria-hidden="true">{{ avatarLetter }}</span>
          <span class="navbar-user__name">{{ displayName }}</span>
          <span v-if="authStore.isAdmin" class="navbar-user__role">Админ</span>
        </div>
        <button
          type="button"
          class="navbar-logout"
          title="Выйти"
          aria-label="Выйти из аккаунта"
          @click="handleLogout"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M9 5H4v14h5" />
            <path d="m14 8 4 4-4 4M8 12h10" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        class="navbar-menu-btn"
        aria-label="Меню навигации"
        aria-controls="navbar-mobile-menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <div v-if="menuOpen" class="navbar-backdrop" aria-hidden="true" @click="closeMenu"></div>
    <Transition name="navbar-menu">
      <div v-if="menuOpen" id="navbar-mobile-menu" class="navbar-menu">
        <div
          v-if="currentUser"
          class="navbar-menu__user"
          :class="{ 'navbar-menu__user--admin': authStore.isAdmin }"
        >
          <span class="navbar-menu__avatar" aria-hidden="true">{{ avatarLetter }}</span>
          <div class="navbar-menu__user-info">
            <span class="navbar-menu__user-name">{{ displayName }}</span>
            <span v-if="authStore.isAdmin" class="navbar-menu__user-role">Администратор</span>
          </div>
        </div>
        <button type="button" class="navbar-menu__item" @click="goToProjects">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            <path d="M3 10h18" />
          </svg>
          <span>Проекты</span>
        </button>
        <button type="button" class="navbar-menu__item" @click="goToChat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
          <span>Чат</span>
          <span v-if="chatStore.totalUnread" class="navbar__badge navbar__badge--menu">
            {{ chatStore.totalUnread > 99 ? '99+' : chatStore.totalUnread }}
          </span>
        </button>
        <button
          v-if="authStore.isAdmin"
          type="button"
          class="navbar-menu__item"
          @click="toAdminPanel"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="m12 3-8 3v5.5c0 4.6 3.2 7.8 8 9.5 4.8-1.7 8-4.9 8-9.5V6Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span>Админка</span>
        </button>
        <button
          type="button"
          class="navbar-menu__item navbar-menu__item--danger"
          @click="handleLogout"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M9 5H4v14h5" />
            <path d="m14 8 4 4-4 4M8 12h10" />
          </svg>
          <span>Выйти</span>
        </button>
      </div>
    </Transition>
  </nav>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { usePageStore } from '@/stores/pages'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const chatStore = useChatStore()
const toast = useToast()
const pageStore = usePageStore()

const menuOpen = ref(false)
const currentUser = computed(() => authStore.user)
const displayName = computed(
  () => currentUser.value?.fullName || currentUser.value?.userName || 'Пользователь',
)
const avatarLetter = computed(() => displayName.value.trim().charAt(0).toUpperCase() || 'П')
const showBack = computed(() => route.path !== '/')

const closeMenu = () => {
  menuOpen.value = false
}

const goBack = () => {
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

const goToChat = () => {
  closeMenu()
  router.push('/chat')
}

const toAdminPanel = () => {
  closeMenu()
  router.push('/admin')
}

const handleLogout = () => {
  closeMenu()
  const userName = authStore.user?.userName || 'Пользователь'
  const fullName = authStore.user?.fullName || ''

  toast.info(`${fullName} (${userName}) выходит из системы`)
  authStore.logout()
  router.push('/login')
}

watch(() => route.fullPath, closeMenu)
</script>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 120;
  height: var(--navbar-height);
  padding: 0;
  background: #fff;
}

.navbar__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px));
  border: 0;
  border-bottom: 1px solid rgb(230, 230, 230);
  border-radius: 0;
  background: linear-gradient(135deg, #fff 0%, #fff 70%, #f5f3ff 100%);
  box-shadow: 0 4px 20px -14px rgba(34, 60, 80, 0.28);
}

.navbar-back,
.navbar-menu-btn,
.navbar-logout {
  display: grid;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}

.navbar-back svg,
.navbar-menu-btn svg,
.navbar-logout svg {
  width: 18px;
  height: 18px;
}

.navbar__identity {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.navbar__logo {
  display: grid;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid #e0e7ff;
  border-radius: 10px;
  background: #eef2ff;
  color: #4f46e5;
}

.navbar__logo svg {
  width: 19px;
  height: 19px;
}

.navbar__heading {
  min-width: 0;
}

.navbar__app-name {
  display: block;
  margin-bottom: 1px;
  color: #8a8f98;
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.navbar-pagename {
  min-width: 0;
  overflow: hidden;
  color: #2d3748;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-links,
.navbar-account {
  display: none;
}

.navbar-menu-btn {
  margin-left: auto;
}

.navbar__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}

.navbar__link svg {
  width: 16px;
  height: 16px;
}

.navbar__link--active {
  border-color: #e0e7ff;
  background: #eef2ff;
  color: #4f46e5;
}

.navbar__badge {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: #4f46e5;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.navbar__badge--menu {
  margin-left: auto;
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 260px;
  height: 36px;
  padding: 3px 10px 3px 3px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
}

.navbar-user__avatar,
.navbar-menu__avatar {
  display: grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 600;
}

.navbar-user--admin .navbar-user__avatar,
.navbar-menu__user--admin .navbar-menu__avatar {
  background: #fff7ed;
  color: #c2410c;
}

.navbar-user__name {
  min-width: 0;
  overflow: hidden;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-user__role {
  flex: 0 0 auto;
  padding: 2px 5px;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 9px;
  font-weight: 600;
}

.navbar-logout:hover {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.navbar-back:focus-visible,
.navbar-menu-btn:focus-visible,
.navbar-logout:focus-visible,
.navbar__link:focus-visible,
.navbar-menu__item:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}

.navbar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
}

.navbar-menu {
  position: absolute;
  top: calc(100% - 4px);
  right: 16px;
  z-index: 160;
  display: grid;
  gap: 3px;
  width: min(260px, calc(100vw - 32px));
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 4px 4px 30px -10px rgba(34, 60, 80, 0.35);
}

.navbar-menu-enter-active,
.navbar-menu-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.navbar-menu-enter-from,
.navbar-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.navbar-menu__user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-bottom: 4px;
  padding: 8px 10px 12px;
  border-bottom: 1px solid #f0f1f3;
}

.navbar-menu__avatar {
  flex-basis: 34px;
  width: 34px;
  height: 34px;
  font-size: 14px;
}

.navbar-menu__user-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.navbar-menu__user-name {
  overflow: hidden;
  color: #374151;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar-menu__user-role {
  color: #c2410c;
  font-size: 11px;
}

.navbar-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #4b5563;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.2s,
    color 0.2s;
}

.navbar-menu__item svg {
  width: 18px;
  height: 18px;
  color: #818cf8;
}

.navbar-menu__item:hover {
  background: #f5f3ff;
  color: #4f46e5;
}

.navbar-menu__item--danger,
.navbar-menu__item--danger svg {
  color: #b91c1c;
}

.navbar-menu__item--danger:hover {
  background: #fef2f2;
}

@media (hover: hover) {
  .navbar-back:hover,
  .navbar-menu-btn:hover {
    border-color: #c7d2fe;
    background: #f5f3ff;
    color: #4f46e5;
  }

  .navbar__link:hover {
    background: #f5f3ff;
    color: #4f46e5;
  }
}

@media (min-width: 900px) {
  .navbar__inner {
    gap: 16px;
    padding-left: max(24px, env(safe-area-inset-left, 0px));
    padding-right: max(24px, env(safe-area-inset-right, 0px));
  }

  .navbar-pagename {
    font-size: 16px;
  }

  .navbar__app-name {
    font-size: 10px;
  }

  .navbar-links {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;
  }

  .navbar-account {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .navbar-menu-btn,
  .navbar-menu,
  .navbar-backdrop {
    display: none;
  }
}

@media (min-width: 900px) and (max-width: 1100px) {
  .navbar-user__role {
    display: none;
  }
}

@media (max-width: 480px) {
  .navbar__inner {
    gap: 9px;
  }

  .navbar__identity {
    gap: 8px;
  }

  .navbar__logo {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
  }

  .navbar__logo svg {
    width: 17px;
    height: 17px;
  }

  .navbar__app-name {
    font-size: 8px;
  }

  .navbar-pagename {
    font-size: 14px;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .navbar__inner {
    gap: 8px;
    padding-left: max(12px, env(safe-area-inset-left, 0px));
    padding-right: max(12px, env(safe-area-inset-right, 0px));
  }

  .navbar__identity {
    gap: 8px;
  }

  .navbar__logo {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .navbar__logo svg {
    width: 17px;
    height: 17px;
  }

  .navbar__app-name {
    display: none;
  }

  .navbar-pagename {
    font-size: 14px;
  }

  .navbar-menu {
    right: max(12px, env(safe-area-inset-right, 0px));
    max-height: calc(100dvh - var(--navbar-height) - env(safe-area-inset-bottom, 0px) - 8px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .navbar-menu__user {
    margin-bottom: 2px;
    padding-bottom: 8px;
  }

  .navbar-menu__avatar {
    flex-basis: 30px;
    width: 30px;
    height: 30px;
  }

  .navbar-menu__item {
    min-height: 40px;
    padding: 8px 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .navbar-back,
  .navbar-menu-btn,
  .navbar-logout,
  .navbar__link,
  .navbar-menu__item,
  .navbar-menu-enter-active,
  .navbar-menu-leave-active {
    transition: none;
  }
}
</style>

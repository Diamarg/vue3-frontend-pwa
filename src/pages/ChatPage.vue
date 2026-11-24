<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'

const chat = useChatStore()
const mobilePanel = ref('messages')
const draft = ref('')
const messageViewport = ref(null)
const composer = ref(null)
const stickToBottom = ref(true)

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
})
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const selectedConversation = computed(() =>
  chat.conversations.find((conversation) => conversation.peerId === chat.currentPeerId),
)
const selectedUser = computed(() => {
  if (!chat.currentPeerId) return null
  return (
    chat.users.find((user) => user.id === chat.currentPeerId) || {
      id: chat.currentPeerId,
      fullName: selectedConversation.value?.peerName || 'Пользователь',
      userName: selectedConversation.value?.peerUserName || '',
      isOnline: selectedConversation.value?.peerIsOnline || false,
      isOnChatPage: selectedConversation.value?.peerIsOnChatPage || false,
    }
  )
})
const currentTitle = computed(() => selectedUser.value?.fullName || 'Общий чат')
const currentStatus = computed(() => {
  if (!selectedUser.value) return 'Сообщения для всех пользователей'
  if (selectedUser.value.isOnChatPage) return 'В приложении · на странице чата'
  if (selectedUser.value.isOnline) return 'Сейчас в приложении'
  return 'Не в сети'
})
const currentAvatar = computed(() =>
  selectedUser.value
    ? avatarLetter(selectedUser.value.fullName || selectedUser.value.userName)
    : '#',
)
const onlineDirectoryUsers = computed(() =>
  chat.sortedUsers.filter((user) => user.isOnline || user.isOnChatPage),
)
const canSend = computed(() => Boolean(draft.value.trim()) && !chat.sending)
const connectionLabel = computed(() => {
  if (chat.connected) return 'Онлайн'
  if (chat.connecting) return 'Подключение…'
  return 'Переподключение…'
})

const avatarLetter = (name) => name?.trim().charAt(0).toUpperCase() || 'П'
const formatTime = (value) => timeFormatter.format(new Date(value))
const formatDate = (value) => dateFormatter.format(new Date(value))
const isOwnMessage = (message) => message.senderId === chat.currentUserId
const showDateSeparator = (message, index) => {
  if (index === 0) return true
  const current = new Date(message.createdAt)
  const previous = new Date(chat.messages[index - 1].createdAt)
  return current.toDateString() !== previous.toDateString()
}

const scrollToBottom = (behavior = 'smooth') => {
  nextTick(() => {
    const viewport = messageViewport.value
    if (!viewport) return
    viewport.scrollTo({ top: viewport.scrollHeight, behavior })
    stickToBottom.value = true
  })
}

const handleViewportScroll = () => {
  const viewport = messageViewport.value
  if (!viewport) return
  stickToBottom.value = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100
}

const openGeneralChat = async () => {
  await chat.selectConversation(null)
  mobilePanel.value = 'messages'
  scrollToBottom('auto')
}

const openPrivateChat = async (userId) => {
  await chat.selectConversation(userId)
  mobilePanel.value = 'messages'
  scrollToBottom('auto')
}

const loadEarlier = async () => {
  const viewport = messageViewport.value
  if (!viewport) return
  const previousHeight = viewport.scrollHeight
  const previousTop = viewport.scrollTop
  const loaded = await chat.loadEarlier()
  if (!loaded) return
  await nextTick()
  viewport.scrollTop = previousTop + viewport.scrollHeight - previousHeight
}

const resizeComposer = () => {
  const element = composer.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(element.scrollHeight, 140)}px`
}

const submitMessage = async () => {
  const text = draft.value
  try {
    const sent = await chat.sendMessage(text)
    if (!sent) return
    draft.value = ''
    resizeComposer()
    stickToBottom.value = true
    scrollToBottom('smooth')
    composer.value?.focus()
  } catch {
    return
  }
}

const handleComposerKeydown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submitMessage()
  }
}

const retryLoading = async () => {
  await chat.refresh().catch(() => {})
  if (chat.hasActiveConversation) {
    await chat.selectConversation(chat.currentPeerId)
  }
}

watch(
  () => chat.messages.at(-1)?.id,
  () => {
    if (stickToBottom.value) scrollToBottom('auto')
  },
)

watch(
  () => chat.currentPeerId,
  () => {
    stickToBottom.value = true
  },
)

onMounted(async () => {
  chat.primeNotificationSound()
  await chat.setChatPage(true)
  await openGeneralChat()
})

onBeforeUnmount(() => {
  chat.setChatPage(false)
})
</script>

<template>
  <main class="chat-page">
    <div class="chat-shell">
      <nav class="chat-mobile-tabs" aria-label="Разделы чата">
        <button
          type="button"
          :class="{ 'is-active': mobilePanel === 'chats' }"
          @click="mobilePanel = 'chats'"
        >
          <span class="chat-tab-label">Чаты</span>
          <span v-if="chat.totalUnread" class="chat-tab-badge">{{ chat.totalUnread }}</span>
        </button>
        <button
          type="button"
          :class="{ 'is-active': mobilePanel === 'messages' }"
          @click="mobilePanel = 'messages'"
        >
          <span class="chat-tab-label">Сообщения</span>
        </button>
        <button
          type="button"
          :class="{ 'is-active': mobilePanel === 'users' }"
          @click="mobilePanel = 'users'"
        >
          <span class="chat-tab-label">Пользователи</span>
          <span class="chat-tab-count">{{ onlineDirectoryUsers.length }}</span>
        </button>
      </nav>

      <aside
        class="chat-panel chat-conversations"
        :class="{ 'chat-panel--mobile-active': mobilePanel === 'chats' }"
        aria-label="Список чатов"
      >
        <header class="chat-panel__header">
          <div>
            <h1>Чаты</h1>
            <p>Общий и личные сообщения</p>
          </div>
          <span v-if="chat.totalUnread" class="chat-unread-badge">{{ chat.totalUnread }}</span>
        </header>

        <div class="chat-conversations__scroll">
          <button
            type="button"
            class="chat-general-button"
            :class="{ 'is-active': chat.currentPeerId === null }"
            @click="openGeneralChat"
          >
            <span class="chat-avatar chat-avatar--general" aria-hidden="true">#</span>
            <span class="chat-general-button__text">
              <strong>Общий чат</strong>
              <small>Для всех пользователей</small>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div class="chat-list-label">Личные сообщения</div>
          <div v-if="chat.loadingConversations" class="chat-panel__empty">Загружаем диалоги…</div>
          <div v-else-if="!chat.sortedConversations.length" class="chat-panel__empty">
            Выберите пользователя справа, чтобы начать диалог.
          </div>
          <div v-else class="chat-conversation-list">
            <button
              v-for="conversation in chat.sortedConversations"
              :key="conversation.peerId"
              type="button"
              class="chat-conversation"
              :class="{ 'is-active': chat.currentPeerId === conversation.peerId }"
              @click="openPrivateChat(conversation.peerId)"
            >
              <span class="chat-avatar" aria-hidden="true">
                {{ avatarLetter(conversation.peerName) }}
                <i v-if="conversation.peerIsOnline" class="chat-status-dot"></i>
              </span>
              <span class="chat-conversation__content">
                <span class="chat-conversation__top">
                  <strong>{{ conversation.peerName }}</strong>
                  <small v-if="conversation.lastMessage">{{
                    formatTime(conversation.lastMessage.createdAt)
                  }}</small>
                </span>
                <span class="chat-conversation__preview">{{ conversation.lastMessage?.text }}</span>
              </span>
              <span v-if="conversation.unreadCount" class="chat-conversation__unread">
                {{ conversation.unreadCount }}
              </span>
            </button>
          </div>
        </div>
      </aside>

      <section
        class="chat-panel chat-thread"
        :class="{ 'chat-panel--mobile-active': mobilePanel === 'messages' }"
        aria-label="Текущий чат"
      >
        <header class="chat-thread__header">
          <button
            type="button"
            class="chat-icon-button chat-thread__mobile-back"
            aria-label="К списку чатов"
            @click="mobilePanel = 'chats'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span
            class="chat-avatar chat-avatar--header"
            :class="{ 'chat-avatar--general': !selectedUser }"
          >
            {{ currentAvatar }}
            <i v-if="selectedUser?.isOnline" class="chat-status-dot"></i>
          </span>
          <div class="chat-thread__title">
            <h2>{{ currentTitle }}</h2>
            <p>{{ currentStatus }}</p>
          </div>
          <span class="chat-connection" :class="{ 'is-offline': !chat.connected }">
            <i></i>{{ connectionLabel }}
          </span>
          <button
            type="button"
            class="chat-icon-button chat-thread__mobile-users"
            aria-label="К списку пользователей"
            @click="mobilePanel = 'users'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        </header>

        <div v-if="chat.error" class="chat-error" role="alert">
          <span>{{ chat.error }}</span>
          <button type="button" @click="retryLoading">Повторить</button>
        </div>

        <div
          ref="messageViewport"
          class="chat-messages"
          role="log"
          aria-live="polite"
          @scroll="handleViewportScroll"
        >
          <div v-if="chat.hasMore" class="chat-load-earlier">
            <button type="button" :disabled="chat.loadingMessages" @click="loadEarlier">
              {{ chat.loadingMessages ? 'Загружаем…' : 'Показать ранние сообщения' }}
            </button>
          </div>

          <div v-if="chat.loadingMessages && !chat.messages.length" class="chat-thread__empty">
            <span class="chat-spinner" aria-hidden="true"></span>
            Загружаем сообщения…
          </div>
          <div v-else-if="!chat.messages.length" class="chat-thread__empty">
            <span class="chat-thread__empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
                <path d="M8 9h8M8 13h5" />
              </svg>
            </span>
            <strong>Пока нет сообщений</strong>
            <span>Напишите первым — история сохранится в базе данных.</span>
          </div>

          <template v-else>
            <div
              v-for="(message, index) in chat.messages"
              :key="message.id"
              class="chat-message-group"
            >
              <div v-if="showDateSeparator(message, index)" class="chat-date-separator">
                {{ formatDate(message.createdAt) }}
              </div>
              <article class="chat-message" :class="{ 'chat-message--own': isOwnMessage(message) }">
                <div class="chat-message__bubble">
                  <span
                    v-if="!isOwnMessage(message) && (!selectedUser || !message.recipientId)"
                    class="chat-message__sender"
                  >
                    {{ message.senderName }}
                  </span>
                  <span class="chat-message__text">{{ message.text }}</span>
                  <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
                </div>
              </article>
            </div>
          </template>
        </div>

        <form class="chat-composer" @submit.prevent="submitMessage">
          <textarea
            ref="composer"
            v-model="draft"
            rows="1"
            maxlength="2000"
            :placeholder="
              selectedUser
                ? `Сообщение для ${selectedUser.fullName || selectedUser.userName}`
                : 'Сообщение в общий чат'
            "
            aria-label="Текст сообщения"
            @input="resizeComposer"
            @keydown="handleComposerKeydown"
          ></textarea>
          <button
            type="submit"
            class="chat-send-button"
            :disabled="!canSend"
            aria-label="Отправить сообщение"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
          <span class="chat-composer__hint">Enter — отправить · Shift + Enter — новая строка</span>
        </form>
      </section>

      <aside
        class="chat-panel chat-users"
        :class="{ 'chat-panel--mobile-active': mobilePanel === 'users' }"
        aria-label="Пользователи"
      >
        <header class="chat-panel__header">
          <div>
            <h2>Пользователи</h2>
            <p>{{ onlineDirectoryUsers.length }} сейчас в приложении</p>
          </div>
          <span class="chat-online-count">{{ onlineDirectoryUsers.length }}</span>
        </header>

        <div class="chat-users__scroll">
          <div class="chat-list-label chat-list-label--online"><i></i> Сейчас в приложении</div>
          <div v-if="!onlineDirectoryUsers.length" class="chat-panel__empty">Никого нет в сети</div>
          <div v-else class="chat-user-list">
            <button
              v-for="user in onlineDirectoryUsers"
              :key="user.id"
              type="button"
              class="chat-user"
              :class="{ 'chat-user--on-chat': user.isOnChatPage }"
              @click="openPrivateChat(user.id)"
            >
              <span class="chat-avatar" aria-hidden="true">
                {{ avatarLetter(user.fullName || user.userName) }}
                <i class="chat-status-dot"></i>
              </span>
              <span class="chat-user__content">
                <strong>{{ user.fullName || user.userName }}</strong>
                <span v-if="user.isOnChatPage" class="chat-user__chat-badge">на странице чата</span>
              </span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.chat-page {
  height: calc(100vh - var(--navbar-height));
  height: calc(100dvh - var(--navbar-height));
  min-height: 0;
  padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
    max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
  overflow: hidden;
  background: #f8fafc;
}

.chat-shell {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 280px;
  width: min(100%, 1500px);
  height: 100%;
  margin-inline: auto;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 45px -30px rgba(30, 41, 59, 0.45);
}

.chat-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.chat-conversations,
.chat-users {
  border-right: 1px solid #e5e7eb;
  background: #fff;
}

.chat-users {
  border-right: 0;
  border-left: 1px solid #e5e7eb;
}

.chat-panel__header,
.chat-thread__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  min-height: 72px;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #fff 0%, #fff 70%, #f5f3ff 100%);
}

.chat-panel__header h1,
.chat-panel__header h2,
.chat-thread__title h2 {
  margin: 0;
  color: #2d3748;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.chat-panel__header p,
.chat-thread__title p {
  margin: 4px 0 0;
  overflow: hidden;
  color: #8a8f98;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-unread-badge,
.chat-online-count,
.chat-tab-badge,
.chat-tab-count {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.chat-conversations__scroll,
.chat-users__scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px;
}

.chat-general-button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 11px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #4b5563;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.chat-general-button:hover,
.chat-general-button.is-active {
  border-color: #e0e7ff;
  background: #eef2ff;
  color: #4338ca;
}

.chat-general-button > svg,
.chat-user > svg {
  width: 16px;
  height: 16px;
  margin-left: auto;
  color: #a5aab4;
}

.chat-general-button__text {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.chat-general-button__text strong {
  font-size: 14px;
  font-weight: 600;
}

.chat-general-button__text small {
  color: #8a8f98;
  font-size: 11px;
}

.chat-avatar {
  position: relative;
  display: inline-grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
}

.chat-avatar--general {
  background: #ecfdf5;
  color: #047857;
  font-size: 20px;
}

.chat-avatar--header {
  flex-basis: 40px;
  width: 40px;
  height: 40px;
}

.chat-status-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #22c55e;
}

.chat-list-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 18px 6px 8px;
  color: #9ca3af;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chat-list-label--online i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
}

.chat-panel__empty {
  padding: 18px 10px;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.chat-conversation-list,
.chat-user-list {
  display: grid;
  gap: 4px;
}

.chat-conversation,
.chat-user {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #4b5563;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.chat-conversation:hover,
.chat-conversation.is-active,
.chat-user:hover {
  border-color: #e0e7ff;
  background: #f5f3ff;
}

.chat-conversation__content,
.chat-user__content {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
}

.chat-conversation__top {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.chat-conversation__top strong,
.chat-user__content strong {
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-conversation__top small {
  margin-left: auto;
  color: #a1a5ad;
  font-size: 10px;
}

.chat-conversation__preview {
  overflow: hidden;
  color: #8a8f98;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-conversation__unread {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: #4f46e5;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.chat-thread {
  position: relative;
  background: #f8fafc;
}

.chat-thread__header {
  min-height: 72px;
  background: #fff;
}

.chat-thread__title {
  min-width: 0;
  flex: 1;
}

.chat-connection {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  color: #15803d;
  font-size: 11px;
  white-space: nowrap;
}

.chat-connection i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
}

.chat-connection.is-offline {
  color: #b45309;
}

.chat-connection.is-offline i {
  background: #f59e0b;
}

.chat-icon-button {
  display: inline-grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
}

.chat-icon-button svg {
  width: 17px;
  height: 17px;
}

.chat-thread__mobile-back,
.chat-thread__mobile-users,
.chat-mobile-tabs {
  display: none;
}

.chat-error {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 16px;
  border-bottom: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12px;
}

.chat-error button {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 6px;
  background: #fff;
  color: #b91c1c;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.chat-messages {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px 20px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
}

.chat-load-earlier {
  display: flex;
  justify-content: center;
}

.chat-load-earlier button {
  padding: 7px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6366f1;
  font-size: 12px;
  cursor: pointer;
}

.chat-load-earlier button:disabled {
  opacity: 0.6;
  cursor: default;
}

.chat-thread__empty {
  display: grid;
  min-height: 220px;
  place-content: center;
  justify-items: center;
  gap: 9px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

.chat-thread__empty strong {
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
}

.chat-thread__empty-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  margin-bottom: 4px;
  border-radius: 16px;
  background: #eef2ff;
  color: #818cf8;
}

.chat-thread__empty-icon svg {
  width: 26px;
  height: 26px;
}

.chat-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e0e7ff;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: chat-spin 0.8s linear infinite;
}

.chat-date-separator {
  align-self: center;
  margin: 8px 0 2px;
  padding: 5px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #94a3b8;
  font-size: 10px;
}

.chat-message-group {
  display: contents;
}

.chat-message {
  display: flex;
  max-width: 78%;
  align-self: flex-start;
}

.chat-message--own {
  align-self: flex-end;
}

.chat-message__bubble {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px 12px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px 14px 14px 14px;
  background: #fff;
  box-shadow: 0 4px 12px -12px rgba(30, 41, 59, 0.5);
}

.chat-message--own .chat-message__bubble {
  border-color: #4f46e5;
  border-radius: 14px 4px 14px 14px;
  background: #4f46e5;
  color: #fff;
}

.chat-message__sender {
  color: #6366f1;
  font-size: 11px;
  font-weight: 600;
}

.chat-message__text {
  color: #374151;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.chat-message--own .chat-message__text {
  color: #fff;
}

.chat-message__bubble time {
  justify-self: end;
  color: #a1a5ad;
  font-size: 9px;
}

.chat-message--own .chat-message__bubble time {
  color: rgba(255, 255, 255, 0.7);
}

.chat-composer {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px 26px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.chat-composer textarea {
  min-height: 42px;
  max-height: 140px;
  flex: 1;
  padding: 11px 12px;
  overflow-y: auto;
  border: 1px solid #dfe3e8;
  border-radius: 10px;
  outline: none;
  background: #f8fafc;
  color: #374151;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  resize: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.chat-composer textarea:focus {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.chat-composer textarea::placeholder {
  color: #a1a5ad;
}

.chat-send-button {
  display: grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  place-items: center;
  padding: 0;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  cursor: pointer;
  transition:
    background 0.2s,
    opacity 0.2s,
    transform 0.2s;
}

.chat-send-button svg {
  width: 19px;
  height: 19px;
}

.chat-send-button:hover:not(:disabled) {
  background: #4338ca;
  transform: translateY(-1px);
}

.chat-send-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.chat-composer__hint {
  position: absolute;
  right: 70px;
  bottom: 7px;
  color: #b0b5bd;
  font-size: 9px;
}

.chat-user--on-chat {
  border-color: #dbeafe;
  background: #eff6ff;
}

.chat-user__chat-badge {
  width: fit-content;
  margin-top: 2px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 9px;
  font-weight: 600;
}

@keyframes chat-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .chat-shell {
    grid-template-columns: 230px minmax(0, 1fr) 240px;
  }

  .chat-connection {
    display: none;
  }
}

@media (max-width: 1020px) {
  .chat-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .chat-mobile-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-height: 44px;
    border-bottom: 1px solid #e5e7eb;
    background: #fff;
  }

  .chat-mobile-tabs button {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 6px;
    overflow: hidden;
    padding: 0 8px;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: #8a8f98;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }

  .chat-tab-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-mobile-tabs button.is-active {
    border-bottom-color: #6366f1;
    color: #4f46e5;
  }

  .chat-tab-badge,
  .chat-tab-count {
    min-width: 18px;
    height: 18px;
    margin-left: 0;
    padding: 0 5px;
    font-size: 9px;
  }

  .chat-panel {
    display: none;
  }

  .chat-panel--mobile-active {
    display: flex;
    min-height: 0;
    flex: 1;
  }

  .chat-conversations,
  .chat-users {
    border: 0;
  }

  .chat-thread__mobile-back,
  .chat-thread__mobile-users {
    display: inline-grid;
  }

  .chat-thread__title p {
    max-width: 240px;
  }
}

@media (max-width: 600px) {
  .chat-page {
    padding: 0;
  }

  .chat-shell {
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .chat-panel__header,
  .chat-thread__header {
    min-height: 62px;
    padding: 10px 12px;
  }

  .chat-thread__title h2 {
    font-size: 15px;
  }

  .chat-thread__title p {
    max-width: 190px;
    font-size: 10px;
  }

  .chat-mobile-tabs button {
    gap: 4px;
    padding-inline: 4px;
    font-size: 12px;
  }

  .chat-tab-badge,
  .chat-tab-count {
    flex: 0 0 auto;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
  }

  .chat-messages {
    padding: 12px;
  }

  .chat-message {
    max-width: 88%;
  }

  .chat-composer {
    padding: 10px 12px calc(24px + env(safe-area-inset-bottom, 0px));
  }

  .chat-composer__hint {
    right: 64px;
    bottom: calc(7px + env(safe-area-inset-bottom, 0px));
  }

  .chat-conversations__scroll,
  .chat-users__scroll {
    padding: 10px;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .chat-page {
    padding: 6px max(6px, env(safe-area-inset-right, 0px))
      max(6px, env(safe-area-inset-bottom, 0px)) max(6px, env(safe-area-inset-left, 0px));
  }

  .chat-shell {
    border-radius: 10px;
  }

  .chat-mobile-tabs {
    min-height: 38px;
  }

  .chat-panel__header,
  .chat-thread__header {
    min-height: 56px;
    padding: 8px 12px;
  }

  .chat-composer {
    padding: 8px 12px 20px;
  }

  .chat-composer textarea {
    min-height: 36px;
    padding: 8px 10px;
  }

  .chat-send-button {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-spinner {
    animation: none;
  }

  .chat-send-button,
  .chat-conversation,
  .chat-user,
  .chat-general-button {
    transition: none;
  }
}
</style>

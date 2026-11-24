import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import {
  getChatConversations,
  getChatMessages,
  getChatUsers,
  markChatRead as markChatReadRequest,
  sendChatMessage as sendChatMessageRequest,
} from '@/api/chat'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from './auth'

const PAGE_SIZE = 50
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://178.72.171.164:7011/api'
const hubUrl = `${apiBaseUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/chat/hub`

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore()
  const toast = useToast()

  const users = ref([])
  const onlineUsers = ref([])
  const conversations = ref([])
  const messages = ref([])
  const currentPeerId = ref(null)
  const hasActiveConversation = ref(false)
  const isOnChatPage = ref(false)
  const connected = ref(false)
  const connecting = ref(false)
  const loadingUsers = ref(false)
  const loadingConversations = ref(false)
  const loadingMessages = ref(false)
  const sending = ref(false)
  const hasMore = ref(false)
  const error = ref('')

  let connection = null
  let connectPromise = null
  let messageLoadSequence = 0
  let audioContext = null
  let audioPrimeHandler = null

  const currentUserId = computed(() => authStore.user?.id || null)
  const totalUnread = computed(() =>
    conversations.value.reduce((total, conversation) => total + conversation.unreadCount, 0),
  )
  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => (b.lastMessage?.id || 0) - (a.lastMessage?.id || 0)),
  )
  const sortedUsers = computed(() =>
    [...users.value].sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1
      if (a.isOnChatPage !== b.isOnChatPage) return a.isOnChatPage ? -1 : 1
      return (a.fullName || a.userName).localeCompare(b.fullName || b.userName, 'ru')
    }),
  )
  const oldestMessageId = computed(() => messages.value[0]?.id || null)

  const applyPresence = (presence) => {
    onlineUsers.value = presence
    const presenceById = new Map(presence.map((user) => [user.id, user]))

    users.value = users.value.map((user) => {
      const state = presenceById.get(user.id)
      return {
        ...user,
        isOnline: Boolean(state),
        isOnChatPage: Boolean(state?.isOnChatPage),
      }
    })

    conversations.value = conversations.value.map((conversation) => {
      const state = presenceById.get(conversation.peerId)
      return {
        ...conversation,
        peerIsOnline: Boolean(state),
        peerIsOnChatPage: Boolean(state?.isOnChatPage),
      }
    })
  }

  const handlePresence = (presence) => {
    applyPresence(presence || [])
  }

  const upsertMessage = (message) => {
    if (messages.value.some((item) => item.id === message.id)) return
    messages.value = [...messages.value, message].sort((a, b) => a.id - b.id)
  }

  const updateConversation = (message) => {
    if (!message.recipientId || !currentUserId.value) return

    const isOutgoing = message.senderId === currentUserId.value
    const peerId = isOutgoing ? message.recipientId : message.senderId
    const peerName = isOutgoing ? message.recipientName : message.senderName
    const existing = conversations.value.find((conversation) => conversation.peerId === peerId)
    const peerFromUsers = users.value.find((user) => user.id === peerId)
    const peerFromPresence = onlineUsers.value.find((user) => user.id === peerId)

    if (existing) {
      existing.lastMessage = message
      existing.peerName = peerName || existing.peerName
      existing.peerIsOnline = Boolean(peerFromPresence)
      existing.peerIsOnChatPage = Boolean(peerFromPresence?.isOnChatPage)
      return
    }

    conversations.value.unshift({
      peerId,
      peerName: peerName || peerFromUsers?.fullName || peerFromUsers?.userName || 'Пользователь',
      peerUserName: peerFromUsers?.userName || '',
      lastMessage: message,
      unreadCount: 0,
      peerIsOnline: Boolean(peerFromPresence),
      peerIsOnChatPage: Boolean(peerFromPresence?.isOnChatPage),
    })
  }

  const ensureAudioContext = () => {
    if (typeof window === 'undefined') return null
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    if (!audioContext) audioContext = new AudioContextClass()
    return audioContext
  }

  const playNotificationSound = () => {
    const context = ensureAudioContext()
    if (!context) return

    const emitTone = () => {
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(740, now)
      oscillator.frequency.setValueAtTime(880, now + 0.08)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.21)
    }

    if (context.state === 'suspended') {
      context
        .resume()
        .then(emitTone)
        .catch(() => {})
    } else {
      emitTone()
    }
  }

  const notifyIncomingMessage = (message) => {
    toast.info(`Новое сообщение от ${message.senderName}`)
    if (typeof document !== 'undefined' && document.hidden) {
      playNotificationSound()
    }
  }

  const handleUnread = (state) => {
    const conversation = conversations.value.find((item) => item.peerId === state.peerId)
    if (conversation) conversation.unreadCount = Math.max(0, state.unreadCount)
  }

  const handleMessage = (message) => {
    const isPrivate = Boolean(message.recipientId)
    const isIncoming =
      isPrivate &&
      message.recipientId === currentUserId.value &&
      message.senderId !== currentUserId.value
    const isActivelyReading =
      isIncoming &&
      isOnChatPage.value &&
      currentPeerId.value === message.senderId &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible'

    if (isPrivate) updateConversation(message)

    const belongsToActiveConversation =
      hasActiveConversation.value &&
      isOnChatPage.value &&
      (isPrivate
        ? currentPeerId.value === message.senderId ||
          (message.senderId === currentUserId.value && currentPeerId.value === message.recipientId)
        : currentPeerId.value === null)

    if (belongsToActiveConversation || isActivelyReading) upsertMessage(message)

    if (isIncoming) {
      if (isActivelyReading) {
        markChatRead(message.senderId, message.id).catch(() => {})
      } else {
        const conversation = conversations.value.find((item) => item.peerId === message.senderId)
        if (conversation) conversation.unreadCount += 1
        notifyIncomingMessage(message)
      }
    }
  }

  const loadUsers = async () => {
    loadingUsers.value = true
    try {
      const { data } = await getChatUsers()
      const presenceById = new Map(onlineUsers.value.map((user) => [user.id, user]))
      users.value = data.map((user) => {
        const state = presenceById.get(user.id)
        return {
          ...user,
          isOnline: Boolean(state),
          isOnChatPage: Boolean(state?.isOnChatPage),
        }
      })
    } finally {
      loadingUsers.value = false
    }
  }

  const loadConversations = async () => {
    loadingConversations.value = true
    try {
      const { data } = await getChatConversations()
      const presenceById = new Map(onlineUsers.value.map((user) => [user.id, user]))
      conversations.value = data.map((conversation) => {
        const state = presenceById.get(conversation.peerId)
        return {
          ...conversation,
          peerIsOnline: Boolean(state),
          peerIsOnChatPage: Boolean(state?.isOnChatPage),
        }
      })
    } finally {
      loadingConversations.value = false
    }
  }

  const refresh = async () => {
    try {
      await Promise.all([loadUsers(), loadConversations()])
      error.value = ''
    } catch (requestError) {
      error.value = requestError.response?.data?.message || 'Не удалось загрузить данные чата'
      throw requestError
    }
  }

  const loadMessages = async ({ beforeId = null } = {}) => {
    const sequence = messageLoadSequence
    const peerId = currentPeerId.value
    loadingMessages.value = true

    try {
      const { data } = await getChatMessages({
        peerId: peerId || undefined,
        beforeId: beforeId || undefined,
        take: PAGE_SIZE,
      })
      if (sequence !== messageLoadSequence || peerId !== currentPeerId.value) return

      messages.value = beforeId
        ? [...data.items, ...messages.value].sort((a, b) => a.id - b.id)
        : data.items
      hasMore.value = data.hasMore
      error.value = ''
    } finally {
      if (sequence === messageLoadSequence) loadingMessages.value = false
    }
  }

  const selectConversation = async (peerId = null) => {
    currentPeerId.value = peerId
    hasActiveConversation.value = true
    messages.value = []
    hasMore.value = false
    error.value = ''
    messageLoadSequence += 1

    try {
      await loadMessages()
      if (peerId) await markChatRead(peerId)
    } catch (requestError) {
      error.value = requestError.response?.data?.message || 'Не удалось загрузить сообщения'
      toast.error(error.value)
    }
  }

  const loadEarlier = async () => {
    if (!hasMore.value || loadingMessages.value || !oldestMessageId.value) return false
    try {
      await loadMessages({ beforeId: oldestMessageId.value })
      return true
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Не удалось загрузить историю')
      return false
    }
  }

  const markChatRead = async (peerId, messageId = null) => {
    try {
      const { data } = await markChatReadRequest({ peerId, messageId })
      handleUnread(data)
      return data
    } catch (requestError) {
      console.error('Не удалось отметить сообщения прочитанными:', requestError)
      throw requestError
    }
  }

  const createClientMessageId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  const sendMessage = async (text) => {
    const trimmedText = text.trim()
    if (!trimmedText || sending.value || !hasActiveConversation.value) return null
    if (trimmedText.length > 2000) {
      toast.error('Сообщение не должно превышать 2000 символов')
      return null
    }

    sending.value = true
    try {
      const { data } = await sendChatMessageRequest({
        recipientId: currentPeerId.value,
        text: trimmedText,
        clientMessageId: createClientMessageId(),
      })
      updateConversation(data)
      const belongsToActiveConversation = data.recipientId
        ? currentPeerId.value === data.recipientId || currentPeerId.value === data.senderId
        : currentPeerId.value === null
      if (hasActiveConversation.value && belongsToActiveConversation) upsertMessage(data)
      return data
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'Не удалось отправить сообщение')
      throw requestError
    } finally {
      sending.value = false
    }
  }

  const startConnection = async () => {
    if (!authStore.isAuthenticated) return
    if (!authStore.user?.id) await authStore.fetchMe()

    connecting.value = true
    const nextConnection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('token'),
        withCredentials: true,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    nextConnection.on('PresenceChanged', handlePresence)
    nextConnection.on('MessageReceived', handleMessage)
    nextConnection.on('UnreadChanged', handleUnread)
    nextConnection.onreconnecting(() => {
      connected.value = false
    })
    nextConnection.onreconnected(async () => {
      connected.value = true
      try {
        await nextConnection.invoke('SetChatPage', isOnChatPage.value)
        await refresh()
        if (hasActiveConversation.value) await loadMessages()
      } catch (requestError) {
        error.value = requestError.response?.data?.message || 'Не удалось восстановить чат'
      }
    })
    nextConnection.onclose(() => {
      connected.value = false
    })

    connection = nextConnection
    try {
      await nextConnection.start()
      connected.value = true
      await nextConnection.invoke('SetChatPage', isOnChatPage.value)
      await refresh()
    } catch (requestError) {
      connected.value = false
      error.value = requestError.message || 'Нет соединения с чатом'
    } finally {
      connecting.value = false
    }
  }

  const connect = () => {
    if (!authStore.isAuthenticated) return Promise.resolve()
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      return Promise.resolve()
    }
    if (!connectPromise) {
      connectPromise = startConnection().finally(() => {
        connectPromise = null
      })
    }
    return connectPromise
  }

  const setChatPage = async (active) => {
    isOnChatPage.value = active
    if (connection?.state === HubConnectionState.Connected) {
      connection.invoke('SetChatPage', active).catch(() => {})
    }
    if (active) {
      await connect()
      await refresh().catch(() => {})
    }
  }

  const resetState = () => {
    users.value = []
    onlineUsers.value = []
    conversations.value = []
    messages.value = []
    currentPeerId.value = null
    hasActiveConversation.value = false
    isOnChatPage.value = false
    hasMore.value = false
    error.value = ''
    messageLoadSequence += 1
  }

  const stop = async () => {
    const currentConnection = connection
    connection = null
    connected.value = false
    connecting.value = false
    resetState()

    if (audioPrimeHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', audioPrimeHandler)
      audioPrimeHandler = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }

    if (currentConnection) {
      currentConnection.off('PresenceChanged')
      currentConnection.off('MessageReceived')
      currentConnection.off('UnreadChanged')
      await currentConnection.stop().catch(() => {})
    }
  }

  const primeNotificationSound = () => {
    if (typeof window === 'undefined' || audioPrimeHandler) return
    audioPrimeHandler = () => ensureAudioContext()
    window.addEventListener('pointerdown', audioPrimeHandler, { once: true, passive: true })
  }

  return {
    users,
    onlineUsers,
    conversations,
    sortedConversations,
    messages,
    currentPeerId,
    hasActiveConversation,
    isOnChatPage,
    connected,
    connecting,
    loadingUsers,
    loadingConversations,
    loadingMessages,
    sending,
    hasMore,
    error,
    currentUserId,
    totalUnread,
    oldestMessageId,
    sortedUsers,
    connect,
    stop,
    refresh,
    selectConversation,
    loadEarlier,
    sendMessage,
    setChatPage,
    primeNotificationSound,
  }
})

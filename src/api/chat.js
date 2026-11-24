import { api } from '@/api'

export const getChatUsers = () => api.get('/chat/users')

export const getChatConversations = () => api.get('/chat/conversations')

export const getChatMessages = (params) => api.get('/chat/messages', { params })

export const sendChatMessage = (payload) => api.post('/chat/messages', payload)

export const markChatRead = (payload) => api.post('/chat/read', payload)

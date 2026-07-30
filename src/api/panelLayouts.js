import { api } from './index'

export const panelLayoutsApi = {
  // Получить все макеты сборки
  getByAssembly: (assemblyId) =>
    api.get(`/panellayouts/assembly/${assemblyId}`).then((res) => res.data),

  // Получить макет по ID
  getById: (id) => api.get(`/panellayouts/${id}`).then((res) => res.data),

  // Создать новый макет
  create: (data) => api.post('/panellayouts', data).then((res) => res.data),

  // Обновить макет
  update: (id, data) => api.put(`/panellayouts/${id}`, data).then((res) => res.data),

  // Удалить макет
  delete: (id) => api.delete(`/panellayouts/${id}`).then((res) => res.data),
}

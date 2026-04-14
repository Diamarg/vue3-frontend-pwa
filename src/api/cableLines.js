import { api } from './index'

export const cableLinesApi = {
  // Получить все кабельные линии
  getLines: (projectId) => api.get(`/projects/${projectId}/cable-lines`).then((res) => res.data),

  // Получить линию по ID
  getLine: (projectId, lineId) =>
    api.get(`/projects/${projectId}/cable-lines/${lineId}`).then((res) => res.data),

  // Создать линию
  createLine: (projectId, data) =>
    api.post(`/projects/${projectId}/cable-lines`, data).then((res) => res.data),

  // Обновить линию
  updateLine: (projectId, lineId, data) =>
    api.put(`/projects/${projectId}/cable-lines/${lineId}`, data).then((res) => res.data),

  // Удалить линию
  deleteLine: (projectId, lineId) =>
    api.delete(`/projects/${projectId}/cable-lines/${lineId}`).then((res) => res.data),

  // Получить статистику по типам и сечениям
  getCableSummary: (projectId) =>
    api.get(`/projects/${projectId}/cable-lines/summary`).then((res) => res.data),

  // ЭКСПОРТ В TXT
  exportToTxt: (projectId) =>
    api
      .get(`/projects/${projectId}/cable-lines/export/txt`, {
        responseType: 'blob',
      })
      .then((res) => res.data),
}

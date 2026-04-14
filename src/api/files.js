import { api } from './index'

export const filesApi = {
  // Получить список категорий
  getCategories: (projectId) =>
    api.get(`/projects/${projectId}/files/categories`).then((res) => res.data),

  // Создать категорию
  createCategory: (projectId, data) =>
    api.post(`/projects/${projectId}/files/categories`, data).then((res) => res.data),

  // Удалить категорию
  deleteCategory: (projectId, categoryId) =>
    api.delete(`/projects/${projectId}/files/categories/${categoryId}`).then((res) => res.data),

  // Получить список файлов
  getFiles: (projectId) => api.get(`/projects/${projectId}/files`).then((res) => res.data),

  // Загрузить файл
  uploadFile: (projectId, formData) =>
    api
      .post(`/projects/${projectId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data),

  // Удалить файл
  deleteFile: (projectId, fileId) =>
    api.delete(`/projects/${projectId}/files/${fileId}`).then((res) => res.data),

  // Скачать файл (возвращает blob)
  downloadFile: (projectId, fileId) =>
    api
      .get(`/projects/${projectId}/files/${fileId}/download`, {
        responseType: 'blob',
      })
      .then((res) => res.data),
}

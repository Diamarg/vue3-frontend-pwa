import { api } from './index'

export const filesApi = {
  // Получить список категорий
  getCategories: (projectId) =>
    api.get(`/projects/${projectId}/files/categories`).then((res) => res.data),

  // Создать категорию
  createCategory: (projectId, data) =>
    api.post(`/projects/${projectId}/files/categories`, data).then((res) => res.data),

  // ✅ ОБНОВИТЬ категорию
  updateCategory: (projectId, categoryId, data) =>
    api.put(`/projects/${projectId}/files/categories/${categoryId}`, data).then((res) => res.data),

  // Удалить категорию
  deleteCategory: (projectId, categoryId) =>
    api.delete(`/projects/${projectId}/files/categories/${categoryId}`).then((res) => res.data),

  // Получить список файлов
  getFiles: (projectId) => api.get(`/projects/${projectId}/files`).then((res) => res.data),

  // Загрузить файл
  uploadFile: (projectId, formData, onProgress) =>
    api
      .post(`/projects/${projectId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!onProgress) return
          const total = event.total || event.loaded
          onProgress(Math.min(100, Math.round((event.loaded / total) * 100)))
        },
      })
      .then((res) => res.data),

  // ✅ ОБНОВИТЬ файл (описание)
  updateFile: (projectId, fileId, data) =>
    api.put(`/projects/${projectId}/files/${fileId}`, data).then((res) => res.data),

  // Удалить файл
  deleteFile: (projectId, fileId) =>
    api.delete(`/projects/${projectId}/files/${fileId}`).then((res) => res.data),

  // Ссылка на скачивание: отдаётся браузеру как обычная ссылка, а не через blob,
  // чтобы гигабайт не лежал в памяти страницы и работал Range (пауза и докачка)
  getDownloadUrl: (projectId, fileId) =>
    `${api.defaults.baseURL}/projects/${projectId}/files/${fileId}/download`,
}

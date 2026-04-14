import { api } from './index'

export const galleryApi = {
  // ===== GET PHOTOS =====
  // Получение списка всех фотографий для конкретного проекта
  getPhotos: (projectId) => 
    api.get(`/projects/${projectId}/photos`).then(res => res.data),

  // ===== UPLOAD PHOTO =====
  // Загрузка нового изображения (используем FormData для multipart/form-data)
  uploadPhoto: (projectId, formData) => 
    api.post(`/projects/${projectId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => res.data),

  // ===== GET PHOTO FILE =====
  // Получение самого файла изображения (бинарные данные)
  // Важно: responseType: 'blob' нужен, чтобы браузер正确处理 картинку
  getPhotoFile: (projectId, photoId) => 
    api.get(`/projects/${projectId}/photos/${photoId}/file`, {
      responseType: 'blob',
    }).then(res => res.data),

  // ===== DELETE PHOTO =====
  // Удаление фотографии по ID
  deletePhoto: (projectId, photoId) => 
    api.delete(`/projects/${projectId}/photos/${photoId}`).then(res => res.data),
}
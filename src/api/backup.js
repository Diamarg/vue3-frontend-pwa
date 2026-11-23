import { api } from './index'

export const backupApi = {
  getInfo: () => api.get('/admin/backup').then((res) => res.data),

  getStatus: () => api.get('/admin/backup/status').then((res) => res.data),

  // projectId = null — запас всего хранилища, иначе одного проекта
  start: (projectId) =>
    api
      .post('/admin/backup', null, { params: projectId ? { projectId } : {} })
      .then((res) => res.data),

  remove: (fileName) => api.delete(`/admin/backup/${encodeURIComponent(fileName)}`),

  // Архив отдаётся браузеру как обычная ссылка: копия может быть больше памяти вкладки,
  // а через blob она ещё и лежала бы там до конца качания
  getDownloadUrl: (fileName) =>
    `${api.defaults.baseURL}/admin/backup/${encodeURIComponent(fileName)}/download`,
}

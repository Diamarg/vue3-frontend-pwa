import { api } from './index'

export const storageApi = {
  getStorageInfo: () => api.get('/admin/storage').then((res) => res.data),
}

import { api } from './index'

export const systemApi = {
  getSystemInfo: () => api.get('/admin/system').then((res) => res.data),
}

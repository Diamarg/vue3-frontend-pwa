import { api } from './index'

export const adminUsersApi = {
  getUsers: () => api.get('/admin/users').then((res) => res.data),
  resetPassword: (id, newPassword) => api.put(`/admin/users/${id}/password`, { newPassword }),
  setRoles: (id, roles) => api.put(`/admin/users/${id}/roles`, { roles }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
}

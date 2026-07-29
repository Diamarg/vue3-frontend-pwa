import { api } from './index'

export const projectsApi = {
  // ===== PROJECTS =====
  getProjects: () => api.get('/projects').then((res) => res.data),
  getProjectById: (id) => api.get(`/projects/${id}`).then((res) => res.data),
  createProject: (data) => api.post('/projects', data).then((res) => res.data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data).then((res) => res.data),
  deleteProject: (id) => api.delete(`/projects/${id}`).then((res) => res.data),

  // ===== ASSEMBLIES =====
  getAssemblies: () => api.get('/assemblies').then((res) => res.data),
  getAssembliesByProjectId: (projectId) =>
    api.get(`/projects/${projectId}/assemblies`).then((res) => res.data),
  getAssemblyById: (id) => api.get(`/assemblies/${id}`).then((res) => res.data),
  createAssembly: (data) => api.post('/assemblies', data).then((res) => res.data),
  updateAssembly: (id, data) => api.put(`/assemblies/${id}`, data).then((res) => res.data),
  deleteAssembly: (id) => api.delete(`/assemblies/${id}`).then((res) => res.data),

  // ===== ASSEMBLY DEVICES =====
  getAssemblyDevices: () => api.get('/assembly-devices').then((res) => res.data),
  getAssemblyDevicesByAssemblyId: (assemblyId) =>
    api.get(`/assemblyDevices/assembly/${assemblyId}`).then((res) => res.data),
  addDeviceToAssembly: (data) => api.post('/assemblyDevices', data).then((res) => res.data),
  removeDeviceFromAssembly: (id) => api.delete(`/assemblyDevices/${id}`).then((res) => res.data),
  updateAssemblyDeviceQuantity: (id, quantity) =>
    api.patch(`/assemblyDevices/${id}/quantity`, quantity).then((res) => res.data),
  getAssemblyDevicesWithDetails: (assemblyId) =>
    api.get(`/assembly-devices/assembly/${assemblyId}/with-details`).then((res) => res.data),
}

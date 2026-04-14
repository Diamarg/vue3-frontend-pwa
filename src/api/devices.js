import { api } from './index'


// УСТРОЙСТВА И ЗНАЧЕНИЯ
export const devicesApi = {
  // ===== DEVICES (Устройства) =====
  getAll: () => api.get('/devices').then(res => res.data),
  getById: (id) => api.get(`/devices/${id}`).then(res => res.data),
  create: (data) => api.post('/devices', data).then(res => res.data),
  update: (id, data) => api.put(`/devices/${id}`, data).then(res => res.data),
  delete: (id) => api.delete(`/devices/${id}`).then(res => res.data),

  // ===== DEVICE VALUES (Значения свойств) =====
  getDeviceValues: (deviceId) => 
    api.get(`/devices/${deviceId}/values`).then(res => res.data),
  
  updateDeviceValues: (deviceId, values) => 
    api.put(`/devices/${deviceId}/values`, values).then(res => res.data),
  
  deleteDeviceValue: (id) => 
    api.delete(`/device-values/${id}`).then(res => res.data)
}
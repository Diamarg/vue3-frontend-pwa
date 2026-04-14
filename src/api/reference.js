import { api } from './index'

export const referenceApi = {
  // ===== UNITS =====
  getUnits: () => api.get('/reference/units').then(res => res.data),
  getUnitById: (id) => api.get(`/reference/units/${id}`).then(res => res.data),
  createUnit: (data) => api.post('/reference/units', data).then(res => res.data),
  updateUnit: (id, data) => api.put(`/reference/units/${id}`, data).then(res => res.data),
  deleteUnit: (id) => api.delete(`/reference/units/${id}`).then(res => res.data),

  // ===== BRANDS =====
  getBrands: () => api.get('/reference/brands').then(res => res.data),
  getBrandById: (id) => api.get(`/reference/brands/${id}`).then(res => res.data),
  createBrand: (data) => api.post('/reference/brands', data).then(res => res.data),
  updateBrand: (id, data) => api.put(`/reference/brands/${id}`, data).then(res => res.data),
  deleteBrand: (id) => api.delete(`/reference/brands/${id}`).then(res => res.data),

  // ===== DEVICE TYPES =====
  getDeviceTypes: () => api.get('/reference/device-types').then(res => res.data),
  getDeviceTypeById: (id) => api.get(`/reference/device-types/${id}`).then(res => res.data),
  createDeviceType: (data) => api.post('/reference/device-types', data).then(res => res.data),
  updateDeviceType: (id, data) => api.put(`/reference/device-types/${id}`, data).then(res => res.data),
  deleteDeviceType: (id) => api.delete(`/reference/device-types/${id}`).then(res => res.data),

  // ===== DEVICE PROPS =====
  getProperties: () => api.get('/reference/properties').then(res => res.data),
  getPropertyById: (id) => api.get(`/reference/properties/${id}`).then(res => res.data),
  createProperty: (data) => api.post('/reference/properties', data).then(res => res.data),
  updateProperty: (id, data) => api.put(`/reference/properties/${id}`, data).then(res => res.data),
  deleteProperty: (id) => api.delete(`/reference/properties/${id}`).then(res => res.data),

  // ===== DEVICE PROPS TYPES =====
  getTypeProperties: () => api.get('/reference/device-types/properties').then(res => res.data),
  getPropertiesByTypeId: (typeId) => 
    api.get(`/reference/device-types/${typeId}/properties`).then(res => res.data),
  addTypeProperty: (data) => 
    api.post('/reference/device-types/properties', data).then(res => res.data),
  deleteTypeProperty: (id) => 
    api.delete(`/reference/device-types/properties/${id}`).then(res => res.data),

  // ===== CABLETYPES =====
  getCableTypes: () => api.get('/reference/cabletypes').then(res => res.data),
  getCableLineById: (id) => api.get(`/reference/cabletypes/${id}`).then(res => res.data),
  createCableLine: (data) => api.post('/reference/cabletypes', data).then(res => res.data),
  updateCableLine: (id, data) => api.put(`/reference/cabletypes/${id}`, data).then(res => res.data),
  deleteCableLine: (id) => api.delete(`/reference/cabletypes/${id}`).then(res => res.data),

  // ===== CROSSSECTIONS =====
  getCrossSections: () => api.get('/reference/crosssections').then(res => res.data),
  getCrossSectionById: (id) => api.get(`/reference/crosssections/${id}`).then(res => res.data),
  createCrossSection: (data) => api.post('/reference/crosssections', data).then(res => res.data),
  updateCrossSection: (id, data) => api.put(`/reference/crosssections/${id}`, data).then(res => res.data),
  deleteCrossSection: (id) => api.delete(`/reference/crosssections/${id}`).then(res => res.data),


  // ===== ЗАГРУЗКА ВСЕХ СПРАВОЧНИКОВ =====
  loadAllReferenceData: async () => {
    const [units, brands, deviceTypes, properties, typeProperties, cableTypes, crossSections] = await Promise.all([
      referenceApi.getUnits(),
      referenceApi.getBrands(),
      referenceApi.getDeviceTypes(),
      referenceApi.getProperties(),
      referenceApi.getTypeProperties(),
      referenceApi.getCableTypes(),
      referenceApi.getCrossSections(),
    ])
    
    return { units, brands, deviceTypes, properties, typeProperties, cableTypes, crossSections }
  }
}
import { api } from './api';

export const jarsService = {
  getJars: () => api.get('/api/jars'),
  createJar: (data) => api.post('/api/jars', data),
  updateJar: (id, data) => api.put(`/api/jars/${id}`, data),
  deposit: (id, amount, reason = '', walletId = null) => api.patch(`/api/jars/${id}/deposit`, { amount, reason, walletId }),
  withdraw: (id, amount, reason = '', walletId = null) => api.patch(`/api/jars/${id}/withdraw`, { amount, reason, walletId }),
  deleteJar: (id) => api.delete(`/api/jars/${id}`),
  getInstallments: () => api.get('/api/jars/installments'),
  createInstallment: (data) => api.post('/api/jars/installments', data),
  updateInstallment: (id, data) => api.put(`/api/jars/installments/${id}`, data),
  payInstallment: (id, walletId = null) => api.patch(`/api/jars/installments/${id}/pay`, walletId ? { walletId } : {}),
  toggleInstallment: (id) => api.patch(`/api/jars/installments/${id}/toggle`, {}),
  deleteInstallment: (id) => api.delete(`/api/jars/installments/${id}`)
};

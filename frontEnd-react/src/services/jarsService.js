import { api } from './api';

export const jarsService = {
  getJars: () => api.get('/api/jars'),
  createJar: (data) => api.post('/api/jars', data),
  deposit: (id, amount, reason = '') => api.patch(`/api/jars/${id}/deposit`, { amount, reason }),
  withdraw: (id, amount, reason = '') => api.patch(`/api/jars/${id}/withdraw`, { amount, reason }),
  deleteJar: (id) => api.delete(`/api/jars/${id}`),
  getInstallments: () => api.get('/api/jars/installments'),
  createInstallment: (data) => api.post('/api/jars/installments', data),
  payInstallment: (id) => api.patch(`/api/jars/installments/${id}/pay`, {}),
  toggleInstallment: (id) => api.patch(`/api/jars/installments/${id}/toggle`, {}),
  deleteInstallment: (id) => api.delete(`/api/jars/installments/${id}`)
};

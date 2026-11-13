// API calls used only by screens that load on demand (kept out of the initial bundle).
import { api } from './api';

export const extrasService = {
  createSplit: async (data) => api.post('/api/spending/split', data),

  listAttachments: async (id) => api.get(`/api/spending/${encodeURIComponent(id)}/attachments`),
  getAttachment: async (id, attachmentId) =>
    api.get(`/api/spending/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`),
  addAttachment: async (id, dataUrl) => api.post(`/api/spending/${encodeURIComponent(id)}/attachments`, { dataUrl }),
  deleteAttachment: async (id, attachmentId) =>
    api.delete(`/api/spending/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`),

  getSettings: async () => api.get('/api/spending/settings'),
  saveFilters: async (filters) => api.put('/api/spending/saved-filters', { filters }),
  saveBudgetSettings: async (settings) => api.put('/api/spending/budget-settings', settings),
  restoreBackup: async (backup) => api.post('/api/spending/restore-backup', { backup, confirm: 'RESTORE' })
};

export const debtService = {
  list: async () => api.get('/api/debts'),
  create: async (data) => api.post('/api/debts', data),
  update: async (id, data) => api.put(`/api/debts/${encodeURIComponent(id)}`, data),
  remove: async (id) => api.delete(`/api/debts/${encodeURIComponent(id)}`),
  addPayment: async (id, data) => api.post(`/api/debts/${encodeURIComponent(id)}/payments`, data),
  removePayment: async (id, paymentId) =>
    api.delete(`/api/debts/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`)
};

import { api } from './api';

export const walletService = {
  getWallets: async (includeArchived = false) => {
    return await api.get('/api/wallets', {
      params: includeArchived ? { includeArchived: 'true' } : {}
    });
  },

  getPreArchiveInfo: async (id) => {
    return await api.get(`/api/wallets/${id}/pre-archive`);
  },

  archiveWallet: async (id, data = {}) => {
    return await api.post(`/api/wallets/${id}/archive`, data);
  },

  unarchiveWallet: async (id) => {
    return await api.post(`/api/wallets/${id}/unarchive`);
  },

  createWallet: async (data) => {
    return await api.post('/api/wallets', data);
  },

  updateWallet: async (id, data) => {
    return await api.put(`/api/wallets/${id}`, data);
  },

  deleteWallet: async (id) => {
    return await api.delete(`/api/wallets/${id}`);
  }
};

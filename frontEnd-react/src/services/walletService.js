import { api } from './api';

export const walletService = {
  getWallets: async () => {
    return await api.get('/api/wallets');
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

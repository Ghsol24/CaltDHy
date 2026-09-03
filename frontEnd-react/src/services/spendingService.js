import { api } from './api';

export const spendingService = {
  getTransactions: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `/api/spending?${query}` : '/api/spending';
    return await api.get(url);
  },

  createTransaction: async (data) => {
    return await api.post('/api/spending', data);
  },

  updateTransaction: async (id, data) => {
    return await api.put(`/api/spending/${id}`, data);
  },

  deleteTransaction: async (id) => {
    return await api.delete(`/api/spending/${id}`);
  },

  getBudgets: async (month = null) => {
    const url = month ? `/api/spending/budget?month=${encodeURIComponent(month)}` : '/api/spending/budget';
    return await api.get(url);
  },

  updateBudgets: async (budgetsObj, month = null) => {
    const url = month ? `/api/spending/budget?month=${encodeURIComponent(month)}` : '/api/spending/budget';
    return await api.put(url, budgetsObj);
  },

  getCategories: async () => {
    return await api.get('/api/spending/categories');
  },

  updateCategories: async (categories) => {
    return await api.put('/api/spending/categories', categories);
  },

  resetFinancialData: async () => {
    return await api.post('/api/spending/reset-data');
  }
};

import { api } from './api';

export const spendingService = {
  exportFinancialData: async () => api.get('/api/spending/export'),

  getTransactions: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = query ? `/api/spending?${query}` : '/api/spending';
    return await api.get(url);
  },

  getExpectedDays: async (month) => api.get(`/api/spending/expected-days?month=${encodeURIComponent(month)}`),

  setExpectedDay: async (date, expected) => api.put(`/api/spending/expected-days/${encodeURIComponent(date)}`, { expected }),

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

  updateBudgets: async (budgetsObj, month = null, categories) => {
    const url = month ? `/api/spending/budget?month=${encodeURIComponent(month)}` : '/api/spending/budget';
    return await api.put(url, categories ? { budgets: budgetsObj, categories } : budgetsObj);
  },

  getCategories: async () => {
    return await api.get('/api/spending/categories');
  },

  updateCategories: async (categories) => {
    return await api.put('/api/spending/categories', { categories });
  },

  resetFinancialData: async () => {
    return await api.post('/api/spending/reset-data');
  }
};

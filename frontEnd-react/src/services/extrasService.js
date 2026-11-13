// API calls used only by screens that load on demand (kept out of the initial bundle).
import { api } from './api';

export const extrasService = {
  getSettings: async () => api.get('/api/spending/settings'),
  saveFilters: async (filters) => api.put('/api/spending/saved-filters', { filters }),
  restoreBackup: async (backup) => api.post('/api/spending/restore-backup', { backup, confirm: 'RESTORE' })
};

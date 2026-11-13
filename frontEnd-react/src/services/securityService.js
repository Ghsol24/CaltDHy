// Two-factor and signed-in device calls, used only by the Settings security tab.
import { apiFetch } from './api';

export const securityService = {
  listSessions: async () => apiFetch('/api/auth/sessions'),
  revokeSession: async (id) => apiFetch('/api/auth/sessions/revoke', { method: 'POST', body: JSON.stringify({ id }) }),
  revokeOtherSessions: async () => apiFetch('/api/auth/sessions/revoke-others', { method: 'POST', body: '{}' }),
  setupTwoFactor: async (currentPassword) => apiFetch('/api/auth/2fa/setup', {
    method: 'POST', body: JSON.stringify({ currentPassword })
  }),
  enableTwoFactor: async (code) => apiFetch('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  disableTwoFactor: async (currentPassword, code) => apiFetch('/api/auth/2fa/disable', {
    method: 'POST', body: JSON.stringify({ currentPassword, code })
  })
};

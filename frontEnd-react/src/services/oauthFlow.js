// Browser side of "Continue with Google / Facebook". The whole exchange runs on the server through
// redirects, so no third-party script is loaded and no token ever reaches this page.
import { apiFetch } from './api.js';
import { OAUTH_INTENT_KEY } from './oauthReturn.js';

/** Leaves for the provider's sign-in page. Records that this tab chose to do so. */
export function beginOAuth(provider, inviteToken = '') {
  if (provider !== 'google' && provider !== 'facebook') return;
  try { sessionStorage.setItem(OAUTH_INTENT_KEY, String(Date.now())); } catch { /* the flow still works without it */ }
  const query = /^[a-f0-9]{64}$/.test(inviteToken) ? `?invite=${inviteToken}` : '';
  window.location.assign(`/api/auth/oauth/${provider}/start${query}`);
}

export const oauthService = {
  providers: async () => apiFetch('/api/auth/oauth/providers'),
  pending: async () => apiFetch('/api/auth/oauth/pending'),
  cancel: async () => apiFetch('/api/auth/oauth/cancel', { method: 'POST', body: '{}' }),
  // Settings > Data & privacy. `link` answers with the provider address to open next.
  link: async (provider, password) => apiFetch(`/api/auth/oauth/${provider}/link`, {
    method: 'POST', body: JSON.stringify(password ? { password } : {})
  }),
  unlink: async (provider, password) => apiFetch(`/api/auth/oauth/${provider}/unlink`, {
    method: 'POST', body: JSON.stringify(password ? { password } : {})
  }),
};

/**
 * The server sends a link started from Settings back to /spending/home?linked=… or ?link_error=….
 * Read once, then removed from the address bar so a reload does not repeat the message.
 */
let linkReturn = null;
export function captureLinkReturn(search) {
  const params = new URLSearchParams(search);
  const provider = params.get('provider') || params.get('linked');
  if (!['google', 'facebook'].includes(provider)) return false;
  linkReturn = params.has('linked') ? { provider, ok: true } : { provider, ok: false, code: params.get('link_error') || 'failed' };
  return true;
}
export function takeLinkReturn() {
  const value = linkReturn;
  linkReturn = null;
  return value;
}

// Browser side of "Continue with Google / Facebook". The whole exchange runs on the server through
// redirects, so no third-party script is loaded and no token ever reaches this page.
import { apiFetch } from './api.js';
import { OAUTH_INTENT_KEY } from './oauthReturn.js';

const OAUTH_PROVIDERS_STORAGE_KEY = 'caltdhy_oauth_providers';
export const KNOWN_OAUTH_PROVIDERS = ['google', 'facebook'];

let providersMemory = null;
let providersPending = null;

function currentOrigin() {
  try {
    return typeof window !== 'undefined' && typeof window.location?.origin === 'string'
      ? window.location.origin
      : '';
  } catch {
    return '';
  }
}

function readStoredProviders(origin) {
  if (!origin) return null;
  try {
    const raw = localStorage.getItem(OAUTH_PROVIDERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.origin !== origin || !Array.isArray(parsed.providers)) {
      return null;
    }
    if (parsed.providers.some((item) => typeof item !== 'string' || !KNOWN_OAUTH_PROVIDERS.includes(item))) {
      return null;
    }
    return KNOWN_OAUTH_PROVIDERS.filter((provider) => parsed.providers.includes(provider));
  } catch {
    return null;
  }
}

function writeStoredProviders(origin, providers) {
  if (!origin) return;
  try {
    localStorage.setItem(OAUTH_PROVIDERS_STORAGE_KEY, JSON.stringify({ origin, providers }));
  } catch {
    /* storage may be unavailable in restricted contexts */
  }
}

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

/** Returns cached providers for the current origin (memory first, then localStorage), or null if unknown. */
export function getCachedOAuthProviders() {
  const origin = currentOrigin();
  if (!origin) return null;
  if (providersMemory && providersMemory.origin === origin) {
    return providersMemory.providers;
  }
  return readStoredProviders(origin);
}

/** True once the current page session has already verified enabled providers for this origin. */
export function hasFreshOAuthProviders() {
  const origin = currentOrigin();
  return Boolean(origin && providersMemory && providersMemory.origin === origin);
}

/** Fetches and caches enabled OAuth providers for this origin, deduplicating concurrent calls. */
export async function loadOAuthProviders({ force = false } = {}) {
  const origin = currentOrigin();
  if (!force && origin && providersMemory && providersMemory.origin === origin) {
    return providersMemory.providers;
  }
  if (!force && providersPending && providersPending.origin === origin) {
    return providersPending.promise;
  }
  const entry = { origin };
  entry.promise = oauthService.providers().then((data) => {
    const activeOrigin = currentOrigin() || origin;
    const providers = activeOrigin && data?.origin === activeOrigin && Array.isArray(data?.providers)
      ? KNOWN_OAUTH_PROVIDERS.filter((provider) => data.providers.includes(provider))
      : [];
    if (activeOrigin) {
      providersMemory = { origin: activeOrigin, providers };
      writeStoredProviders(activeOrigin, providers);
    }
    return providers;
  }).finally(() => {
    if (providersPending === entry) providersPending = null;
  });
  providersPending = entry;
  return entry.promise;
}

export function prefetchOAuthProviders() {
  void loadOAuthProviders().catch(() => {});
}

export function resetOAuthProvidersCache() {
  providersMemory = null;
  providersPending = null;
}

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

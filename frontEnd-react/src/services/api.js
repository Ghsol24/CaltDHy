import { sessionEpoch, assertSession, trackRequest } from './sessionRuntime';
import { normalizeLocale, translate } from '../i18n/translations';

function message(key) {
  let locale = 'vi';
  try { locale = normalizeLocale(localStorage.getItem('caltdhy_lang')); } catch { /* use Vietnamese */ }
  return translate(locale, key);
}
let csrfToken = null;
let csrfEpoch = -1;
let csrfRequest = null;
const pendingWrites = new Map();
export function clearApiSession() {
  csrfToken = null; csrfEpoch = -1; csrfRequest = null; pendingWrites.clear();
}
function ensureCsrf(epoch, refresh = false) {
  assertSession(epoch);
  if (!refresh && csrfToken && csrfEpoch === epoch) return Promise.resolve();
  if (csrfRequest?.epoch === epoch) return csrfRequest.promise;
  const current = { epoch };
  current.promise = request('/api/auth/csrf', {}, epoch).finally(() => {
    if (csrfRequest === current) csrfRequest = null;
  });
  csrfRequest = current;
  return current.promise;
}
async function request(endpoint, options, epoch) {
  const controller = new AbortController();
  const release = trackRequest(controller);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    const method = (options.method || 'GET').toUpperCase();
    const fetchOptions = {
      ...options,
      credentials: 'include',
      signal: controller.signal
    };
    if (!['GET', 'HEAD'].includes(method)) {
      fetchOptions.cache = 'no-store';
    }
    const response = await fetch(endpoint, fetchOptions);
    const data = await response.json().catch(() => null);
    assertSession(epoch);
    if (!response.ok) {
      const error = new Error(data?.message || message('error.requestFailed'));
      error.status = response.status; error.code = data?.code;
      if (response.status === 401 && !/^\/api\/auth\/(login|session)(?:\?|$)/.test(endpoint)) {
        window.dispatchEvent(new CustomEvent('caltdhy:auth-expired'));
      }
      throw error;
    }
    const sessionResponse = /^\/api\/auth\/(login|register|session|profile)(?:\?|$)/.test(endpoint);
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.success !== true ||
      (sessionResponse && (!data.user || !/^[a-f\d]{24}$/i.test(data.user.id || '')))) {
      throw new Error(message('error.invalidResponse'));
    }
    if (data.csrfToken) { csrfToken = data.csrfToken; csrfEpoch = epoch; }
    return data;
  } catch (error) {
    assertSession(epoch);
    if (!error.status) {
      error.message = error.name === 'AbortError' ? message('error.cancelled') : message('error.networkUnknown');
    }
    throw error;
  } finally {
    release(); options.signal?.removeEventListener('abort', abort);
  }
}
export async function apiFetch(endpoint, options = {}) {
  if (!endpoint.startsWith('/api/')) throw new Error(message('error.sameAppApi'));
  const epoch = sessionEpoch();
  const method = (options.method || 'GET').toUpperCase();
  const write = !['GET', 'HEAD'].includes(method);
  const finance = /^\/api\/(wallets|jars|spending)(?:\/|\?|$)/.test(endpoint);
  const intent = epoch + ':' + method + ':' + endpoint + ':' + (options.body || '');
  let entry = pendingWrites.get(intent);
  if (write && finance && entry?.promise) return entry.promise;
  if (!entry) entry = { key: crypto.randomUUID() };
  if (write && finance) pendingWrites.set(intent, entry);
  const execute = async () => {
    try {
      if (write && (!csrfToken || csrfEpoch !== epoch)) {
        await ensureCsrf(epoch);
      }
      assertSession(epoch);
      let locale = 'vi';
      try { locale = localStorage.getItem('caltdhy_lang') || 'vi'; } catch { /* use default */ }
      const headers = { 'Content-Type': 'application/json', 'Accept-Language': locale, ...options.headers };
      if (write) headers['X-CSRF-Token'] = csrfToken;
      if (write && finance) headers['Idempotency-Key'] = entry.key;
      let result;
      try { result = await request(endpoint, { ...options, method, headers }, epoch); }
      catch (error) {
        if (error.code !== 'CSRF_INVALID') throw error;
        await ensureCsrf(epoch, true);
        headers['X-CSRF-Token'] = csrfToken;
        result = await request(endpoint, { ...options, method, headers }, epoch);
      }
      pendingWrites.delete(intent);
      return result;
    } catch (error) {
      // Retain the same key after ambiguous network/server failure.
      if (error.status && error.status < 500) pendingWrites.delete(intent);
      throw error;
    } finally { entry.promise = null; }
  };
  entry.promise = execute();
  return entry.promise;
}
export const api = {
  get: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiFetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options = {}) => apiFetch(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body, options = {}) => apiFetch(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { ...options, method: 'DELETE' })
};

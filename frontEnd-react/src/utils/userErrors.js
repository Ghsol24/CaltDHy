import { normalizeLocale, translate, translations } from '../i18n/translations.js';

const knownApiMessages = new Map();
let businessTemplates = [];
let catalogRequest;

// Load the full validation catalog only when an API request fails. Normal startup
// should not download every rare business error. A failed catalog download stays
// fail-closed: status/context fallbacks are still available synchronously.
export function loadApiErrorMessages() {
  if (!catalogRequest) {
    catalogRequest = import('../i18n/apiMessages.mjs').then(({ apiMessages, businessTemplates: templates }) => {
      businessTemplates = templates;
      for (const [source, messages] of Object.entries(apiMessages)) {
        if (/^(Đã |Đăng (?:nhập|ký) thành công|Tạo ví mới thành công|Cập nhật (?:ví|tài khoản) thành công|Email đã được xác minh|Nếu email phù hợp)/.test(source)) continue;
        for (const message of [source, ...messages]) knownApiMessages.set(message, messages);
      }
    }).catch(() => { catalogRequest = null; });
  }
  return catalogRequest;
}

const knownUiMessages = new Map();
for (const messages of Object.values(translations)) {
  for (const [key, message] of Object.entries(messages)) {
    if (!message.includes('{')) knownUiMessages.set(message, key);
  }
}


function activeLocale() {
  try { return normalizeLocale(localStorage.getItem('caltdhy_lang')); }
  catch { return 'vi'; }
}

export function isSilentError(error) {
  return error?.code === 'SESSION_CHANGED' || error?.name === 'AbortError' || error?.code === 'REQUEST_CANCELLED';
}

/** Only reviewed messages and known error kinds may reach a user-facing surface. */
export function getUserErrorMessage(error, fallbackKey = 'error.generic', locale = activeLocale()) {
  const t = (key) => translate(locale, key);
  if (isSilentError(error)) return '';
  if (error?.code === 'TRANSACTION_FAILED' || error?.code === 'WRITE_UNCONFIRMED') return t('error.writeUnconfirmed');
  if (error?.code === 'NETWORK_ERROR') return t('error.network');
  if (error?.code === 'TIMEOUT') return t('error.timeout');
  if (error?.code === 'INVALID_RESPONSE') return t('error.invalidResponse');
  if (error?.code === 'SESSION_EXPIRED') return t('error.authExpired');
  if (error?.code === 'CSRF_INVALID') return t('error.sessionRetry');
  const message = typeof error === 'string' ? error : error?.message;
  if (typeof message === 'string') {
    const known = knownApiMessages.get(message);
    if (known) return known[locale === 'en' ? 1 : locale === 'zh-CN' ? 2 : 0];
    const uiKey = knownUiMessages.get(message);
    if (uiKey) return t(uiKey);
    if (businessTemplates.some((pattern) => pattern.test(message))) return message;
  }
  if (error?.status === 401) return t(error.context === 'login' ? 'auth.loginFailed' : 'error.authExpired');
  if (error?.status === 403) return t('error.forbidden');
  if (error?.status === 404) return t('error.notFound');
  if (error?.status === 429) return t('error.tooManyRequests');
  if (error?.status >= 500) return t('error.serviceUnavailable');
  const fallback = t(fallbackKey);
  return fallback !== fallbackKey ? fallback : t('error.generic');
}

import { normalizeLocale, translate } from '../i18n/translations';

let epoch = 0;
const controllers = new Set();
export const sessionEpoch = () => epoch;
export function sessionChangedError() {
  let locale = 'vi';
  try { locale = normalizeLocale(localStorage.getItem('caltdhy_lang')); } catch { /* use Vietnamese */ }
  const error = new Error(translate(locale, 'error.sessionChanged'));
  error.code = 'SESSION_CHANGED';
  return error;
}
export function assertSession(value) { if (value !== epoch) throw sessionChangedError(); }
export function invalidateSession() {
  epoch += 1;
  for (const controller of controllers) controller.abort();
  controllers.clear();
  return epoch;
}
export function trackRequest(controller) {
  controllers.add(controller);
  return () => controllers.delete(controller);
}
export const scopedSet = (value, set) => (...args) => { if (value === epoch) set(...args); };
export const scopedGet = (value, get) => () => { assertSession(value); return get(); };

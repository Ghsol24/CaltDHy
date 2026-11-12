// Pure capability check for the daily push reminder (kept import-free so it can be unit tested).
const isStandalone = (env) => Boolean(env.matchMedia?.('(display-mode: standalone)')?.matches || env.navigator?.standalone);
const isIos = (env) => /iPad|iPhone|iPod/.test(env.navigator?.userAgent || '')
  || (env.navigator?.platform === 'MacIntel' && env.navigator?.maxTouchPoints > 1);

/**
 * What this device can do right now:
 *  'unsupported'   the browser has no web push at all
 *  'needs-install' iPhone/iPad: push only works after "Add to Home Screen"
 *  'denied'        the user blocked notifications for this site in the browser
 *  'ready'         can ask for permission / already granted
 */
export function pushSupport(env = globalThis) {
  if (isIos(env) && !isStandalone(env)) return 'needs-install';
  if (!env.navigator?.serviceWorker || !env.PushManager || !env.Notification) return 'unsupported';
  if (env.Notification.permission === 'denied') return 'denied';
  return 'ready';
}

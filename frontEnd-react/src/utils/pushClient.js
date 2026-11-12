// Browser side of the daily push reminder. A push subscription belongs to this browser on this
// device; the account-level switch (preferences.notifications.dailyReminder) only says "remind me",
// and each device that should show the reminder subscribes here.
import { authService } from '../services/authService';
import { pushSupport } from './pushSupport.js';

export { pushSupport };

const COPY_CACHE = 'caltdhy-push-copy';
const COPY_KEY = '/__push-copy';

// The app only registers its service worker in production builds; do not wait forever in dev.
async function registration(timeoutMs = 4000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function keyBytes(base64Url) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** The endpoint this device is subscribed with, or null. */
export async function currentPushEndpoint() {
  if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return null;
  const worker = await registration();
  const subscription = await worker?.pushManager.getSubscription();
  return subscription?.endpoint || null;
}

/**
 * Asks for permission if needed, subscribes this device and tells the server.
 * Resolves to 'enabled', 'denied', 'dismissed', 'unconfigured' (server has no push keys) or 'unavailable'.
 */
export async function enablePushOnThisDevice(copy) {
  if (pushSupport() !== 'ready') return 'unavailable';
  const { publicKey } = await authService.getPushConfig();
  if (!publicKey) return 'unconfigured';
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';
  const worker = await registration();
  if (!worker) return 'unavailable';
  const subscription = await worker.pushManager.getSubscription()
    || await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await authService.addPushSubscription(subscription.endpoint);
  await savePushCopy(copy);
  return 'enabled';
}

export async function disablePushOnThisDevice() {
  if (pushSupport() !== 'ready') return;
  const worker = await registration();
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) return;
  await authService.removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

/** The service worker shows this text when the (payload-less) push arrives. */
export async function savePushCopy(copy) {
  if (!copy || !globalThis.caches) return;
  try {
    const cache = await caches.open(COPY_CACHE);
    await cache.put(COPY_KEY, new Response(JSON.stringify({ title: copy.title, body: copy.body }),
      { headers: { 'Content-Type': 'application/json' } }));
  } catch { /* the worker falls back to its default text */ }
}

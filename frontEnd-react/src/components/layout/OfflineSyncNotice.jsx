import React, { useSyncExternalStore } from 'react';
import { useLangStore } from '../../stores/useLangStore';

const COPY = {
  vi: 'Không có kết nối Internet. Bạn vẫn xem được dữ liệu đã tải, nhưng chưa thể lưu thay đổi cho tới khi có mạng lại.',
  en: 'No Internet connection. You can still view loaded data, but changes cannot be saved until you are back online.',
  'zh-CN': '没有网络连接。您仍可查看已加载的数据，但在恢复联网前无法保存更改。'
};
const subscribe = (listener) => {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true);

/** Tells the person the app is offline, so a failed save is not a surprise. Nothing is queued. */
export function OfflineSyncNotice() {
  const lang = useLangStore((state) => state.lang);
  const online = useOnline();
  if (online) return null;
  return <div className="offline-sync-notice" role="status" aria-live="polite">
    <span>{COPY[lang] || (String(lang).startsWith('zh') ? COPY['zh-CN'] : COPY.vi)}</span>
  </div>;
}

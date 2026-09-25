import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSignatureLoginStore } from '../../stores/useSignatureLoginStore';

export function PwaUpdateNotice() {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const [registration, setRegistration] = useState(null);
  const loginBusy = useSignatureLoginStore((store) => store.state !== 'idle');
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, value) => setRegistration(value),
  });

  useEffect(() => {
    if (!registration) return undefined;
    let lastCheck = -Infinity;
    const checkForUpdate = () => {
      if (document.hidden || !navigator.onLine || Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      // Long-lived laptop tabs otherwise keep the old cached application until
      // their next navigation. Keep applying updates explicit to preserve forms.
      void registration.update().catch(() => {});
    };
    checkForUpdate();
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', checkForUpdate);
    return () => {
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, [registration]);

  if (!needRefresh) return null;

  const applyUpdate = async () => {
    setUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch {
      setUpdating(false);
    }
  };

  return <div className="pwa-update-notice" role="status" aria-live="polite">
    <span>{t('pwa.updateAvailable')}</span>
    <div className="pwa-update-actions">
      <button type="button" className="pwa-update-now" disabled={updating || loginBusy} onClick={() => { void applyUpdate(); }}>
        {t('pwa.updateNow')}
      </button>
      <button type="button" className="pwa-update-later" onClick={() => setNeedRefresh(false)}>
        {t('pwa.later')}
      </button>
    </div>
  </div>;
}

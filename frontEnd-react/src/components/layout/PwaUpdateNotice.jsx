import React, { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from '../../i18n/useTranslation';

export function PwaUpdateNotice() {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
      <button type="button" className="pwa-update-now" disabled={updating} onClick={() => { void applyUpdate(); }}>
        {t('pwa.updateNow')}
      </button>
      <button type="button" className="pwa-update-later" onClick={() => setNeedRefresh(false)}>
        {t('pwa.later')}
      </button>
    </div>
  </div>;
}

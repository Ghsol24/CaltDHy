import { getUserErrorMessage } from '../utils/userErrors.js';
import React, { useState } from 'react';
import '../i18n/lazyTranslations';
import { Link, useSearchParams } from 'react-router';
import { authService } from '../services/authService';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { useTranslation } from '../i18n/useTranslation';
import './auth.css';

// Opened from the link in a reminder email. Nothing changes until a button is pressed, so mail
// scanners that pre-open links cannot pause or turn off anyone's reminders.
export function EmailPreferencesPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [pending, setPending] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const choose = async (action) => {
    setPending(action); setError('');
    try {
      await authService.updateEmailReminders({ token, action });
      setDone(action);
    } catch (err) {
      setError(getUserErrorMessage(err, 'error.save'));
    } finally {
      setPending('');
    }
  };

  return (
    <div className="auth-page">
      <main>
        <IndustrialPanel title={t('notify.manageTitle')} titleHighlight="">
          {done ? (
            <p className="auth-page__p--verify" role="status">{t(done === 'pause' ? 'notify.managePaused' : 'notify.manageOff')}</p>
          ) : (
            <>
              <p className="auth-page__p--verify">{t(token ? 'notify.manageBody' : 'notify.manageMissing')}</p>
              {token && (
                <div className="email-preferences-actions">
                  <button className="btn-cta" type="button" onClick={() => choose('pause')} disabled={Boolean(pending)}>
                    {pending === 'pause' ? t('common.processing') : t('notify.managePause')}
                  </button>
                  <button className="btn-cta email-preferences-off" type="button" onClick={() => choose('off')} disabled={Boolean(pending)}>
                    {pending === 'off' ? t('common.processing') : t('notify.manageTurnOff')}
                  </button>
                </div>
              )}
              {error && <p className="auth-page__p--verify" role="alert">{error}</p>}
            </>
          )}
          <p className="mod-footer"><Link to="/login" className="lnk">{t('auth.backLogin')}</Link></p>
        </IndustrialPanel>
      </main>
    </div>
  );
}

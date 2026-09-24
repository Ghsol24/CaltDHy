import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authService } from '../services/authService';
import { StatusBar } from '../components/ui/StatusBar';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { useTranslation } from '../i18n/useTranslation';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState(() => t('auth.verifying'));
  const [canResend, setCanResend] = useState(!token && Boolean(email));
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setMessage(t('auth.verifyPrompt'));
      return;
    }
    authService.verifyEmail({ email, token })
      .then((data) => {
        setMessage(data.message || t('auth.verified'));
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      })
      .catch((error) => {
        setMessage(error.message || t('auth.invalidVerification'));
        setCanResend(true);
      });
  }, [email, navigate, token, t]);

  const resend = async () => {
    setIsSending(true);
    try {
      const data = await authService.resendVerification(email);
      setMessage(data.message || t('auth.resendDone'));
    } catch (error) {
      setMessage(error.message || t('auth.resendError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="auth-page">
      <StatusBar label={t('auth.verifyEmail')} />
      <main>
        <IndustrialPanel eyebrow={t('auth.account')} title={t('auth.verifyEmail')} titleHighlight="">
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center', margin: '0 0 20px' }}>{message}</p>
          {canResend && <button className="btn-cta" type="button" onClick={resend} disabled={isSending}>
            {isSending ? t('auth.sending') : t('auth.resend')}
          </button>}
          <p className="mod-footer"><Link to="/login" className="lnk">{t('auth.backLogin')}</Link></p>
        </IndustrialPanel>
      </main>
    </div>
  );
}

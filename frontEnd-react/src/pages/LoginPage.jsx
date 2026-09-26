import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuthStore } from '../stores/useAuthStore';
import { useSignatureLoginStore } from '../stores/useSignatureLoginStore';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';
import {
  ClockOutlineIcon,
  AlertTriangleOutlineIcon
} from '../components/ui/AppIcons';
import { useTranslation } from '../i18n/useTranslation';

export const LoginPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = useAuthStore((state) => state.login);
  const beginSignature = useSignatureLoginStore((state) => state.begin);
  const succeedSignature = useSignatureLoginStore((state) => state.succeed);
  const failSignature = useSignatureLoginStore((state) => state.fail);
  const attemptRef = useRef(null);

  useEffect(() => () => {
    const attempt = attemptRef.current;
    if (!attempt) return;
    attemptRef.current = null;
    window.clearTimeout(attempt.timeout);
    attempt.controller.abort();
    failSignature(attempt.id);
  }, [failSignature]);

  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const isPwValid = password.length >= 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!isEmailValid) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.enterPassword'));
      return;
    }

    setIsSubmitting(true);
    const id = beginSignature();
    const controller = new AbortController();
    const attempt = { id, controller, timedOut: false, timeout: null };
    attemptRef.current = attempt;
    attempt.timeout = window.setTimeout(() => {
      attempt.timedOut = true;
      controller.abort();
    }, 25000);
    // Start fetching the authenticated shell while the server verifies the account.
    void import('./SpendingPage').catch(() => {});

    try {
      await login(email.trim(), password, { signal: controller.signal });
      if (attemptRef.current !== attempt) return;
      window.clearTimeout(attempt.timeout);
      attemptRef.current = null;
      succeedSignature(id);
    } catch (err) {
      if (attemptRef.current !== attempt) return;
      window.clearTimeout(attempt.timeout);
      attemptRef.current = null;
      failSignature(id);
      setError(attempt.timedOut ? t('auth.loginTimeout') : err.message || t('auth.connectionError'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <main>
        <IndustrialPanel title={t('auth.welcome')} titleHighlight={t('auth.back')}>
          <form id="loginForm" onSubmit={handleSubmit} noValidate>
            <FloatingInput
              id="emailIn"
              type="email"
              label={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isValid={isEmailValid}
              autoComplete="email"
              required
            />

            <FloatingInput
              id="pwIn"
              type="password"
              label={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isPwValid}
              autoComplete="current-password"
              required
            />

            <div className="forgot-row">
              <Link to="/reset-password" className="forgot-lnk">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {isExpired && !error && (
              <div className="form-err show" style={{ background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308', display: 'flex', alignItems: 'center', gap: '6px' }} role="status">
                <ClockOutlineIcon size={14} /> {t('error.authExpired')}
              </div>
            )}

            {error && (
              <div id="formErr" className="form-err show" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} role="alert">
                <AlertTriangleOutlineIcon size={14} /> {error}
              </div>
            )}

            <button type="submit" className={`btn-cta ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{isSubmitting ? t('auth.loggingIn') : t('auth.login')}</span>
            </button>

          </form>

          <div className="divider">
            <span>{t('auth.or')}</span>
          </div>

          <Link to="/" className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('auth.backHome')}
          </Link>

          <p className="mod-footer">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="lnk">
              {t('auth.signup')}
            </Link>
          </p>
        </IndustrialPanel>
      </main>
    </div>
  );
};

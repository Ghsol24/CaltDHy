import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../stores/useAuthStore';
import { StatusBar } from '../components/ui/StatusBar';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';
import {
  ClockOutlineIcon,
  AlertTriangleOutlineIcon,
  LockOutlineIcon
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
  const navigate = useNavigate();

  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const isPwValid = password.length >= 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
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

    try {
      await login(email.trim(), password);
      setTimeout(() => {
        navigate('/spending/home');
      }, 300);
    } catch (err) {
      setError(err.message || t('auth.connectionError'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="orb2" aria-hidden="true"></div>

      <div className="pg-screw s-tl" aria-hidden="true"></div>
      <div className="pg-screw s-tr" aria-hidden="true"></div>
      <div className="pg-screw s-bl" aria-hidden="true"></div>
      <div className="pg-screw s-br" aria-hidden="true"></div>

      <StatusBar label={t('auth.secureLogin')} />

      <main>
        <IndustrialPanel eyebrow={t('auth.account')} title={t('auth.welcome')} titleHighlight={t('auth.back')}>
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

            <p className="security-note" style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <LockOutlineIcon size={13} /> {t('auth.secureLoginNote')}
            </p>
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

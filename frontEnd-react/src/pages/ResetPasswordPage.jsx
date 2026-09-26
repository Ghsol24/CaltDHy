import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { authService } from '../services/authService';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';
import {
  AlertTriangleOutlineIcon,
  CheckOutlineIcon
} from '../components/ui/AppIcons';
import { useTranslation } from '../i18n/useTranslation';

export const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const navigate = useNavigate();

  const isResetMode = !!(token && emailParam);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const isForgotEmailValid = /\S+@\S+\.\S+/.test(forgotEmail.trim());

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!isForgotEmailValid) {
      setForgotError(t('auth.invalidEmail'));
      return;
    }

    setIsForgotSubmitting(true);

    try {
      const data = await authService.forgotPassword({ email: forgotEmail.trim() });
      if (data.success) {
        setForgotSuccess(data.message || t('auth.resetEmailSent'));
      } else {
        setForgotError(data.message || t('auth.requestError'));
      }
    } catch (err) {
      setForgotError(err.message || t('auth.connectionError'));
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (newPassword.length < 12) {
      setResetError(t('auth.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError(t('auth.passwordMismatch'));
      return;
    }

    setIsResetSubmitting(true);

    try {
      const data = await authService.resetPassword({
        token,
        email: emailParam,
        newPassword
      });

      if (data.success) {
        setResetSuccess(data.message || t('auth.resetSuccess'));
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setResetError(data.message || t('error.generic'));
        setIsResetSubmitting(false);
      }
    } catch (err) {
      setResetError(err.message || t('auth.connectionError'));
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <main>
        <IndustrialPanel
          title={t(isResetMode ? 'auth.resetTitle' : 'auth.forgotTitle')}
          titleHighlight=""
        >
          <p id="modHint" style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginBottom: '20px' }}>
            {isResetMode
              ? t('auth.resetHint')
              : t('auth.forgotHint')}
          </p>

          {!isResetMode ? (
            <form id="forgotForm" onSubmit={handleForgotSubmit} noValidate>
              <FloatingInput
                id="emailForgot"
                type="email"
                label={t('auth.email')}
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                isValid={isForgotEmailValid}
                autoComplete="email"
                required
              />

              {forgotError && (
                <div id="forgotError" className="form-err show" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} role="alert">
                  <AlertTriangleOutlineIcon size={14} /> {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div id="forgotSuccess" className="form-success show" role="alert" style={{ color: 'var(--success)', marginTop: '8px', fontSize: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CheckOutlineIcon size={14} /> {forgotSuccess}
                </div>
              )}

              <button type="submit" className={`btn-cta ${isForgotSubmitting ? 'loading' : ''}`} disabled={isForgotSubmitting}>
                <span className="spinner" aria-hidden="true"></span>
                <span className="btn-text">{isForgotSubmitting ? t('auth.sendingRequest') : t('auth.sendRequest')}</span>
              </button>
            </form>
          ) : (
            <form id="resetForm" onSubmit={handleResetSubmit} noValidate>
              <FloatingInput
                id="newPass"
                type="password"
                label={t('auth.newPassword')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                isValid={newPassword.length >= 6}
                autoComplete="new-password"
                required
              />

              <FloatingInput
                id="confirmPass"
                type="password"
                label={t('auth.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                isValid={confirmPassword.length >= 6 && confirmPassword === newPassword}
                autoComplete="new-password"
                required
              />

              {resetError && (
                <div id="resetError" className="form-err show" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} role="alert">
                  <AlertTriangleOutlineIcon size={14} /> {resetError}
                </div>
              )}

              {resetSuccess && (
                <div id="resetSuccess" className="form-success show" role="alert" style={{ color: 'var(--success)', marginTop: '8px', fontSize: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CheckOutlineIcon size={14} /> {resetSuccess}
                </div>
              )}

              <button type="submit" className={`btn-cta ${isResetSubmitting ? 'loading' : ''}`} disabled={isResetSubmitting}>
                <span className="spinner" aria-hidden="true"></span>
                <span className="btn-text">{isResetSubmitting ? t('auth.resetting') : t('auth.resetPassword')}</span>
              </button>
            </form>
          )}

          <div className="divider">
            <span>{t('auth.or')}</span>
          </div>

          <Link to="/login" className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t('auth.backLogin')}
          </Link>
        </IndustrialPanel>
      </main>
    </div>
  );
};

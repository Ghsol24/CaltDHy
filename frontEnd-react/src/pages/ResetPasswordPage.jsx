import { getUserErrorMessage } from '../utils/userErrors.js';
import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { authService } from '../services/authService';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';
import { AlertTriangleOutlineIcon, CheckOutlineIcon } from '../components/ui/AppIcons';
import { useTranslation } from '../i18n/useTranslation';
import { PublicPageShell } from '../components/layout/PublicPageShell';
import { getPublicNavCopy } from '../components/layout/publicNavCopy';
import './auth.css';

export const ResetPasswordPage = () => {
  const { t, lang } = useTranslation();
  const navCopy = getPublicNavCopy(lang);
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const navigate = useNavigate();

  const isResetMode = !!(token && emailParam);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

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
        setForgotError(getUserErrorMessage(data, 'auth.requestError'));
      }
    } catch (err) {
      setForgotError(getUserErrorMessage(err, 'error.generic'));
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
        setResetError(getUserErrorMessage(data));
        setIsResetSubmitting(false);
      }
    } catch (err) {
      setResetError(getUserErrorMessage(err, 'error.generic'));
      setIsResetSubmitting(false);
    }
  };

  return (
    <PublicPageShell pageTitle={navCopy.auth.resetHeading}>
      <IndustrialPanel
        title={t(isResetMode ? 'auth.resetTitle' : 'auth.forgotTitle')}
        subtitle={isResetMode ? t('auth.resetHint') : t('auth.forgotHint')}
        headingLevel="h2"
      >
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
              <div id="forgotError" className="form-err form-err--icon show" role="alert">
                <AlertTriangleOutlineIcon size={14} /> {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div id="forgotSuccess" className="form-success show form-success--layout" role="alert">
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
              isValid={newPassword.length >= 12}
              autoComplete="new-password"
              required
            />

            <FloatingInput
              id="confirmPass"
              type="password"
              label={t('auth.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              isValid={confirmPassword.length >= 12 && confirmPassword === newPassword}
              autoComplete="new-password"
              required
            />

            {resetError && (
              <div id="resetError" className="form-err form-err--icon show" role="alert">
                <AlertTriangleOutlineIcon size={14} /> {resetError}
              </div>
            )}

            {resetSuccess && (
              <div id="resetSuccess" className="form-success show form-success--layout" role="alert">
                <CheckOutlineIcon size={14} /> {resetSuccess}
              </div>
            )}

            <button type="submit" className={`btn-cta ${isResetSubmitting ? 'loading' : ''}`} disabled={isResetSubmitting}>
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{isResetSubmitting ? t('auth.resetting') : t('auth.resetPassword')}</span>
            </button>
          </form>
        )}

        <p className="mod-footer">
          <Link to="/login" className="lnk">{t('auth.backLogin')}</Link>
        </p>
      </IndustrialPanel>
    </PublicPageShell>
  );
};

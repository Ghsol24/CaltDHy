import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../stores/useAuthStore';
import { authService } from '../services/authService';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';
import {
  AlertTriangleOutlineIcon
} from '../components/ui/AppIcons';
import { useTranslation } from '../i18n/useTranslation';

function getPasswordStrength(pw, t) {
  if (!pw) return { level: 0, label: '—', cls: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: t('auth.weak'), cls: 'pw-weak' };
  if (score <= 2) return { level: 2, label: t('auth.medium'), cls: 'pw-medium' };
  return { level: 3, label: t('auth.strong'), cls: 'pw-strong' };
}

export const SignupPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const invitedEmail = searchParams.get('email') || '';
  const validInviteLink = /^[a-f0-9]{64}$/.test(inviteToken);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState('checking');

  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    authService.registration().then(data => {
      if (active) setRegistrationStatus(data.inviteOnly === true ? 'invite' : 'open');
    }).catch(() => {
      if (active) setRegistrationStatus('error');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => { if (invitedEmail) setEmail(invitedEmail); }, [invitedEmail]);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const pwStrength = getPasswordStrength(password, t);
  const isPwValid = password.length >= 12 && new TextEncoder().encode(password).length <= 72;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(t('auth.enterName'));
      return;
    }
    if (!isEmailValid) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (password.length < 12) {
      setError(t('auth.passwordMin'));
      return;
    }

    setIsSubmitting(true);

    try {
      await register(name.trim(), email.trim(), password, inviteToken);
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
      <main>
        <IndustrialPanel title={t('auth.createAccount')} titleHighlight="">
          {registrationStatus === 'checking' && (
            <p className="signup-invite-message" role="status">{t('auth.registrationChecking')}</p>
          )}
          {registrationStatus === 'error' && (
            <p className="signup-invite-message" role="alert">{t('auth.registrationUnavailable')}</p>
          )}
          {registrationStatus === 'invite' && !validInviteLink && (
            <p className="signup-invite-message" role="status">{t('auth.inviteRequired')}</p>
          )}
          {(registrationStatus === 'open' || (registrationStatus === 'invite' && validInviteLink)) && (
          <form id="signupForm" onSubmit={handleSubmit} noValidate>
            {registrationStatus === 'invite' && (
              <p className="signup-invite-message">{t('auth.inviteEmail')}</p>
            )}
            <FloatingInput
              id="fullName"
              type="text"
              label={t('auth.fullName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              isValid={isNameValid}
              autoComplete="name"
              required
            />

            <FloatingInput
              id="emailIn"
              type="email"
              label={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isValid={isEmailValid}
              autoComplete="email"
              required
              readOnly={registrationStatus === 'invite' && Boolean(invitedEmail)}
            />

            <FloatingInput
              id="pwIn"
              type="password"
              label={t('auth.password12')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isPwValid}
              autoComplete="new-password"
              required
            />

            {password && (
              <div id="pwStrength" className={`pw-strength ${pwStrength.cls}`}>
                <div className="pw-bar-wrap">
                  <div className="pw-bar"></div>
                </div>
                <span className="pw-txt" id="pwLabel">
                  {pwStrength.label}
                </span>
              </div>
            )}

            {error && (
              <div id="formErr" className="form-err show" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} role="alert">
                <AlertTriangleOutlineIcon size={14} /> {error}
              </div>
            )}

            <button type="submit" className={`btn-cta ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{isSubmitting ? t('auth.creating') : t('auth.createAccount')}</span>
            </button>

          </form>
          )}

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
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="lnk">
              {t('auth.login')}
            </Link>
          </p>
        </IndustrialPanel>
      </main>
    </div>
  );
};

import { getUserErrorMessage } from '../utils/userErrors.js';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../stores/useAuthStore';
import { useSignatureLoginStore } from '../stores/useSignatureLoginStore';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';
import { Icon, ClockOutlineIcon, AlertTriangleOutlineIcon } from '../components/ui/AppIcons';
import { useTranslation } from '../i18n/useTranslation';
import { SocialLogin } from '../components/auth/SocialLogin';
import { LegalLinks } from '../components/auth/LegalLinks';
import { OAuthConfirm } from '../components/auth/OAuthConfirm';
import { getSocialCopy, socialErrorText } from '../components/auth/socialLoginCopy';
import './auth.css';

const OFFLINE_COPY = {
  vi: 'Không có kết nối Internet. Hãy kiểm tra mạng rồi đăng nhập lại.',
  en: 'No Internet connection. Check your network, then sign in again.',
  'zh-CN': '没有网络连接。请检查网络后重新登录。'
};
const subscribeOnline = (listener) => {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};

// Second sign-in step, shown only to accounts that turned two-factor sign-in on.
const TOTP_COPY = {
  vi: { label: 'Mã xác thực 6 số', hint: 'Mở ứng dụng xác thực để lấy mã. Mất điện thoại? Nhập một mã khôi phục.', needed: 'Nhập mã 6 số từ ứng dụng xác thực để tiếp tục.' },
  en: { label: '6-digit verification code', hint: 'Open your authenticator app for the code. Lost your phone? Enter a recovery code.', needed: 'Enter the 6-digit code from your authenticator app to continue.' },
  'zh-CN': { label: '6 位验证码', hint: '请打开身份验证器应用获取验证码。手机丢失？请输入恢复代码。', needed: '请输入身份验证器应用中的 6 位验证码以继续。' }
};

export const LoginPage = () => {
  const { t, lang } = useTranslation();
  const totpCopy = TOTP_COPY[lang] || (String(lang).startsWith('zh') ? TOTP_COPY['zh-CN'] : TOTP_COPY.vi);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true);
  const offlineText = OFFLINE_COPY[lang] || (String(lang).startsWith('zh') ? OFFLINE_COPY['zh-CN'] : OFFLINE_COPY.vi);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isExpired = searchParams.get('expired') === '1';
  // Where a Google/Facebook sign-in landed: done (signed in), link / verify (needs confirmation), or an error code.
  const socialCopy = getSocialCopy(lang);
  const oauthStep = searchParams.get('oauth');
  const oauthErrorCode = searchParams.get('oauth_error');
  const authStatus = useAuthStore((state) => state.status);
  const leaveOAuthStep = () => setSearchParams({}, { replace: true });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
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

  useEffect(() => {
    if (oauthStep !== 'done') return;
    if (authStatus === 'authenticated') navigate('/spending/home', { replace: true });
    // The server said "signed in" but this browser has no session (for example cookies are blocked).
    else if (authStatus === 'anonymous') setSearchParams({ oauth_error: 'failed' }, { replace: true });
  }, [oauthStep, authStatus, navigate, setSearchParams]);

  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const isPwValid = password.length >= 1;
  const oauthError = oauthErrorCode && !error && !isSubmitting ? socialErrorText(socialCopy, oauthErrorCode) : '';

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
    if (needsCode && !totpCode.trim()) {
      setError(totpCopy.needed);
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
      await login(email.trim(), password, { signal: controller.signal, totpCode: needsCode ? totpCode.trim() : undefined });
      if (attemptRef.current !== attempt) return;
      window.clearTimeout(attempt.timeout);
      attemptRef.current = null;
      succeedSignature(id);
    } catch (err) {
      if (attemptRef.current !== attempt) return;
      window.clearTimeout(attempt.timeout);
      attemptRef.current = null;
      failSignature(id);
      // The password was right; the account just needs its second step. Not an error to alarm about.
      if (err?.code === 'TOTP_REQUIRED') { setNeedsCode(true); setError(''); }
      else setError(attempt.timedOut ? t('auth.loginTimeout') : getUserErrorMessage(err, 'error.generic'));
      setIsSubmitting(false);
    }
  };

  if (oauthStep === 'link' || oauthStep === 'verify') {
    return <div className="auth-page"><main><OAuthConfirm onExit={leaveOAuthStep} /></main></div>;
  }
  if (oauthStep === 'done') {
    return (
      <div className="auth-page"><main><IndustrialPanel>
        <p className="oauth-note" role="status" aria-live="polite">{socialCopy.finishing}</p>
      </IndustrialPanel></main></div>
    );
  }

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

            {needsCode && <div className="totp-step">
              <FloatingInput
                id="totpIn"
                type="text"
                label={totpCopy.label}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                isValid={totpCode.trim().length >= 6}
                autoComplete="one-time-code"
                required
              />
              <p className="totp-hint" role="status">{totpCopy.hint}</p>
            </div>}

            <div className="forgot-row">
              <Link to="/reset-password" className="forgot-lnk">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {!online && !error && (
              <div className="form-err form-err--warning form-err--icon show" role="status">
                <AlertTriangleOutlineIcon size={14} /> {offlineText}
              </div>
            )}

            {isExpired && online && !error && (
              <div className="form-err form-err--warning form-err--icon show" role="status">
                <ClockOutlineIcon size={14} /> {t('error.authExpired')}
              </div>
            )}

            {error && (
              <div id="formErr" className="form-err form-err--icon show" role="alert">
                <AlertTriangleOutlineIcon size={14} /> {error}
              </div>
            )}

            {oauthError && (
              <div id="oauthErr" className="form-err form-err--icon show" role="alert">
                <AlertTriangleOutlineIcon size={14} /> {oauthError}
              </div>
            )}

            <button type="submit" className={`btn-cta ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{isSubmitting ? t('auth.loggingIn') : t('auth.login')}</span>
            </button>

          </form>

          <SocialLogin />

          <div className="divider">
            <span>{t('auth.or')}</span>
          </div>

          <Link to="/" className="btn-ghost">
            <Icon name="chevronLeft" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            {t('auth.backHome')}
          </Link>

          <p className="mod-footer">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="lnk">
              {t('auth.signup')}
            </Link>
          </p>
          <LegalLinks />
        </IndustrialPanel>
      </main>
    </div>
  );
};

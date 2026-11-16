import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { oauthService } from '../../services/oauthFlow';
import { useAuthStore } from '../../stores/useAuthStore';
import { IndustrialPanel } from '../ui/IndustrialPanel';
import { FloatingInput } from '../ui/FloatingInput';
import { AlertTriangleOutlineIcon } from '../ui/AppIcons';
import { useTranslation } from '../../i18n/useTranslation';
import { getUserErrorMessage } from '../../utils/userErrors.js';
import { getSocialCopy } from './socialLoginCopy';

/**
 * Shown after Google / Facebook has confirmed who the person is, but before CaltDHy signs them in:
 *  - "link": the email belongs to an existing password account. Nothing is merged until the person
 *    proves they own that account by entering its password.
 *  - "totp": the account has two-factor sign-in on, which a social sign-in must not bypass.
 */
export function OAuthConfirm({ onExit }) {
  const { lang } = useTranslation();
  const copy = getSocialCopy(lang);
  const navigate = useNavigate();
  const completeOAuth = useAuthStore((state) => state.completeOAuth);
  const [pending, setPending] = useState(undefined); // undefined: loading, null: nothing to confirm
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    oauthService.pending().then((data) => {
      if (!active) return;
      const next = data.pending && ['link', 'totp'].includes(data.pending.kind) ? data.pending : null;
      setPending(next);
      setNeedsCode(next?.kind === 'totp');
    }).catch(() => { if (active) setPending(null); });
    return () => { active = false; };
  }, []);

  const cancel = () => {
    void oauthService.cancel().catch(() => {});
    onExit();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !pending) return;
    setError('');
    if (pending.kind === 'link' && !password) { setError(copy.needPassword); return; }
    if (needsCode && !code.trim()) { setError(copy.needCode); return; }
    setBusy(true);
    void import('../../pages/SpendingPage').catch(() => {});
    try {
      await completeOAuth({
        ...(pending.kind === 'link' ? { password } : {}),
        ...(needsCode ? { totpCode: code.trim() } : {}),
      });
      navigate('/spending/home', { replace: true });
    } catch (cause) {
      // The password was right; the account just needs its second step.
      if (cause?.code === 'TOTP_REQUIRED') setNeedsCode(true);
      else if (cause?.code === 'OAUTH_EXPIRED') setPending(null);
      else setError(getUserErrorMessage(cause, 'error.generic'));
      setBusy(false);
    }
  };

  if (pending === undefined) {
    return <IndustrialPanel><p className="oauth-note" role="status">{copy.loading}</p></IndustrialPanel>;
  }
  if (pending === null) {
    return (
      <IndustrialPanel>
        <div className="form-err form-err--warning form-err--icon show" role="alert">
          <AlertTriangleOutlineIcon size={14} /> {copy.expired}
        </div>
        <button type="button" className="btn-ghost" onClick={onExit}>{copy.backToLogin}</button>
      </IndustrialPanel>
    );
  }
  const linking = pending.kind === 'link';
  return (
    <IndustrialPanel title={linking ? copy.linkTitle : copy.verifyTitle} titleHighlight={linking ? copy.linkHighlight : copy.verifyHighlight}>
      <p className="oauth-note">{(linking ? copy.linkBody : copy.verifyBody)(pending.provider, pending.email)}</p>
      <form id="oauthConfirmForm" onSubmit={submit} noValidate>
        {/* Lets password managers match the saved CaltDHy login for this email. */}
        <input type="email" name="username" autoComplete="username" value={pending.email} readOnly hidden />
        {linking && (
          <FloatingInput id="oauthPwIn" type="password" label={copy.password} value={password}
            onChange={(event) => setPassword(event.target.value)} isValid={password.length >= 1}
            autoComplete="current-password" required />
        )}
        {needsCode && (
          <div className="totp-step">
            <FloatingInput id="oauthTotpIn" type="text" label={copy.code} value={code}
              onChange={(event) => setCode(event.target.value)} isValid={code.trim().length >= 6}
              autoComplete="one-time-code" required />
            <p className="totp-hint" role="status">{copy.codeHint}</p>
          </div>
        )}
        {error && (
          <div className="form-err form-err--icon show" role="alert">
            <AlertTriangleOutlineIcon size={14} /> {error}
          </div>
        )}
        <button type="submit" className={`btn-cta ${busy ? 'loading' : ''}`} disabled={busy}>
          <span className="spinner" aria-hidden="true"></span>
          <span className="btn-text">{busy ? copy.working : linking ? copy.confirmLink : copy.confirmVerify}</span>
        </button>
      </form>
      <button type="button" className="btn-ghost oauth-cancel" onClick={cancel} disabled={busy}>{copy.cancel}</button>
    </IndustrialPanel>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { securityService as authService } from '../../../services/securityService';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatRelativeDateTime } from '../../../utils/formatters';
import { getUserErrorMessage } from '../../../utils/userErrors';
import { Button } from '../../../components/ui/Button';
import { getSecurityCopy } from './securityCopy';
import './security-extras.css';

const problem = (error, copy) => ([400, 404, 409].includes(error?.status) ? getUserErrorMessage(error) : copy.failed);
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
function describeDevice(userAgent, copy) {
  const ua = userAgent || '';
  if (!ua) return copy.unknownDevice;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS|Macintosh/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return browser && os ? copy.deviceOn(browser, os) : browser || os || ua.slice(0, 40);
}

/** Turn two-factor sign-in on (password → authenticator → code → recovery codes) or off. */
export function TwoFactorPanel() {
  const { lang } = useTranslation();
  const copy = getSecurityCopy(lang);
  const enabled = useAuthStore((state) => Boolean(state.user?.twoFactorEnabled));
  const [step, setStep] = useState(null); // 'password' | 'verify' | 'recovery' | 'disable'
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');

  const setEnabled = (value) => useAuthStore.setState((state) => (state.user ? { user: { ...state.user, twoFactorEnabled: value } } : state));
  const reset = () => { setStep(null); setPassword(''); setCode(''); setSetup(null); setRecoveryCodes([]); setError(''); };
  const run = async (action) => {
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(problem(cause, copy)); } finally { setBusy(false); }
  };
  const start = (event) => { event.preventDefault(); return run(async () => {
    const response = await authService.setupTwoFactor(password);
    setSetup({ secret: response.secret, uri: response.otpauthUri }); setPassword(''); setStep('verify');
  }); };
  const verify = (event) => { event.preventDefault(); return run(async () => {
    const response = await authService.enableTwoFactor(code.replace(/\s/g, ''));
    setRecoveryCodes(response.recoveryCodes || []); setEnabled(true); setCode(''); setSetup(null); setStep('recovery');
  }); };
  const disable = (event) => { event.preventDefault(); return run(async () => {
    await authService.disableTwoFactor(password, code.trim());
    setEnabled(false); reset(); setNotice(copy.tfaDisabled);
  }); };
  const mark = async (key, text) => { if (await copyText(text)) { setCopied(key); setTimeout(() => setCopied(''), 1800); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`CaltDHy recovery codes\n\n${recoveryCodes.join('\n')}\n`], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'caltdhy-recovery-codes.txt';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const passwordField = <div className="account-form-group">
    <label htmlFor="tfa-password" className="account-label">{copy.password}</label>
    <input id="tfa-password" className="account-input" type="password" autoComplete="current-password" value={password}
      onChange={(event) => setPassword(event.target.value)} required />
  </div>;
  const errorBox = error && <div className="account-feedback-msg error" role="alert">{error}</div>;

  return <div className="account-card-panel security-panel">
    <div className="account-card-panel-row">
      <div>
        <div className="account-panel-label">{copy.tfaTitle}</div>
        <p className="security-text">{copy.tfaIntro}</p>
      </div>
      <span className={`security-badge${enabled ? ' is-on' : ''}`}>{enabled ? copy.tfaOn : copy.tfaOff}</span>
    </div>
    {notice && !step && <div className="account-feedback-msg success" role="status">{notice}</div>}

    {!step && <div className="security-actions">
      {enabled
        ? <Button variant="danger-outline" onClick={() => { setNotice(''); setStep('disable'); }}>{copy.tfaDisable}</Button>
        : <Button variant="primary" onClick={() => { setNotice(''); setStep('password'); }}>{copy.tfaEnable}</Button>}
    </div>}

    {step === 'password' && <form className="security-form" onSubmit={start}>
      {passwordField}{errorBox}
      <div className="security-actions">
        <Button onClick={reset} disabled={busy}>{copy.cancel}</Button>
        <Button variant="primary" type="submit" loading={busy} disabled={!password}>{copy.continue}</Button>
      </div>
    </form>}

    {step === 'verify' && setup && <form className="security-form" onSubmit={verify}>
      <strong className="security-step">{copy.tfaStep1}</strong>
      <a className="btn btn--secondary security-link" href={setup.uri}>{copy.tfaOpenApp}</a>
      <p className="security-text">{copy.tfaManual}</p>
      <div className="security-secret">
        <code>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
        <Button size="sm" onClick={() => mark('secret', setup.secret)}>{copied === 'secret' ? copy.copied : copy.copy}</Button>
      </div>
      <strong className="security-step">{copy.tfaStep2}</strong>
      <div className="account-form-group">
        <label htmlFor="tfa-code" className="account-label">{copy.code}</label>
        <input id="tfa-code" className="account-input security-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
          placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/[^\d\s]/g, ''))} />
      </div>
      {errorBox}
      <div className="security-actions">
        <Button onClick={reset} disabled={busy}>{copy.cancel}</Button>
        <Button variant="primary" type="submit" loading={busy} disabled={code.replace(/\s/g, '').length !== 6}>{copy.confirm}</Button>
      </div>
    </form>}

    {step === 'recovery' && <div className="security-form">
      <strong className="security-step">{copy.tfaRecoveryTitle}</strong>
      <p className="security-text">{copy.tfaRecoveryBody}</p>
      <ul className="security-recovery">{recoveryCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
      <p className="security-text">{copy.tfaEnabledNote}</p>
      <div className="security-actions">
        <Button onClick={() => mark('codes', recoveryCodes.join('\n'))}>{copied === 'codes' ? copy.copied : copy.copy}</Button>
        <Button onClick={download}>{copy.download}</Button>
        <Button variant="primary" onClick={reset}>{copy.done}</Button>
      </div>
    </div>}

    {step === 'disable' && <form className="security-form" onSubmit={disable}>
      <p className="security-text">{copy.tfaDisableBody}</p>
      {passwordField}
      <div className="account-form-group">
        <label htmlFor="tfa-disable-code" className="account-label">{copy.codeOrRecovery}</label>
        <input id="tfa-disable-code" className="account-input security-code" autoComplete="one-time-code" maxLength={20}
          value={code} onChange={(event) => setCode(event.target.value)} />
      </div>
      {errorBox}
      <div className="security-actions">
        <Button onClick={reset} disabled={busy}>{copy.cancel}</Button>
        <Button variant="danger" type="submit" loading={busy} disabled={!password || !code.trim()}>{copy.tfaDisable}</Button>
      </div>
    </form>}
  </div>;
}

/** Every device signed in to the account, with remote sign-out. */
export function SessionsPanel() {
  const { lang } = useTranslation();
  const copy = getSecurityCopy(lang);
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    setStatus('loading');
    authService.listSessions().then((response) => { setSessions(response.data || []); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (key, action, done) => {
    setBusy(key); setMessage(null);
    try { const response = await action(); setMessage({ type: 'success', text: done(response) }); load(); }
    catch (cause) { setMessage({ type: 'error', text: problem(cause, copy) }); }
    finally { setBusy(''); }
  };
  const when = (value) => formatRelativeDateTime(value, { locale: lang });
  const others = sessions.filter((session) => !session.current);

  return <div className="account-card-panel security-panel">
    <div className="account-panel-label">{copy.sessionsTitle}</div>
    {status === 'loading' && sessions.length === 0 && <p className="security-text" role="status">{copy.sessionsLoading}</p>}
    {status === 'error' && <p className="security-text" role="alert">{copy.sessionsFailed} <Button size="sm" onClick={load}>{copy.retry}</Button></p>}
    <ul className="security-sessions">
      {sessions.map((session) => <li key={session.id}>
        <div>
          <strong>{describeDevice(session.userAgent, copy)}</strong>
          <small>{copy.lastSeen(when(session.lastSeenAt))} · {copy.signedIn(when(session.createdAt))}</small>
        </div>
        {session.current
          ? <span className="account-session-badge">{copy.thisDevice}</span>
          : <Button size="sm" variant="danger-outline" loading={busy === session.id} disabled={Boolean(busy)}
            onClick={() => act(session.id, () => authService.revokeSession(session.id), () => copy.revoked)}>{copy.signOut}</Button>}
      </li>)}
    </ul>
    {status === 'ready' && others.length === 0 && <p className="security-text">{copy.onlyThis}</p>}
    {message && <div className={`account-feedback-msg ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}
    {others.length > 1 && <div className="security-actions">
      <Button variant="danger-outline" loading={busy === 'others'} disabled={Boolean(busy)}
        onClick={() => act('others', () => authService.revokeOtherSessions(), (response) => copy.revokedOthers(response.revoked || 0))}>
        {copy.signOutOthers}</Button>
    </div>}
  </div>;
}

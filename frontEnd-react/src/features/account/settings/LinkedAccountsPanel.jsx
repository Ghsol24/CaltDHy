import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { oauthService, takeLinkReturn } from '../../../services/oauthFlow';
import { BrandLogo } from '../../../components/auth/BrandLogo';
import { Button } from '../../../components/ui/Button';
import { useTranslation } from '../../../i18n/useTranslation';
import { getUserErrorMessage } from '../../../utils/userErrors';
import { getLinkedAccountsCopy, linkErrorText, PROVIDER_NAMES } from './linkedAccountsCopy';
import './security-extras.css';

const KNOWN = ['google', 'facebook'];

/**
 * Settings > Data & privacy: link or unlink Google / Facebook for the signed-in account.
 * Linking leaves for the provider and comes back to /spending/home?linked=…, which reopens this tab.
 * Accounts with a password confirm it for both actions; the last way to sign in cannot be removed.
 */
export function LinkedAccountsPanel() {
  const { lang } = useTranslation();
  const copy = getLinkedAccountsCopy(lang);
  const user = useAuthStore((state) => state.user);
  const hasPassword = user?.hasPassword !== false;
  const linked = Array.isArray(user?.linkedProviders) ? user.linkedProviders : [];
  const [enabled, setEnabled] = useState(null); // null while loading
  const [action, setAction] = useState(null); // { provider, kind: 'link' | 'unlink' }
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Result of a link that just came back from the provider, shown once.
  const [notice, setNotice] = useState(() => {
    const result = takeLinkReturn();
    if (!result) return null;
    return result.ok ? { type: 'success', text: copy.done(result.provider) }
      : { type: 'error', text: linkErrorText(copy, result.code, result.provider) };
  });

  useEffect(() => {
    let active = true;
    oauthService.providers().then((data) => {
      if (!active) return;
      // A provider only finishes when the browser is at the address it returns to.
      const usable = data.origin === window.location.origin && Array.isArray(data.providers) ? data.providers : [];
      setEnabled(KNOWN.filter((provider) => usable.includes(provider)));
    }).catch(() => { if (active) setEnabled([]); });
    const restore = () => setBusy(false);
    window.addEventListener('pageshow', restore);
    return () => { active = false; window.removeEventListener('pageshow', restore); };
  }, []);

  // Show providers that can be linked here, plus any already linked (so they can always be removed).
  const rows = enabled === null ? [] : KNOWN.filter((provider) => enabled.includes(provider) || linked.includes(provider));
  const isLast = (provider) => !hasPassword && linked.length === 1 && linked[0] === provider;
  const open = (provider, kind) => { setAction({ provider, kind }); setPassword(''); setError(''); setNotice(null); };
  const close = () => { setAction(null); setPassword(''); setError(''); };

  const submit = async (event) => {
    event.preventDefault();
    if (!action || busy) return;
    if (hasPassword && !password) { setError(copy.needPassword); return; }
    setBusy(true); setError('');
    try {
      if (action.kind === 'link') {
        const data = await oauthService.link(action.provider, hasPassword ? password : '');
        const target = new URL(data.url);
        if (!/^(accounts\.google\.com|www\.facebook\.com)$/.test(target.hostname)) throw new Error('Unexpected address.');
        window.location.assign(target.toString());
        return; // the page is leaving; keep the button busy
      }
      const data = await oauthService.unlink(action.provider, hasPassword ? password : '');
      useAuthStore.setState((state) => (state.user ? { user: { ...state.user, linkedProviders: data.user.linkedProviders,
        hasPassword: data.user.hasPassword } } : state));
      setNotice({ type: 'success', text: copy.unlinked(action.provider) });
      close();
    } catch (cause) {
      setError([400, 404, 409].includes(cause?.status) ? getUserErrorMessage(cause) : copy.failed);
    }
    setBusy(false);
  };

  return (
    <div className="account-card-panel security-panel linked-accounts">
      <div>
        <div className="account-panel-label">{copy.title}</div>
        <p className="security-text">{copy.intro}</p>
      </div>
      {notice && <div className={`account-feedback-msg ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
      {enabled === null && <p className="security-text" role="status">{copy.loading}</p>}
      {enabled !== null && !rows.length && <p className="security-text">{copy.none}</p>}
      {rows.length > 0 && (
        <ul className="linked-accounts__list">
          {rows.map((provider) => {
            const isLinked = linked.includes(provider);
            const editing = action?.provider === provider;
            return (
              <li key={provider} className="linked-accounts__item">
                <div className="linked-accounts__row">
                  <BrandLogo provider={provider} size={24} />
                  <div className="linked-accounts__name">
                    <strong>{PROVIDER_NAMES[provider]}</strong>
                    <span className={`security-badge${isLinked ? ' is-on' : ''}`}>{isLinked ? copy.linked : copy.notLinked}</span>
                  </div>
                  {!editing && (
                    <Button size="sm" variant={isLinked ? 'danger-outline' : 'secondary'} disabled={busy || (isLinked && isLast(provider))}
                      onClick={() => open(provider, isLinked ? 'unlink' : 'link')}>
                      {isLinked ? copy.unlink : copy.link}
                    </Button>
                  )}
                </div>
                {isLinked && isLast(provider) && <p className="security-text">{copy.lastMethod}</p>}
                {editing && (
                  <form className="security-form" onSubmit={submit} noValidate>
                    <p className="security-text">{action.kind === 'link'
                      ? (hasPassword ? copy.linkHint : copy.linkHintNoPassword)(provider)
                      : (hasPassword ? copy.unlinkHint : copy.unlinkHintNoPassword)(provider)}</p>
                    {hasPassword && (
                      <div className="account-form-group">
                        <label htmlFor={`link-password-${provider}`} className="account-label">{copy.password}</label>
                        <input id={`link-password-${provider}`} className="account-input" type="password" autoComplete="current-password"
                          value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
                      </div>
                    )}
                    {error && <div className="account-feedback-msg error" role="alert">{error}</div>}
                    <div className="security-actions">
                      <Button type="submit" variant={action.kind === 'link' ? 'primary' : 'danger'} loading={busy}>
                        {busy && action.kind === 'link' ? copy.leaving(provider)
                          : action.kind === 'link' ? copy.confirmLink(provider) : copy.confirmUnlink(provider)}
                      </Button>
                      <Button onClick={close} disabled={busy}>{copy.cancel}</Button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

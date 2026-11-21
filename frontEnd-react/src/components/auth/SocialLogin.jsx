import React, { useEffect, useRef, useState } from 'react';
import './social-buttons.css';
import { beginOAuth, getCachedOAuthProviders, loadOAuthProviders } from '../../services/oauthFlow';
import { BrandLogo } from './BrandLogo';
import { useTranslation } from '../../i18n/useTranslation';
import { getSocialCopy } from './socialLoginCopy';

/**
 * "Continue with Google / Facebook" buttons. Renders nothing unless the server has that provider
 * configured and will return the browser to this very address (so a local copy of the app, whose
 * provider callback points at the public site, does not offer a button that cannot finish).
 */
export function SocialLogin({ inviteToken = '', providers: controlledProviders }) {
  const { t, lang } = useTranslation();
  const copy = getSocialCopy(lang);
  const isControlled = controlledProviders !== undefined;
  const [uncontrolledProviders, setUncontrolledProviders] = useState(() => getCachedOAuthProviders() || []);
  const [leaving, setLeaving] = useState('');
  const providers = isControlled
    ? (Array.isArray(controlledProviders) ? controlledProviders : [])
    : uncontrolledProviders;
  const hadInitialProviders = useRef(providers.length > 0);

  useEffect(() => {
    let active = true;
    if (!isControlled) {
      loadOAuthProviders().then((list) => {
        if (active) setUncontrolledProviders(list);
      }).catch(() => { /* social sign-in is optional; the password form still works */ });
    }
    // Coming back with the browser's Back button restores this page from cache with the button still busy.
    const restore = () => setLeaving('');
    window.addEventListener('pageshow', restore);
    return () => { active = false; window.removeEventListener('pageshow', restore); };
  }, [isControlled]);

  if (!providers.length) return null;
  return (
    <div className={hadInitialProviders.current ? 'social-login-section' : 'social-login-section social-login-section--reveal'}>
      <div className="divider"><span>{t('auth.or')}</span></div>
      <div className="social-login">
        {providers.map((provider) => (
          <button key={provider} type="button" className={`btn-social btn-social--${provider}`} disabled={Boolean(leaving)}
            data-provider={provider}
            onClick={() => { setLeaving(provider); beginOAuth(provider, inviteToken); }}>
            <BrandLogo provider={provider} variant={provider === "facebook" ? "secondary" : "primary"} />
            <span>{leaving === provider ? copy.leaving(provider) : copy.continueWith(provider)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

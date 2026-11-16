import React, { useEffect, useState } from 'react';
import './social-buttons.css';
import { beginOAuth, oauthService } from '../../services/oauthFlow';
import { BrandLogo } from './BrandLogo';
import { useTranslation } from '../../i18n/useTranslation';
import { getSocialCopy } from './socialLoginCopy';

const KNOWN = ['google', 'facebook'];

/**
 * "Continue with Google / Facebook" buttons. Renders nothing unless the server has that provider
 * configured and will return the browser to this very address (so a local copy of the app, whose
 * provider callback points at the public site, does not offer a button that cannot finish).
 */
export function SocialLogin({ inviteToken = '' }) {
  const { t, lang } = useTranslation();
  const copy = getSocialCopy(lang);
  const [providers, setProviders] = useState([]);
  const [leaving, setLeaving] = useState('');

  useEffect(() => {
    let active = true;
    oauthService.providers().then((data) => {
      if (!active || data.origin !== window.location.origin || !Array.isArray(data.providers)) return;
      setProviders(KNOWN.filter((provider) => data.providers.includes(provider)));
    }).catch(() => { /* social sign-in is optional; the password form still works */ });
    // Coming back with the browser's Back button restores this page from cache with the button still busy.
    const restore = () => setLeaving('');
    window.addEventListener('pageshow', restore);
    return () => { active = false; window.removeEventListener('pageshow', restore); };
  }, []);

  if (!providers.length) return null;
  return (
    <>
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
    </>
  );
}

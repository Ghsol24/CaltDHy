import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useThemeStore } from '../stores/useThemeStore';
import { useLangStore } from '../stores/useLangStore';
import { useCurrencyStore } from '../stores/useCurrencyStore';
import { useAuthStore } from '../stores/useAuthStore';
import { BrandMark } from '../components/ui/BrandMark';
import { PublicTopbar } from '../components/layout/PublicTopbar';
import { prefetchOAuthProviders } from '../services/oauthFlow';
import {
  getCachedRegistrationStatus,
  loadRegistrationStatus,
  prefetchLoginRoute,
  prefetchSignupRoute,
} from '../services/authBootstrap';
import { getLandingCopy } from '../features/landing/landingCopy';
import { LandingIcon } from '../features/landing/LandingIcons';
import { LandingAppPreview } from '../features/landing/LandingAppPreview';
import { LandingSections } from '../features/landing/LandingSections';
import { cancelSmoothScroll, smoothScrollToHash } from '../utils/smoothScroll';
import './landing.css';

export function LandingPage() {
  const { hash } = useLocation();
  const { theme, setTheme } = useThemeStore();
  const lang = useLangStore((state) => state.lang);
  const setLang = useLangStore((state) => state.setLang);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  useCurrencyStore((state) => state.displayCurrency);

  const [registrationMode, setRegistrationMode] = useState(() => getCachedRegistrationStatus());

  const copy = getLandingCopy(lang);
  const isInviteOnly = registrationMode === 'invite';

  // Scroll cleanly to hash section when navigating from /login or /signup via Topbar links.
  useEffect(() => {
    if (!hash || hash === '#top') return undefined;
    const rafId = window.requestAnimationFrame(() => {
      smoothScrollToHash(hash, null, { updateHistory: false });
    });
    return () => {
      window.cancelAnimationFrame(rafId);
      cancelSmoothScroll();
    };
  }, [hash]);

  // Warm OAuth providers, registration mode, and login chunk while visitor reads the landing page.
  useEffect(() => {
    let active = true;
    prefetchOAuthProviders();
    loadRegistrationStatus()
      .then((status) => {
        if (active) setRegistrationMode(status);
      })
      .catch(() => {});

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(() => {
        prefetchLoginRoute();
      });
      return () => {
        active = false;
        window.cancelIdleCallback?.(idleId);
      };
    }
    const timer = window.setTimeout(() => {
      prefetchLoginRoute();
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="landing-page">
      {/* Soft ambient background aura — shared across Landing & Auth */}
      <div className="pub-aura lp-aura" aria-hidden="true">
        <div className="pub-aura-blob pub-aura-blob--primary" />
        <div className="pub-aura-blob pub-aura-blob--secondary" />
      </div>

      {/* ── SHARED LIQUID GLASS FLOATING TOPBAR ── */}
      <PublicTopbar skipTarget="#landing-main" isInviteOnly={isInviteOnly} />

      {/* ── MAIN CONTENT ── */}
      <main id="top" className="lp-main">
        {/* HERO SECTION */}
        <section className="lp-hero">
          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-badge">
              <LandingIcon name="sparkle" size={14} />
              <span>{copy.hero.badge}</span>
            </div>

            <h1 id="landing-main" tabIndex={-1} className="lp-hero-title">
              {copy.hero.title}
            </h1>

            <p className="lp-hero-subtitle">{copy.hero.subtitle}</p>

            <div className="lp-hero-actions">
              {isAuthenticated ? (
                <>
                  <Link to="/spending/home" className="lp-btn lp-btn--primary lp-btn--lg">
                    <span>{copy.hero.ctaOpenApp}</span>
                    <LandingIcon name="arrowRight" size={16} strokeWidth={2.1} />
                  </Link>
                  <a
                    href="#features"
                    className="lp-btn lp-btn--secondary lp-btn--lg"
                    onClick={(event) => smoothScrollToHash('#features', event)}
                  >
                    <span>{copy.hero.ctaExplore}</span>
                  </a>
                </>
              ) : isInviteOnly ? (
                <>
                  <Link
                    to="/login"
                    className="lp-btn lp-btn--primary lp-btn--lg"
                    onPointerEnter={prefetchLoginRoute}
                    onFocus={prefetchLoginRoute}
                    onTouchStart={prefetchLoginRoute}
                  >
                    <span>{copy.hero.ctaLogin}</span>
                    <LandingIcon name="arrowRight" size={16} strokeWidth={2.1} />
                  </Link>
                  <Link
                    to="/signup"
                    className="lp-btn lp-btn--secondary lp-btn--lg"
                    onPointerEnter={prefetchSignupRoute}
                    onFocus={prefetchSignupRoute}
                    onTouchStart={prefetchSignupRoute}
                  >
                    <span>{copy.hero.ctaInviteSignup}</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="lp-btn lp-btn--primary lp-btn--lg"
                    onPointerEnter={prefetchSignupRoute}
                    onFocus={prefetchSignupRoute}
                    onTouchStart={prefetchSignupRoute}
                  >
                    <span>{copy.hero.ctaSignup}</span>
                    <LandingIcon name="arrowRight" size={16} strokeWidth={2.1} />
                  </Link>
                  <Link
                    to="/login"
                    className="lp-btn lp-btn--secondary lp-btn--lg"
                    onPointerEnter={prefetchLoginRoute}
                    onFocus={prefetchLoginRoute}
                    onTouchStart={prefetchLoginRoute}
                  >
                    <span>{copy.hero.ctaLogin}</span>
                  </Link>
                </>
              )}
            </div>

            <p className="lp-hero-note">
              {isInviteOnly && !isAuthenticated ? copy.hero.noteInvite : copy.hero.note}
            </p>
          </div>

          {/* Interactive Live-Token Product Showcase Window */}
          <div className="lp-container lp-showcase-wrap">
            <LandingAppPreview copy={copy} lang={lang} />
          </div>
        </section>

        {/* FULL PRODUCT SECTIONS */}
        <LandingSections
          copy={copy}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          isAuthenticated={isAuthenticated}
          isInviteOnly={isInviteOnly}
          onPrefetchLogin={prefetchLoginRoute}
          onPrefetchSignup={prefetchSignupRoute}
        />
      </main>

      {/* ── FLOATING FROSTED FOOTER CARD OVER RISING ORGANIC GRADIENT ── */}
      <footer className="lp-footer-zone">
        <div className="lp-footer-glow" aria-hidden="true" />
        <div className="lp-container">
          <div className="lp-footer-card lp-glass">
            <div className="lp-footer-grid">
              <div className="lp-footer-brand">
                <a
                  href="#top"
                  className="lp-footer-logo"
                  onClick={(event) => smoothScrollToHash('#top', event)}
                >
                  <BrandMark className="lp-brand-mark" />
                  <span className="lp-brand-wordmark">
                    Calt<span className="lp-brand-accent">D</span>Hy
                  </span>
                </a>
                <p className="lp-footer-tagline">{copy.footer.tagline}</p>
              </div>

              <div className="lp-footer-col">
                <p className="lp-footer-col-title">{copy.footer.colProduct}</p>
                <a href="#features" className="lp-footer-link" onClick={(e) => smoothScrollToHash('#features', e)}>{copy.footer.features}</a>
                <a href="#wallet-flow" className="lp-footer-link" onClick={(e) => smoothScrollToHash('#wallet-flow', e)}>{copy.footer.walletFlow}</a>
                <a href="#themes" className="lp-footer-link" onClick={(e) => smoothScrollToHash('#themes', e)}>{copy.footer.themes}</a>
                <a href="#security" className="lp-footer-link" onClick={(e) => smoothScrollToHash('#security', e)}>{copy.footer.security}</a>
                <a href="#faq" className="lp-footer-link" onClick={(e) => smoothScrollToHash('#faq', e)}>{copy.footer.faq}</a>
              </div>

              <div className="lp-footer-col">
                <p className="lp-footer-col-title">{copy.footer.colAccount}</p>
                {isAuthenticated ? (
                  <Link to="/spending/home" className="lp-footer-link">{copy.footer.openApp}</Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="lp-footer-link"
                      onPointerEnter={prefetchLoginRoute}
                      onFocus={prefetchLoginRoute}
                    >
                      {copy.footer.login}
                    </Link>
                    <Link
                      to="/signup"
                      className="lp-footer-link"
                      onPointerEnter={prefetchSignupRoute}
                      onFocus={prefetchSignupRoute}
                    >
                      {copy.footer.signup}
                    </Link>
                    <Link to="/reset-password" className="lp-footer-link">
                      {copy.footer.reset}
                    </Link>
                  </>
                )}
              </div>

              <div className="lp-footer-col">
                <p className="lp-footer-col-title">{copy.footer.colLegal}</p>
                <Link to="/terms" className="lp-footer-link">{copy.footer.terms}</Link>
                <Link to="/privacy" className="lp-footer-link">{copy.footer.privacy}</Link>
              </div>
            </div>

            <div className="lp-footer-bottom">
              <span>© {year} CaltDHy</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useThemeStore } from '../../stores/useThemeStore';
import { useLangStore } from '../../stores/useLangStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { BrandMark } from '../ui/BrandMark';
import { LandingIcon } from '../../features/landing/LandingIcons';
import { LandingSettingsModal } from '../../features/landing/LandingSettingsModal';
import { prefetchLoginRoute, prefetchSignupRoute } from '../../services/authBootstrap';
import {
  getPreferredLightTheme,
  rememberLightTheme,
  switchThemeWithTransition,
} from '../../utils/themeTransition';
import { smoothScrollToHash } from '../../utils/smoothScroll';
import { getPublicNavCopy } from './publicNavCopy';
import './public-topbar.css';

const NAV_LINKS = [
  { id: 'features', hash: '#features' },
  { id: 'themes', hash: '#themes' },
  { id: 'security', hash: '#security' },
  { id: 'faq', hash: '#faq' },
];

const LANG_SHORT = {
  vi: 'VI',
  en: 'EN',
  'zh-CN': 'ZH',
};

const THEME_ARIA = {
  vi: { group: 'Chuyển nhanh sáng / tối', light: 'Chế độ sáng', dark: 'Chế độ tối' },
  en: { group: 'Quick light / dark switch', light: 'Light mode', dark: 'Dark mode' },
  'zh-CN': { group: '快速切换浅色 / 深色', light: '浅色模式', dark: '深色模式' },
};

export function PublicTopbar({ skipTarget = '#main-content', isInviteOnly = false }) {
  const { pathname } = useLocation();
  const { theme, setTheme } = useThemeStore();
  const lang = useLangStore((state) => state.lang);
  const setLang = useLangStore((state) => state.setLang);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const headerRef = useRef(null);

  const copy = getPublicNavCopy(lang);
  const themeAria = THEME_ARIA[lang] || THEME_ARIA.vi;
  const isLanding = pathname === '/';
  const isLoginRoute = pathname === '/login';
  const isSignupRoute = pathname === '/signup';
  const isDark = theme === 'dark';

  useEffect(() => {
    rememberLightTheme(theme);
  }, [theme]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMobileNavOpen(false);
    };
    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setIsMobileNavOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileNavOpen]);

  const handleQuickLight = (event) => {
    if (!isDark) return;
    switchThemeWithTransition(getPreferredLightTheme(theme), setTheme, event);
  };

  const handleQuickDark = (event) => {
    if (isDark) return;
    switchThemeWithTransition('dark', setTheme, event);
  };

  const renderSectionLink = (item, className, onClick) => {
    const label = copy.nav[item.id] || (lang === 'en' ? 'FAQ' : lang === 'zh-CN' ? '问答' : 'Hỏi đáp');
    if (isLanding) {
      return (
        <a
          key={item.id}
          href={item.hash}
          className={className}
          onClick={(event) => {
            smoothScrollToHash(item.hash, event);
            onClick?.(event);
          }}
        >
          {label}
        </a>
      );
    }
    return (
      <Link key={item.id} to={`/${item.hash}`} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  };

  return (
    <>
      <a href={skipTarget} className="lp-skip-link">
        {copy.skipToContent}
      </a>

      {/* Soft top edge fade veil under sticky Liquid Glass navbar */}
      <div className="lp-top-fade" aria-hidden="true" />

      <header className="lp-header" ref={headerRef}>
        <div className="lp-header-inner">
          {isLanding ? (
            <a
              href="#top"
              className="lp-brand lp-glass"
              aria-label="CaltDHy"
              onClick={(event) => smoothScrollToHash('#top', event)}
            >
              <BrandMark className="lp-brand-mark" />
              <span className="lp-brand-wordmark">
                Calt<span className="lp-brand-accent">D</span>Hy
              </span>
            </a>
          ) : (
            <Link to="/" className="lp-brand lp-glass" aria-label="CaltDHy">
              <BrandMark className="lp-brand-mark" />
              <span className="lp-brand-wordmark">
                Calt<span className="lp-brand-accent">D</span>Hy
              </span>
            </Link>
          )}

          {/* Centered Liquid Glass Floating Pill Navigation */}
          <nav className="lp-nav-pill lp-glass" aria-label={copy.nav.ariaLabel}>
            {NAV_LINKS.map((item) => renderSectionLink(item, 'lp-nav-link'))}
          </nav>

          {/* Right Liquid Glass Controls */}
          <div className="lp-header-actions">
            {/* Quick Sun/Moon Liquid Glass Toggle with bottom-lit spotlight & View Transition ripple */}
            <div
              className={`lp-mode-pill lp-glass ${isDark ? 'is-dark' : 'is-light'}`}
              role="group"
              aria-label={themeAria.group}
            >
              <button
                type="button"
                className="lp-mode-opt"
                aria-label={themeAria.light}
                aria-pressed={!isDark}
                onClick={handleQuickLight}
              >
                <LandingIcon name="light" size={16} />
              </button>
              <button
                type="button"
                className="lp-mode-opt"
                aria-label={themeAria.dark}
                aria-pressed={isDark}
                onClick={handleQuickDark}
              >
                <LandingIcon name="dark" size={16} />
              </button>
            </div>

            {/* Full 4-Theme + 3-Language Settings Trigger (#idxSettingsBtn) */}
            <button
              type="button"
              className="lp-settings-trigger lp-glass"
              id="idxSettingsBtn"
              onClick={() => {
                setIsMobileNavOpen(false);
                setIsSettingsOpen(true);
              }}
              aria-label={copy.nav.settingsAria}
              aria-haspopup="dialog"
            >
              <LandingIcon name={theme} size={15} className="lp-settings-theme-ico" />
              <span className="lp-settings-lang-code" aria-hidden="true">
                {LANG_SHORT[lang] || 'VI'}
              </span>
            </button>

            {isAuthenticated ? (
              <Link to="/spending/home" className="lp-nav-cta lp-nav-cta--primary">
                <span>{copy.nav.openApp}</span>
                <LandingIcon name="arrowRight" size={14} strokeWidth={2.2} />
              </Link>
            ) : (
              <Link
                to="/login"
                className={`lp-nav-cta lp-glass ${isLoginRoute ? 'is-current' : ''}`}
                aria-current={isLoginRoute ? 'page' : undefined}
                onPointerEnter={prefetchLoginRoute}
                onFocus={prefetchLoginRoute}
                onTouchStart={prefetchLoginRoute}
              >
                <LandingIcon name="logIn" size={14} strokeWidth={2} className="lp-nav-cta-icon" />
                <span>{copy.nav.login}</span>
              </Link>
            )}

            <button
              type="button"
              className="lp-mobile-menu-btn lp-glass"
              aria-expanded={isMobileNavOpen}
              aria-controls="lp-mobile-nav-panel"
              aria-label={isMobileNavOpen ? copy.nav.menuClose : copy.nav.menuOpen}
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
            >
              <LandingIcon name={isMobileNavOpen ? 'close' : 'menu'} size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Floating Liquid Glass Drawer */}
        {isMobileNavOpen && (
          <nav
            id="lp-mobile-nav-panel"
            className="lp-mobile-drawer lp-glass"
            aria-label={copy.nav.mobileAriaLabel}
          >
            <div className="lp-mobile-drawer-links">
              {NAV_LINKS.map((item) =>
                renderSectionLink(item, 'lp-mobile-drawer-link', () => setIsMobileNavOpen(false)),
              )}
            </div>
            {!isAuthenticated && !isSignupRoute && !isInviteOnly && (
              <div className="lp-mobile-drawer-foot">
                <Link
                  to="/signup"
                  className="lp-mobile-drawer-cta"
                  onClick={() => setIsMobileNavOpen(false)}
                  onPointerEnter={prefetchSignupRoute}
                  onFocus={prefetchSignupRoute}
                  onTouchStart={prefetchSignupRoute}
                >
                  <span>{copy.auth.ctaSignup}</span>
                  <LandingIcon name="arrowRight" size={15} strokeWidth={2.1} />
                </Link>
              </div>
            )}
          </nav>
        )}
      </header>

      <LandingSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        copy={copy}
      />
    </>
  );
}

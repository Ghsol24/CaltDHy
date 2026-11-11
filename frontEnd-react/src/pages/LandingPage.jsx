import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useThemeStore } from '../stores/useThemeStore';
import { THEME_OPTIONS } from '../utils/themes';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useLangStore } from '../stores/useLangStore';
import { useCurrencyStore } from '../stores/useCurrencyStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translate } from '../i18n/translations';
import './landing.css';
import { Icon } from '../components/ui/AppIcons';

const LANDING_KEYS = [
  'eyebrow', 'tagline', 'totalBalance', 'transactions', 'vsLastMo',
  'loginBtn', 'signupBtn', 'previewTitle', 'previewLive', 'previewIncome',
  'previewExpenses', 'previewFood', 'previewTransport', 'previewSalary',
  'settingsTitle', 'langLabel', 'themeLabel', 'doneBtn',
];

export function LandingPage() {
  const { theme, setTheme } = useThemeStore();
  const lang = useLangStore((state) => state.lang);
  const setLang = useLangStore((state) => state.setLang);
  useCurrencyStore((state) => state.displayCurrency);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  useFocusTrap(settingsRef, isSettingsOpen);
  useBodyScrollLock(isSettingsOpen);
  const deviceWrapRef = useRef(null);
  const deviceBezelRef = useRef(null);

  const t = Object.fromEntries(LANDING_KEYS.map((key) => [key, translate(lang, `landing.${key}`)]));

  // Sync lang change to localStorage and html tag
  const handleSetLang = (newLang) => {
    setLang(newLang);
  };

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

  // Dynamic month label
  const now = new Date();
  const monthStr = formatDate(now, 'month', { locale: lang }).toLocaleUpperCase(lang);
  const dateLabelText = `${t.previewTitle} // ${monthStr}`;

  // 3D Tilt Effect
  const handleMouseMove = (e) => {
    if (!deviceWrapRef.current || !deviceBezelRef.current) return;
    const rect = deviceWrapRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const rx = -dy * 8;
    const ry = dx * 8;
    deviceBezelRef.current.style.animation = 'none';
    deviceBezelRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  };

  const handleMouseLeave = () => {
    if (!deviceBezelRef.current) return;
    deviceBezelRef.current.style.animation = '';
    deviceBezelRef.current.style.transform = '';
  };

  // Ripple effect on CTA button click
  const handleButtonClick = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.style.cssText = [
      'position:absolute',
      'border-radius:50%',
      'background:rgba(255,255,255,.25)',
      'width:10px',
      'height:10px',
      'pointer-events:none',
      'animation:ripple 600ms linear',
      `left:${e.clientX - rect.left - 5}px`,
      `top:${e.clientY - rect.top - 5}px`
    ].join(';');
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  };

  return (
    <div className="landing-page landing-page--box">
      {/* ── ANIMATED BACKGROUND ORBS ── */}
      <div className="bg-orb bg-orb--1" aria-hidden="true"></div>
      <div className="bg-orb bg-orb--2" aria-hidden="true"></div>

      {/* ── CORNER SCREWS ── */}
      <div className="screw screw-tl" aria-hidden="true"></div>
      <div className="screw screw-tr" aria-hidden="true"></div>
      <div className="screw screw-bl" aria-hidden="true"></div>
      <div className="screw screw-br" aria-hidden="true"></div>

      {/* ── SETTINGS GEAR BUTTON (top-right) ── */}
      <button
        className="idx-settings-btn"
        id="idxSettingsBtn"
        onClick={() => setIsSettingsOpen(true)}
        aria-label={t.settingsTitle}
        aria-haspopup="dialog"
      >
        <Icon name="gearLanding" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
      </button>

      {/* ── MAIN HERO ── */}
      <main className="hero-wrapper" role="main">
        {/* LEFT — COPY & CTA */}
        <section className="hero-content" aria-labelledby="brand-heading">
          <div className="brand-lockup">
            <p className="brand-eyebrow">{t.eyebrow}</p>
            <h1 className="brand-name" id="brand-heading">
              Calt<span>D</span>Hy
            </h1>
            <p className="brand-tagline">{t.tagline}</p>
          </div>

          {/* Metric badges */}
          <div className="metric-strip" role="complementary" aria-label="System metrics">
            <div className="metric-badge">
              <span className="metric-value">{formatCurrency(24811500)}</span>
              <span className="metric-label">{t.totalBalance}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-value">312</span>
              <span className="metric-label">{t.transactions}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-value metric-value--accent">↓ 7.2%</span>
              <span className="metric-label">{t.vsLastMo}</span>
            </div>
          </div>

          {/* Vent slots */}
          <div className="vent-group" aria-hidden="true">
            <div className="vent-slot"></div>
            <div className="vent-slot"></div>
            <div className="vent-slot"></div>
          </div>

          {/* PRIMARY CTAs */}
          <div className="cta-row">
            <Link to="/login" className="btn-login" role="button" onClick={handleButtonClick}>
              <Icon name="logIn" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
              <span>{t.loginBtn}</span>
            </Link>
            <Link to="/signup" className="btn-signup" role="button" onClick={handleButtonClick}>
              {t.signupBtn}
            </Link>
          </div>
        </section>

        {/* RIGHT — 3D DEVICE MOCKUP */}
        <aside
          className="device-wrap"
          ref={deviceWrapRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          aria-label="App preview"
          role="complementary"
        >
          <div className="device-bezel" ref={deviceBezelRef}>
            <div className="device-topbar">
              <div className="device-dots" aria-hidden="true">
                <div className="device-dot red"></div>
                <div className="device-dot yellow"></div>
                <div className="device-dot green"></div>
              </div>
              <div className="device-title-bar">CALTDHY // FINANCE_OS</div>
              <div className="device-signal" aria-hidden="true">
                <div className="signal-bar"></div>
                <div className="signal-bar"></div>
                <div className="signal-bar"></div>
                <div className="signal-bar"></div>
              </div>
            </div>

            <div className="device-screen" role="img" aria-label={translate(lang, 'landing.previewAria')}>
              <div className="screen-header">
                <span className="screen-label" id="screenDateLabel">
                  {dateLabelText}
                </span>
                <div className="screen-led">
                  <div className="screen-led-dot"></div>
                  <span className="screen-led-text">{t.previewLive}</span>
                </div>
              </div>

              <div className="screen-balance">
                <span className="balance-label">{t.totalBalance}</span>
                <span className="balance-amount">
                  {formatCurrency(24811500)}
                </span>
              </div>

              <div className="screen-metrics">
                <div className="screen-metric">
                  <div className="sm-label">{t.previewIncome}</div>
                  <div className="sm-value income">{formatCurrency(6200000, { showSign: true, isIncome: true })}</div>
                </div>
                <div className="screen-metric">
                  <div className="sm-label">{t.previewExpenses}</div>
                  <div className="sm-value expense">{formatCurrency(1843000, { showSign: true })}</div>
                </div>
              </div>

              <div className="screen-txns">
                <div className="screen-txn">
                  <span className="txn-name">{t.previewFood}</span>
                  <div className="txn-bar">
                    <div className="txn-bar-fill txn-bar-fill--box"></div>
                  </div>
                  <span className="txn-amount neg">{formatCurrency(340000, { showSign: true })}</span>
                </div>
                <div className="screen-txn">
                  <span className="txn-name">{t.previewTransport}</span>
                  <div className="txn-bar">
                    <div className="txn-bar-fill txn-bar-fill--box2"></div>
                  </div>
                  <span className="txn-amount neg">{formatCurrency(180000, { showSign: true })}</span>
                </div>
                <div className="screen-txn">
                  <span className="txn-name">{t.previewSalary}</span>
                  <div className="txn-bar">
                    <div className="txn-bar-fill txn-bar-fill--box3"></div>
                  </div>
                  <span className="txn-amount pos">{formatCurrency(6200000, { showSign: true, isIncome: true })}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* ── SETTINGS MODAL ── */}
      <div
        className={`idx-modal-overlay ${isSettingsOpen ? 'open' : ''}`}
        id="idxSettingsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idx-settings-title"
        onClick={(e) => {
          if (e.target.id === 'idxSettingsModal') setIsSettingsOpen(false);
        }}
      >
        <div ref={settingsRef} className="idx-modal-card">
          <div className="idx-screw idx-sc-tl" aria-hidden="true"></div>
          <div className="idx-screw idx-sc-tr" aria-hidden="true"></div>
          <div className="idx-screw idx-sc-bl" aria-hidden="true"></div>
          <div className="idx-screw idx-sc-br" aria-hidden="true"></div>

          <h2 className="idx-modal-title" id="idx-settings-title">
            {t.settingsTitle}
          </h2>

          <div className="idx-vents" aria-hidden="true">
            <div className="idx-vent"></div>
            <div className="idx-vent"></div>
            <div className="idx-vent"></div>
            <div className="idx-vent"></div>
          </div>

          {/* Language Selection */}
          <div className="idx-group">
            <p className="idx-group-label">{t.langLabel}</p>
            <div className="idx-lang-row" role="group" aria-label={t.langLabel}>
              <div className="idx-lang-wrap">
                <button
                  type="button"
                  className={`idx-lang-btn ${lang === 'en' ? 'active' : ''}`}
                  aria-pressed={lang === 'en'}
                  onClick={() => handleSetLang('en')}
                >
                  EN
                </button>
              </div>
              <div className="idx-lang-wrap">
                <button
                  type="button"
                  className={`idx-lang-btn ${lang === 'vi' ? 'active' : ''}`}
                  aria-pressed={lang === 'vi'}
                  onClick={() => handleSetLang('vi')}
                >
                  VI
                </button>
              </div>
              <div className="idx-lang-wrap">
                <button
                  type="button"
                  className={`idx-lang-btn ${lang === 'zh-CN' ? 'active' : ''}`}
                  aria-pressed={lang === 'zh-CN'}
                  onClick={() => handleSetLang('zh-CN')}
                >
                  ZH
                </button>
              </div>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="idx-group">
            <p className="idx-group-label">{t.themeLabel}</p>
            <div className="idx-theme-row" role="group" aria-label={t.themeLabel}>
              {THEME_OPTIONS.map((option) => (
                <button key={option.id} type="button"
                  className={`idx-theme-btn ${theme === option.id ? 'active' : ''}`}
                  aria-pressed={theme === option.id}
                  onClick={() => setTheme(option.id)}>
                  <Icon name={`theme${option.id[0].toUpperCase()}${option.id.slice(1)}`} width="16" height="16" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <span>{translate(lang, option.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="idx-done-btn" onClick={() => setIsSettingsOpen(false)}>
            {t.doneBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useThemeStore } from '../stores/useThemeStore';

const INDEX_I18N = {
  en: {
    eyebrow: 'Expense Management System',
    tagline: 'Command-grade financial tracking. Industrial precision. Every transaction — accounted for.',
    totalBalance: 'Total Balance',
    transactions: 'Transactions',
    vsLastMo: 'vs. Last Mo.',
    loginBtn: 'LOG IN',
    signupBtn: 'SIGN UP',
    previewTitle: 'DASHBOARD',
    previewLive: 'LIVE',
    previewIncome: 'Income',
    previewExpenses: 'Expenses',
    previewFood: 'FOOD & DINING',
    previewTransport: 'TRANSPORT',
    previewSalary: 'SALARY',
    settingsTitle: 'Settings',
    langLabel: 'Language / Ngôn ngữ / 语言',
    themeLabel: 'Theme / Giao diện',
    themeLight: 'Light',
    themeDark: 'Dark',
    doneBtn: 'DONE'
  },
  vi: {
    eyebrow: 'Hệ thống quản lý chi tiêu',
    tagline: 'Quản lý tài chính cấp độ chuyên nghiệp. Độ chính xác cao. Mọi giao dịch đều được kiểm soát.',
    totalBalance: 'Tổng Số Dư',
    transactions: 'Giao Dịch',
    vsLastMo: 'so với tháng trước',
    loginBtn: 'ĐĂNG NHẬP',
    signupBtn: 'ĐĂNG KÝ',
    previewTitle: 'BẢNG ĐIỀU KHIỂN',
    previewLive: 'TRỰC TUYẾN',
    previewIncome: 'Thu nhập',
    previewExpenses: 'Chi tiêu',
    previewFood: 'ĂN UỐNG & ẨM THỰC',
    previewTransport: 'DI CHUYỂN',
    previewSalary: 'LƯƠNG',
    settingsTitle: 'Cài Đặt',
    langLabel: 'Language / Ngôn ngữ / 语言',
    themeLabel: 'Theme / Giao diện',
    themeLight: 'Sáng',
    themeDark: 'Tối',
    doneBtn: 'XONG'
  },
  zh: {
    eyebrow: '个人记账与财务管理系统',
    tagline: '专业级财务管理。工业级精度。掌控每一笔收支交易。',
    totalBalance: '总余额',
    transactions: '交易数',
    vsLastMo: '环比上月',
    loginBtn: '登 录',
    signupBtn: '注 册',
    previewTitle: '仪表盘',
    previewLive: '实时',
    previewIncome: '收入',
    previewExpenses: '支出',
    previewFood: '餐饮与美食',
    previewTransport: '交通出行',
    previewSalary: '薪资收入',
    settingsTitle: '设置',
    langLabel: 'Language / Ngôn ngữ / 语言',
    themeLabel: 'Theme / Giao diện',
    themeLight: '浅色',
    themeDark: '深色',
    doneBtn: '完成'
  }
};

export function LandingPage() {
  const { theme, setTheme } = useThemeStore();
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('caltdhy_lang') || 'en';
    } catch (_) {
      return 'en';
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const deviceWrapRef = useRef(null);
  const deviceBezelRef = useRef(null);

  const t = INDEX_I18N[lang] || INDEX_I18N.en;

  // Sync lang change to localStorage and html tag
  const handleSetLang = (newLang) => {
    setLang(newLang);
    try {
      localStorage.setItem('caltdhy_lang', newLang);
      document.documentElement.lang = newLang;
    } catch (_) {}
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
  const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const MONTHS_VI = ['THÁNG 1', 'THÁNG 2', 'THÁNG 3', 'THÁNG 4', 'THÁNG 5', 'THÁNG 6', 'THÁNG 7', 'THÁNG 8', 'THÁNG 9', 'THÁNG 10', 'THÁNG 11', 'THÁNG 12'];
  const now = new Date();
  const monthStr = lang === 'vi' ? MONTHS_VI[now.getMonth()] : MONTHS_EN[now.getMonth()];
  const dateLabelText = `${t.previewTitle} // ${monthStr} ${now.getFullYear()}`;

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
    <div className="landing-page" style={{ position: 'relative', width: '100%', minHeight: '100vh' }}>
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
        aria-label="Settings"
        aria-haspopup="dialog"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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
              <span className="metric-value">$24,811</span>
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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
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

            <div className="device-screen" role="img" aria-label="Dashboard preview">
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
                  <span className="currency">$</span>24,811.50
                </span>
              </div>

              <div className="screen-metrics">
                <div className="screen-metric">
                  <div className="sm-label">{t.previewIncome}</div>
                  <div className="sm-value income">+$6,200</div>
                </div>
                <div className="screen-metric">
                  <div className="sm-label">{t.previewExpenses}</div>
                  <div className="sm-value expense">-$1,843</div>
                </div>
              </div>

              <div className="screen-txns">
                <div className="screen-txn">
                  <span className="txn-name">{t.previewFood}</span>
                  <div className="txn-bar">
                    <div className="txn-bar-fill" style={{ width: '72%', background: '#ff4757' }}></div>
                  </div>
                  <span className="txn-amount neg">-$340</span>
                </div>
                <div className="screen-txn">
                  <span className="txn-name">{t.previewTransport}</span>
                  <div className="txn-bar">
                    <div className="txn-bar-fill" style={{ width: '38%', background: '#ff7043' }}></div>
                  </div>
                  <span className="txn-amount neg">-$180</span>
                </div>
                <div className="screen-txn">
                  <span className="txn-name">{t.previewSalary}</span>
                  <div className="txn-bar">
                    <div className="txn-bar-fill" style={{ width: '100%', background: '#00e676' }}></div>
                  </div>
                  <span className="txn-amount pos">+$6,200</span>
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
        <div className="idx-modal-card">
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
            <div className="idx-lang-row" role="group" aria-label="Language selection">
              <button
                className={`idx-lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => handleSetLang('en')}
              >
                EN
              </button>
              <button
                className={`idx-lang-btn ${lang === 'vi' ? 'active' : ''}`}
                onClick={() => handleSetLang('vi')}
              >
                VI
              </button>
              <button
                className={`idx-lang-btn ${lang === 'zh' ? 'active' : ''}`}
                onClick={() => handleSetLang('zh')}
              >
                ZH
              </button>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="idx-group">
            <p className="idx-group-label">{t.themeLabel}</p>
            <div className="idx-theme-row" role="group" aria-label="Theme selection">
              <button
                className={`idx-theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span>{t.themeLight}</span>
              </button>
              <button
                className={`idx-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>{t.themeDark}</span>
              </button>
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

/* ============================================================
   CaltDHy — components/Topbar.jsx
   Header điều hướng chính của ứng dụng.
   Đã khôi phục hoàn toàn cấu trúc class CSS gốc để hiển thị đúng UI.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { t } from '../utils/i18n';

export default function Topbar({
  currentView,
  onSwitchView,
  onToggleSidebar,
  onOpenSettings,
  onOpenAccount,
  onOpenGuide,
  onOpenWrapup,
  lang = 'vi',
}) {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'US';

  // Định dạng ngày giờ chuẩn
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      setDateStr(now.toLocaleDateString('en-US', options));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar" role="banner">
      <div className="tb-brand">
        <button
          className="tb-logo-link"
          style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }}
          onClick={() => onSwitchView('home')}
          aria-label="Go to dashboard"
        >
          <span className="tb-logo">
            Calt<span className="tb-logo-accent">D</span>Hy
          </span>
        </button>
        <span className="tb-badge">FINANCE_OS</span>

        <button
          className="btn-rail-toggle"
          onClick={onToggleSidebar}
          aria-label="Đóng/Mở Sidebar"
          title="Đóng/Mở Sidebar"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <button
          className="btn-wrapup-history"
          id="btnWrapupHistory"
          onClick={onOpenWrapup}
          aria-label="Lịch sử tổng kết"
          title="Lịch sử tổng kết"
          type="button"
          aria-haspopup="dialog"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="8" y1="8" x2="16" y2="8"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="8" y1="16" x2="13" y2="16"/>
          </svg>
        </button>
      </div>

      {/* Main Segmented Navigation */}
      <div className="tb-nav" role="navigation" aria-label="Main Navigation">
        <button
          className={`tb-nav-btn${currentView === 'home' ? ' active' : ''}`}
          id="nav-home"
          onClick={() => onSwitchView('home')}
        >
          {t('navHome', lang)}
        </button>
        <button
          className={`tb-nav-btn${currentView === 'analytics' ? ' active' : ''}`}
          id="nav-analytics"
          onClick={() => onSwitchView('analytics')}
        >
          {t('navAnalytics', lang)}
        </button>
        <button
          className={`tb-nav-btn${currentView === 'jars' ? ' active' : ''}`}
          id="nav-jars"
          onClick={() => onSwitchView('jars')}
          aria-label="Hũ Chi Tiêu"
        >
          {lang === 'vi' ? '🫙 HŨ TIẾT KIỆM' : '🫙 JARS'}
        </button>
      </div>

      <div className="tb-center" aria-label="Welcome and Date">
        <span className="user-greeting" id="userGreeting">
          {lang === 'vi' ? 'Chào mừng, ' : 'Welcome, '}{user?.name || 'USER'}!
        </span>
        <span className="system-date" id="systemDate">
          {dateStr}
        </span>
      </div>

      <div className="tb-right">
        <button
          className="user-chip"
          id="userChip"
          onClick={onOpenAccount}
          aria-label="Quản lý tài khoản"
          type="button"
        >
          <span
            className="user-chip-avatar"
            id="userChipAvatar"
            style={user?.avatar ? {
              backgroundImage: `url(${user.avatar})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: 'transparent'
            } : {}}
          >
            {!user?.avatar && initials}
          </span>
          <span className="user-chip-name" id="userChipName">{user?.name || 'USER'}</span>
        </button>

        <button
          className="btn-help"
          id="btnHelp"
          onClick={onOpenGuide}
          aria-label="Hướng dẫn sử dụng"
          aria-haspopup="dialog"
          title="Hướng dẫn sử dụng"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>

        <button
          className="btn-settings"
          id="btnSettings"
          onClick={onOpenSettings}
          aria-label="Settings"
          aria-haspopup="dialog"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <button className="btn-logout" id="btnLogout" onClick={logout} type="button">
          {t('logOut', lang)}
        </button>
      </div>
    </header>
  );
}

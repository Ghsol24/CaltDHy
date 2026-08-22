import React from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';

export function Topbar() {
  const { user, logout } = useAuthStore();
  const {
    activeView,
    setActiveView,
    toggleRail,
    openWrapupModal,
    openAccountModal,
    openHelpModal,
    openSettingsModal
  } = useSpendingStore();

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Format initials and display name
  const userName = user?.name || user?.email?.split('@')[0] || 'USER';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Current system date
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = now.toLocaleDateString('en-US', options);

  return (
    <header className="topbar" role="banner">
      <div className="tb-brand">
        <Link to="/spending" className="tb-logo-link" aria-label="Go to dashboard">
          <span className="tb-logo">
            Calt<span className="tb-logo-accent">D</span>Hy
          </span>
        </Link>
        <span className="tb-badge">FINANCE_OS</span>
        <button
          className="btn-rail-toggle"
          onClick={toggleRail}
          aria-label="Đóng/Mở Sidebar"
          title="Đóng/Mở Sidebar"
          type="button"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <button
          className="btn-wrapup-history"
          id="btnWrapupHistory"
          onClick={openWrapupModal}
          aria-label="Lịch sử tổng kết"
          title="Lịch sử tổng kết"
          type="button"
          aria-haspopup="dialog"
        >
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="8" y1="16" x2="13" y2="16" />
          </svg>
        </button>
      </div>

      {/* Main Segmented Navigation */}
      <div className="tb-nav" role="navigation" aria-label="Main Navigation">
        <button
          className={`tb-nav-btn ${activeView === 'home' ? 'active' : ''}`}
          onClick={() => setActiveView('home')}
        >
          DASHBOARD
        </button>
        <button
          className={`tb-nav-btn ${activeView === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveView('analytics')}
        >
          ANALYTICS
        </button>
        <button
          className={`tb-nav-btn ${activeView === 'jars' ? 'active' : ''}`}
          onClick={() => setActiveView('jars')}
          aria-label="Hũ Chi Tiêu"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ marginRight: '4px', verticalAlign: '-1px' }}
          >
            <path d="M19 11V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5" />
            <path d="M5 11a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5z" />
            <line x1="9" y1="4" x2="15" y2="4" />
          </svg>{' '}
          JARS
        </button>
      </div>

      <div className="tb-center" aria-label="Welcome and Date">
        <span className="user-greeting" id="userGreeting">
          Welcome, {userName}!
        </span>
        <span className="system-date" id="systemDate">
          {formattedDate}
        </span>
      </div>

      <div className="tb-right">
        <button
          className="user-chip"
          id="userChip"
          onClick={openAccountModal}
          aria-label="Quản lý tài khoản"
          type="button"
        >
          <span className="user-chip-avatar" id="userChipAvatar">
            {userInitials}
          </span>
          <span className="user-chip-name" id="userChipName">
            {userName}
          </span>
        </button>

        <button
          className="btn-help"
          id="btnHelp"
          onClick={openHelpModal}
          aria-label="Hướng dẫn sử dụng"
          aria-haspopup="dialog"
          title="Hướng dẫn sử dụng"
        >
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
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        <button
          className="btn-settings"
          id="btnSettings"
          onClick={openSettingsModal}
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

        <button className="btn-logout" id="btnLogout" onClick={handleLogout}>
          LOG OUT
        </button>
      </div>
    </header>
  );
}

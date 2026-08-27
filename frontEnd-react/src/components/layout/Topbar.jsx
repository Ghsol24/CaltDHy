import React from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { formatDate } from '../../utils/formatters';

export function Topbar() {
  const { user } = useAuthStore();
  const {
    activeView,
    setActiveView,
    openSettingsModal,
    openAccountModal,
  } = useSpendingStore();

  // Format initials and display name
  const userName = user?.name || user?.email?.split('@')[0] || 'Người dùng';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  const todayStr = formatDate(new Date(), 'full');

  const navTabs = [
    { id: 'home', label: 'Trang chủ' },
    { id: 'plan', label: 'Kế hoạch' },
    { id: 'analytics', label: 'Phân tích' },
    { id: 'jars', label: 'Hũ chi tiêu' },
  ];

  return (
    <header className="topbar" role="banner">
      {/* ── Brand Logo ── */}
      <div className="tb-brand">
        <Link
          to="/spending"
          className="tb-logo-link"
          aria-label="CaltDHy - Về trang chủ"
          onClick={() => setActiveView('home')}
        >
          <div className="tb-logo-icon">C</div>
          <span className="tb-logo">
            Calt<span className="tb-logo-accent">D</span>Hy
          </span>
        </Link>
        <span className="tb-badge">v2.0</span>
      </div>

      {/* ── 4 Main Tabs Navigation ── */}
      <nav className="tb-nav" role="navigation" aria-label="Điều hướng chính">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tb-nav-btn ${activeView === tab.id ? 'active' : ''}`}
            onClick={() => setActiveView(tab.id)}
            aria-current={activeView === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Right Actions ── */}
      <div className="tb-right">
        {/* Date Display */}
        <div className="tb-date" title={todayStr}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{todayStr}</span>
        </div>

        {/* Settings Button */}
        <button
          type="button"
          className="tb-settings-btn"
          onClick={openSettingsModal}
          title="Cài đặt giao diện & hệ thống"
          aria-label="Cài đặt giao diện và hệ thống"
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
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="tb-settings-label">Cài đặt</span>
        </button>


        {/* User Account Trigger Button (1-Click Opens Account Modal) */}
        <div className="user-menu-wrapper">
          <button
            type="button"
            className="user-chip"
            onClick={openAccountModal}
            title="Quản lý tài khoản"
            aria-label="Quản lý tài khoản"
          >
            {user?.avatar ? (
              user.avatar.startsWith('data:image') || user.avatar.startsWith('http') ? (
                <img src={user.avatar} alt={userName} className="user-chip-avatar-img" />
              ) : (
                <span className="user-chip-avatar user-chip-avatar--emoji">{user.avatar}</span>
              )
            ) : (
              <span className="user-chip-avatar">{userInitials}</span>
            )}
            <span className="user-chip-name">{userName}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

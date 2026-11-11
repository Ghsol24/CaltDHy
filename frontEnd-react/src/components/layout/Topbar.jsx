import React from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { formatDate } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';
import { Icon } from '../ui/AppIcons';

export function Topbar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const openSettingsModal = useSpendingStore((s) => s.openSettingsModal);

  // Format initials and display name
  const userName = user?.name || user?.email?.split('@')[0] || t('common.user');
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  const todayStr = formatDate(new Date(), 'full');

  return (
    <header className="topbar" role="banner">
      {/* ── Brand Logo ── */}
      <div className="tb-brand">
        <Link
          to="/spending/home"
          className="tb-logo-link"
          aria-label={t('topbar.home')}
          onClick={() => navigateTo('home')}
        >
          <div className="tb-logo-icon">C</div>
          <span className="tb-logo">
            Calt<span className="tb-logo-accent">D</span>Hy
          </span>
        </Link>
        <span className="tb-badge">v2.0</span>
      </div>

      {/* ── Right Actions ── */}
      <div className="tb-right">
        {/* Date Display */}
        <div className="tb-date" title={todayStr}>
          <Icon name="calendarRounded" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <span>{todayStr}</span>
        </div>

        {/* Settings Button */}
        <button
          type="button"
          className="tb-settings-btn"
          onClick={() => openSettingsModal()}
          title={t('topbar.openSettings')}
          aria-label={t('topbar.openSettings')}
        >
          <Icon name="settingsGear" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
          <span className="tb-settings-label">{t('settings.title')}</span>
        </button>


        {/* User Account Trigger Button (opens the unified Settings Center at Profile) */}
        <div className="user-menu-wrapper">
          <button
            type="button"
            className="user-chip"
            onClick={() => openSettingsModal('profile')}
            title={t('topbar.openProfile')}
            aria-label={t('topbar.openProfile')}
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

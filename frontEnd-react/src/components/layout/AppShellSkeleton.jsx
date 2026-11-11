import React from 'react';
import { PageSkeleton } from '../ui/PageSkeleton';
import { useTranslation } from '../../i18n/useTranslation';

export function AppShellSkeleton() {
  const { t } = useTranslation();
  const groupLabels = ['nav.home', 'nav.plan', 'nav.analytics', 'nav.jars'];
  return (
    <div className="app-shell" aria-busy="true" aria-label={t('common.loading')}>
      {/* ── Topbar Skeleton ── */}
      <header className="topbar" role="banner">
        <div className="tb-brand">
          <div className="tb-logo-icon">C</div>
          <span className="tb-logo">
            Calt<span className="tb-logo-accent">D</span>Hy
          </span>
          <span className="tb-badge">v2.0</span>
        </div>

        <div className="tb-right tb-right--layout">
          <div className="skeleton-item skeleton-text skeleton-item--shell-title" />
          <div className="skeleton-item skeleton-avatar skeleton-avatar--sm" />
        </div>
      </header>

      {/* ── Body Container with Sidebar + Main Content ── */}
      <div className="app-body-container">
        <aside className="app-sidebar-nav" aria-label={t('common.loading')}>
          <div className="sidebar-scrollable-content sidebar-scrollable-content--box">
            {groupLabels.map((groupLabel, gIdx) => (
              <div key={gIdx} className="sidebar-nav-group sidebar-nav-group--box">
                <div className="sidebar-group-label sidebar-group-label--box">
                  <span className="sidebar-group-dot" aria-hidden="true" />
                  <span>{t(groupLabel).toLocaleUpperCase()}</span>
                </div>
                <div className="sidebar-group-items">
                  {[1, 2].slice(0, gIdx === 0 ? 1 : 2).map((item) => (
                    <div
                      key={item}
                      className="sidebar-nav-item sidebar-nav-item--box"
                     
                    >
                      <div className="skeleton-item skeleton-avatar skeleton-avatar--xs skeleton-item--shell-icon" />
                      <div className="skeleton-item skeleton-text skeleton-item--shell-label" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="app-main" role="main">
          <div className="app-container">
            <PageSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}

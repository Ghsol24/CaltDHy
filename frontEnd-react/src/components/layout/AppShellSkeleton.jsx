import React from 'react';
import { useLocation } from 'react-router';
import { PageSkeleton } from '../ui/PageSkeleton';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuthStore } from '../../stores/useAuthStore';
import { readSidebarWidth } from './sidebarWidth';
import { groupIdForView, normalizePinnedGroups } from './sidebarGroups';

// Cùng khung với AppShell (đợt 15b): logo trong sidebar, tấm nội dung bo góc, viên kính góc
// trên-phải trên máy tính; điện thoại vẫn là topbar có logo. Tải xong không nhảy bố cục.
export function AppShellSkeleton() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const pinnedGroups = normalizePinnedGroups(useAuthStore.getState().user?.preferences?.sidebarPinnedGroups);
  const activeGroupId = groupIdForView(pathname.split('/')[2]);
  const groupDefs = [
    { id: 'group_home', labelKey: 'nav.home', standalone: true, items: 1 },
    { id: 'group_plan', labelKey: 'nav.plan', items: 4 },
    { id: 'group_analytics', labelKey: 'nav.analytics', items: 5 },
    { id: 'group_jars', labelKey: 'nav.jars', items: 3 },
  ];
  const brand = (
    <>
      <div className="tb-logo-icon">C</div>
      <span className="tb-logo">
        Calt<span className="tb-logo-accent">D</span>Hy
      </span>
    </>
  );
  return (
    <div className="app-shell" aria-busy="true" aria-label={t('common.loading')}>
      <div className="app-body-container">
        {/* Cùng độ rộng người dùng đã kéo, để tải xong sidebar không đổi cỡ. */}
        <aside
          className="app-sidebar-nav"
          style={{ '--sidebar-width': `${readSidebarWidth()}px` }}
          aria-label={t('common.loading')}
        >
          <div className="sidebar-brand">
            <div className="sidebar-brand__link">{brand}</div>
          </div>
          <div className="sidebar-scrollable-content sidebar-scrollable-content--box">
            {groupDefs.map((group) => {
              const isOpen = group.standalone || pinnedGroups.includes(group.id) || activeGroupId === group.id;
              return (
                <div
                  key={group.id}
                  className={`sidebar-nav-group sidebar-nav-group--box${isOpen ? '' : ' is-group-collapsed'}`}
                >
                  {/* "Trang chủ" đứng một mình, không có nhãn nhóm — như sidebar thật. */}
                  {!group.standalone && (
                    <div className="sidebar-group-label sidebar-group-label--box">{t(group.labelKey)}</div>
                  )}
                  {isOpen && (
                    <div className="sidebar-group-items">
                      {Array.from({ length: group.items }, (_, idx) => (
                        <div key={idx} className="sidebar-nav-item sidebar-nav-item--box">
                          <div className="skeleton-item skeleton-avatar skeleton-avatar--xs skeleton-item--shell-icon" />
                          <div className="skeleton-item skeleton-text skeleton-item--shell-label" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="app-column">
          <header className="topbar" role="banner">
            <div className="tb-brand">{brand}</div>
            <div className="tb-right tb-right--layout">
              <div className="skeleton-item skeleton-text skeleton-item--shell-title" />
              <div className="skeleton-item skeleton-avatar skeleton-avatar--sm" />
            </div>
          </header>

          <main className="app-main" role="main">
            <div className="app-container">
              <PageSkeleton />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

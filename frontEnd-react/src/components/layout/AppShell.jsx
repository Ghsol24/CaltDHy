import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Topbar } from './Topbar';
import { SidebarNav } from './SidebarNav';
import { MobilePrimaryNavigation, MobileSectionNavigation } from './MobileNavigation';
import { ToastRegion } from '../ui/ToastRegion';
import { ConfirmDialog } from '../ui/ConfirmDialog';

// Moves keyboard focus past the topbar and sidebar without adding a #hash
// entry to the router history.
function skipToMainContent(event) {
  const target = document.getElementById('main-content');
  if (!target) return;
  event.preventDefault();
  window.scrollTo({ top: 0 });
  target.focus({ preventScroll: true });
}

export function AppShell({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { t } = useTranslation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={skipToMainContent}>
        {t('common.skipToContent')}
      </a>
      <Topbar />
      <div className="app-body-container">
        <SidebarNav />
        <main id="main-content" className="app-main" tabIndex={-1}>
          <MobileSectionNavigation />
          <div className="app-container">
            {children || <Outlet />}
          </div>
        </main>
      </div>
      <MobilePrimaryNavigation />
      <ToastRegion />
      <ConfirmDialog />
    </div>
  );
}

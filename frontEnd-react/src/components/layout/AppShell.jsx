import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Topbar } from './Topbar';
import { SidebarNav } from './SidebarNav';
import { MobilePrimaryNavigation, MobileSectionNavigation } from './MobileNavigation';
import { ToastRegion } from '../ui/ToastRegion';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CommandPaletteHost } from './CommandPaletteHost';

// Moves keyboard focus past the sidebar and topbar without adding a #hash
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

  // Screen readers hear that the page is still loading (NAV-13).
  const isFirstLoad = useTransactionStore((state) => state.isLoading && !state.hasLoadedTransactions);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={skipToMainContent}>
        {t('common.skipToContent')}
      </a>
      <div className="app-body-container">
        <SidebarNav />
        {/* Máy tính: tấm nội dung bo góc cạnh sidebar; Topbar thành viên kính nổi bên trong
            (đợt 15b). Điện thoại: tấm phẳng, Topbar vẫn là thanh trên cùng như cũ. */}
        <div className="app-column">
          <Topbar />
          <main id="main-content" className="app-main" tabIndex={-1} aria-busy={isFirstLoad || undefined}>
            <MobileSectionNavigation />
            <div className="app-container">
              {children || <Outlet />}
            </div>
          </main>
        </div>
      </div>
      <MobilePrimaryNavigation />
      <ToastRegion />
      <ConfirmDialog />
      <CommandPaletteHost />
    </div>
  );
}

import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { Topbar } from './Topbar';
import { SidebarNav } from './SidebarNav';
import { MobilePrimaryNavigation, MobileSectionNavigation } from './MobileNavigation';
import { ToastRegion } from '../ui/ToastRegion';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function AppShell({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <Topbar />
      <div className="app-body-container">
        <SidebarNav />
        <main className="app-main" role="main">
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

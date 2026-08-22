import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { Topbar } from './Topbar';
import { LeftRail } from './LeftRail';

export function AppShell({ children }) {
  const { isAuthenticated } = useAuthStore();
  const { railCollapsed } = useSpendingStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Topbar />
      <div className={`app-body ${railCollapsed ? 'rail-collapsed' : ''}`}>
        <LeftRail />
        <main className="main-content" role="main">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}

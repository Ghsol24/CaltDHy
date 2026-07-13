/* ============================================================
   CaltDHy — App.jsx
   Root component: điều phối routing giữa các màn hình Auth và App chính.
   Không dùng React Router để giữ nhẹ — dùng state-based routing.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';

// Views
import LoginView from './views/LoginView';
import SignupView from './views/SignupView';
import ResetPasswordView from './views/ResetPasswordView';
import DashboardLayout from './views/DashboardLayout';

export default function App() {
  const { user, loading } = useAuth();
  // 'login' | 'signup' | 'reset-password' | 'app'
  const [page, setPage] = useState('login');

  // Khi trạng thái auth thay đổi → điều hướng tự động
  useEffect(() => {
    if (!loading) {
      if (user) {
        setPage('app');
      } else if (page === 'app') {
        setPage('login');
      }
    }
  }, [user, loading]);

  // Quản lý class 'dark-panel' trên body (chỉ bật khi ở trong App dashboard)
  useEffect(() => {
    if (page === 'app') {
      document.body.classList.add('dark-panel');
    } else {
      document.body.classList.remove('dark-panel');
    }
  }, [page]);

  if (loading) {
    return (
      <div className="app-loading" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--text-secondary)', fontSize: '1rem',
        gap: '0.75rem'
      }}>
        <span style={{ fontSize: '1.5rem' }}>⚙️</span>
        <span>Đang khởi động CaltDHy...</span>
      </div>
    );
  }

  if (user) {
    return <DashboardLayout onNavigate={setPage} />;
  }

  switch (page) {
    case 'signup':
      return <SignupView onNavigate={setPage} />;
    case 'reset-password':
      return <ResetPasswordView onNavigate={setPage} />;
    default:
      return <LoginView onNavigate={setPage} />;
  }
}

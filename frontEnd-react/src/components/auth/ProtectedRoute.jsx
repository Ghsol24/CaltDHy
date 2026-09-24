import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
export function ProtectedRoute({ children }) {
  const { t } = useTranslation();
  const status = useAuthStore(state => state.status);
  const userId = useAuthStore(state => state.user?.id);
  const location = useLocation();
  if (status === 'checking') return <p role="status">{t('common.loading')}</p>;
  if (status !== 'authenticated') return <Navigate to="/login" state={{ from: location }} replace />;
  return <React.Fragment key={userId}>{children}</React.Fragment>;
}

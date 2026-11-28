import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { BrandLoadingState } from '../ui/BrandLoadingState';

export function ProtectedRoute({ children }) {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id);
  const location = useLocation();
  if (status === 'checking') return <BrandLoadingState />;
  if (status !== 'authenticated') return <Navigate to="/login" state={{ from: location }} replace />;
  return <React.Fragment key={userId}>{children}</React.Fragment>;
}

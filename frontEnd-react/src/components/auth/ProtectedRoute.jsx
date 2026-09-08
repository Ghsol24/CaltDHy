import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/useAuthStore';

export function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

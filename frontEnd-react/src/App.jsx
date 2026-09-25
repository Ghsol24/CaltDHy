import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from './stores/useAuthStore';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShellSkeleton } from './components/layout/AppShellSkeleton';
import { useTranslation } from './i18n/useTranslation';
import { LocalizationObserver } from './i18n/LocalizationObserver';
import { PwaUpdateNotice } from './components/layout/PwaUpdateNotice';
import { SignatureLoginOverlay } from './components/ui/SignatureLoginOverlay';

const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const LandingPage = lazyNamed(() => import('./pages/LandingPage'), 'LandingPage');
const LoginPage = lazyNamed(() => import('./pages/LoginPage'), 'LoginPage');
const SignupPage = lazyNamed(() => import('./pages/SignupPage'), 'SignupPage');
const ResetPasswordPage = lazyNamed(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage');
const VerifyEmailPage = lazyNamed(() => import('./pages/VerifyEmailPage'), 'VerifyEmailPage');
const SpendingPage = lazyNamed(() => import('./pages/SpendingPage'), 'SpendingPage');

function RedirectWithQuery({ to }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function AuthExpirationListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuthExpired = () => {
      useAuthStore.getState().expire();
      if (location.pathname.startsWith('/spending')) {
        navigate('/login?expired=1', { replace: true });
      }
    };

    window.addEventListener('caltdhy:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('caltdhy:auth-expired', handleAuthExpired);
  }, [navigate, location]);

  return null;
}

function RouteLoadingFallback() {
  const { t } = useTranslation();
  const location = useLocation();
  if (location.pathname.startsWith('/spending')) {
    return <AppShellSkeleton />;
  }
  return <div className="route-loading" role="status" aria-live="polite">{t('common.loading')}</div>;
}

export default function App() {
  useEffect(() => { void useAuthStore.getState().initialize(); }, []);
  return (
    <BrowserRouter>
      <SignatureLoginOverlay />
      <LocalizationObserver />
      <PwaUpdateNotice />
      <AuthExpirationListener />
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/index.html" element={<RedirectWithQuery to="/" />} />
        
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login.html" element={<RedirectWithQuery to="/login" />} />
        
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup.html" element={<RedirectWithQuery to="/signup" />} />
        
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password.html" element={<RedirectWithQuery to="/reset-password" />} />

        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email.html" element={<RedirectWithQuery to="/verify-email" />} />
        
        <Route
          path="/spending/*"
          element={
            <ProtectedRoute>
              <SpendingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/spending.html"
          element={
            <ProtectedRoute>
              <RedirectWithQuery to="/spending/home" />
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

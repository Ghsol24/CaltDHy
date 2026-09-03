import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from './stores/useAuthStore';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SpendingPage } from './pages/SpendingPage';

function RedirectWithQuery({ to }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function AuthExpirationListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuthExpired = () => {
      useAuthStore.getState().logout();
      if (location.pathname.startsWith('/spending')) {
        navigate('/login?expired=1', { replace: true });
      }
    };

    window.addEventListener('caltdhy:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('caltdhy:auth-expired', handleAuthExpired);
  }, [navigate, location]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthExpirationListener />
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
        
        <Route path="/spending" element={<SpendingPage />} />
        <Route path="/spending.html" element={<RedirectWithQuery to="/spending" />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

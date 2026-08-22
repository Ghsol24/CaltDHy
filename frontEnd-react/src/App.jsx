import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SpendingPage } from './pages/SpendingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup.html" element={<Navigate to="/signup" replace />} />
        
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password.html" element={<Navigate to="/reset-password" replace />} />

        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email.html" element={<Navigate to="/verify-email" replace />} />
        
        <Route path="/spending" element={<SpendingPage />} />
        <Route path="/spending.html" element={<Navigate to="/spending" replace />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

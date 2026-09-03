import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '../stores/useAuthStore';
import { StatusBar } from '../components/ui/StatusBar';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';

export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const isPwValid = password.length >= 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setError('Vui lòng nhập đúng địa chỉ email (ví dụ: ten@example.com).');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      setTimeout(() => {
        navigate('/spending');
      }, 300);
    } catch (err) {
      setError(err.message || 'Lỗi kết nối server.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="orb2" aria-hidden="true"></div>

      <div className="pg-screw s-tl" aria-hidden="true"></div>
      <div className="pg-screw s-tr" aria-hidden="true"></div>
      <div className="pg-screw s-bl" aria-hidden="true"></div>
      <div className="pg-screw s-br" aria-hidden="true"></div>

      <StatusBar label="Đăng Nhập An Toàn" />

      <main>
        <IndustrialPanel eyebrow="CaltDHy Account" title="Welcome" titleHighlight="BACK">
          <form id="loginForm" onSubmit={handleSubmit} noValidate>
            <FloatingInput
              id="emailIn"
              type="email"
              label="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isValid={isEmailValid}
              autoComplete="email"
              required
            />

            <FloatingInput
              id="pwIn"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isPwValid}
              autoComplete="current-password"
              required
            />

            <div className="forgot-row">
              <Link to="/reset-password" className="forgot-lnk">
                FORGOT PASSWORD?
              </Link>
            </div>

            {isExpired && !error && (
              <div className="form-err show" style={{ background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' }} role="status">
                ⏱ Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
              </div>
            )}

            {error && (
              <div id="formErr" className="form-err show" role="alert">
                ⚠ {error}
              </div>
            )}

            <button type="submit" className={`btn-cta ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{isSubmitting ? 'Đang đăng nhập...' : 'LOG IN'}</span>
            </button>

            <p className="security-note" style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
              🔒 Thông tin đăng nhập của bạn được mã hoá an toàn.
            </p>
          </form>

          <div className="divider">
            <span>OR</span>
          </div>

          <Link to="/" className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            BACK TO HOME
          </Link>

          <p className="mod-footer">
            No account yet?{' '}
            <Link to="/signup" className="lnk">
              SIGN UP
            </Link>
          </p>
        </IndustrialPanel>
      </main>
    </div>
  );
};

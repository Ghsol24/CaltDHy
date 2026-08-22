import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/useAuthStore';
import { StatusBar } from '../components/ui/StatusBar';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';

function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '—', cls: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'WEAK', cls: 'pw-weak' };
  if (score <= 2) return { level: 2, label: 'MEDIUM', cls: 'pw-medium' };
  return { level: 3, label: 'STRONG', cls: 'pw-strong' };
}

export const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const pwStrength = getPasswordStrength(password);
  const isPwValid = pwStrength.level >= 2 || password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!isEmailValid) {
      setError('Vui lòng nhập đúng địa chỉ email (ví dụ: ten@example.com).');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(name.trim(), email.trim(), password);
      setTimeout(() => {
        navigate(`/verify-email?email=${encodeURIComponent(result.user?.email || email.trim())}`);
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

      <StatusBar label="Tạo Tài Khoản Mới" />

      <main>
        <IndustrialPanel eyebrow="CaltDHy Account" title="Create" titleHighlight="ACCOUNT">
          <form id="signupForm" onSubmit={handleSubmit} noValidate>
            <FloatingInput
              id="fullName"
              type="text"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              isValid={isNameValid}
              autoComplete="name"
              required
            />

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
              label="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isValid={isPwValid}
              autoComplete="new-password"
              required
            />

            {password && (
              <div id="pwStrength" className={`pw-strength ${pwStrength.cls}`}>
                <div className="pw-bar-wrap">
                  <div className="pw-bar"></div>
                </div>
                <span className="pw-txt" id="pwLabel">
                  {pwStrength.label}
                </span>
              </div>
            )}

            {error && (
              <div id="formErr" className="form-err show" role="alert">
                ⚠ {error}
              </div>
            )}

            <button type="submit" className={`btn-cta ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{isSubmitting ? 'Đang tạo tài khoản...' : 'CREATE ACCOUNT'}</span>
            </button>

            <p className="security-note" style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
              🔒 Thông tin đăng ký của bạn được mã hoá an toàn.
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
            Already have an account?{' '}
            <Link to="/login" className="lnk">
              LOG IN
            </Link>
          </p>
        </IndustrialPanel>
      </main>
    </div>
  );
};

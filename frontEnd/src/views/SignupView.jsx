/* ============================================================
   CaltDHy — views/SignupView.jsx
   Đã khôi phục hoàn toàn UI cơ học cao cấp (Premium UI) gốc.
   ============================================================ */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function SignupView({ onNavigate }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Tính toán mức độ mạnh mật khẩu giả lập cho giống bản gốc
  const getPwStrength = () => {
    if (!password) return { pct: 0, label: '—', className: '' };
    if (password.length < 6) return { pct: 33, label: 'WEAK', className: 'pw-weak' };
    if (password.length < 10) return { pct: 66, label: 'MEDIUM', className: 'pw-medium' };
    return { pct: 100, label: 'STRONG', className: 'pw-strong' };
  };

  const strength = getPwStrength();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      return setError('Mật khẩu phải có ít nhất 6 ký tự.');
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Background orbs */}
      <div className="orb2" aria-hidden="true"></div>

      {/* Page corner screws */}
      <div className="pg-screw s-tl" aria-hidden="true"></div>
      <div className="pg-screw s-tr" aria-hidden="true"></div>
      <div className="pg-screw s-bl" aria-hidden="true"></div>
      <div className="pg-screw s-br" aria-hidden="true"></div>

      {/* Close button - back to login */}
      <button
        className="btn-close-page"
        onClick={() => onNavigate('login')}
        aria-label="Back to login"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Status Bar */}
      <header className="status-bar" aria-label="System status">
        <div className="led" aria-hidden="true"></div>
        <span className="status-label">Registration Module Active</span>
      </header>

      <main style={{ zIndex: 1 }}>
        <div className="module" role="region" aria-labelledby="mod-title">
          {/* Card corner screws */}
          <div className="c-screw c-tl" aria-hidden="true"></div>
          <div className="c-screw c-tr" aria-hidden="true"></div>
          <div className="c-screw c-bl" aria-hidden="true"></div>
          <div className="c-screw c-br" aria-hidden="true"></div>

          {/* Header */}
          <div className="mod-header">
            <span className="mod-eyebrow">CaltDHy // Auth</span>
            <h1 className="mod-title" id="mod-title">
              Create <span>Account</span>
            </h1>
          </div>

          {/* Vents slots */}
          <div className="vents" aria-hidden="true">
            <div className="vent"></div>
            <div className="vent"></div>
            <div className="vent"></div>
            <div className="vent"></div>
            <div className="vent"></div>
          </div>

          <form id="signupForm" onSubmit={handleSubmit} noValidate>
            <div className={`fg${name ? ' fg--active' : ''}`}>
              <input
                id="fullName"
                className="finput"
                type="text"
                placeholder=" "
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <label className="flabel" htmlFor="fullName">Full Name</label>
            </div>

            <div className={`fg${email ? ' fg--active' : ''}`}>
              <input
                id="emailIn"
                className="finput"
                type="email"
                placeholder=" "
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <label className="flabel" htmlFor="emailIn">Email Address</label>
            </div>

            <div className={`fg${password ? ' fg--active' : ''}`}>
              <div className="iw">
                <input
                  id="pwIn"
                  className="finput"
                  type={showPass ? 'text' : 'password'}
                  placeholder=" "
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <label className="flabel" htmlFor="pwIn">Password</label>
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPass(p => !p)}
                  aria-label="Toggle password visibility"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>

              {/* Password strength meter */}
              <div className={`pw-strength ${strength.className}`} id="pwStrength" aria-live="polite">
                <div className="pw-strength__bar">
                  <div className="pw-strength__fill" style={{ width: `${strength.pct}%` }} />
                </div>
                <span className="pw-strength__label">{strength.label}</span>
              </div>
            </div>

            <div className={`form-err${error ? ' show' : ''}`} role="alert">
              {error}
            </div>

            <button
              type="submit"
              className={`btn-cta${loading ? ' loading' : ''}`}
              id="submitBtn"
              disabled={loading}
            >
              <span className="spinner" aria-hidden="true"></span>
              <span className="btn-text">{loading ? 'SIGNING UP...' : 'SIGN UP'}</span>
            </button>
          </form>

          <p className="mod-footer">
            Already have an account?{' '}
            <button
              type="button"
              className="lnk"
              onClick={() => onNavigate('login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline' }}
            >
              LOG IN
            </button>
          </p>
        </div>
      </main>
    </>
  );
}

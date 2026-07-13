/* ============================================================
   CaltDHy — views/LoginView.jsx
   Đã khôi phục hoàn toàn UI cơ học cao cấp (Premium UI) gốc.
   ============================================================ */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function LoginView({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || 'Email hoặc mật khẩu không đúng.');
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

      {/* Status Bar */}
      <header className="status-bar" aria-label="System status">
        <div className="led" aria-hidden="true"></div>
        <span className="status-label">Auth Module Active</span>
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
              Access <span>System</span>
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

          <form id="loginForm" onSubmit={handleSubmit} noValidate>
            <div className={`fg${email ? ' fg--active' : ''}`} id="fgEmail">
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
              {email && /\S+@\S+\.\S+/.test(email) && (
                <svg className="fg-check" width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 1 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>

            <div className={`fg${password ? ' fg--active' : ''}`} id="fgPw">
              <div className="iw">
                <input
                  id="pwIn"
                  className="finput"
                  type={showPass ? 'text' : 'password'}
                  placeholder=" "
                  autoComplete="current-password"
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
            </div>

            <div className="forgot-row">
              <button
                type="button"
                className="forgot-lnk"
                onClick={() => onNavigate('reset-password')}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                FORGOT PASSWORD?
              </button>
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
              <span className="btn-text">{loading ? 'LOGGING IN...' : 'LOG IN'}</span>
            </button>
          </form>

          <div className="divider"><span>OR</span></div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onNavigate('signup')}
          >
            CREATE NEW ACCOUNT
          </button>

          <p className="mod-footer">
            No account yet?{' '}
            <button
              type="button"
              className="lnk"
              onClick={() => onNavigate('signup')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline' }}
            >
              SIGN UP
            </button>
          </p>
        </div>
      </main>
    </>
  );
}

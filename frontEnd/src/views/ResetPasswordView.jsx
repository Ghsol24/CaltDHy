/* ============================================================
   CaltDHy — views/ResetPasswordView.jsx
   Đã khôi phục hoàn toàn UI cơ học cao cấp (Premium UI) gốc.
   ============================================================ */

import { useState } from 'react';
import { apiForgotPassword } from '../services/api';

export default function ResetPasswordView({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'sent' | 'error'
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      await apiForgotPassword(email.trim());
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
      setStatus('error');
    }
  }

  return (
    <>
      {/* Animated background orbs */}
      <div className="orb2" aria-hidden="true"></div>

      {/* Page corner bolts */}
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

      {/* Status LED */}
      <header className="status-bar" aria-label="System status">
        <div className="led" aria-hidden="true"></div>
        <span className="status-label">Security Module Active</span>
      </header>

      <main style={{ zIndex: 1 }}>
        <div className="module" role="region" aria-labelledby="mod-title">
          {/* Module card corner screws */}
          <div className="c-screw c-tl" aria-hidden="true"></div>
          <div className="c-screw c-tr" aria-hidden="true"></div>
          <div className="c-screw c-bl" aria-hidden="true"></div>
          <div className="c-screw c-br" aria-hidden="true"></div>

          {/* Header */}
          <div className="mod-header">
            <span className="mod-eyebrow">CaltDHy // Security</span>
            <h1 className="mod-title" id="modTitle">
              Đặt Lại <span>Mật Khẩu</span>
            </h1>
          </div>

          {/* Vent decoration */}
          <div className="vents" aria-hidden="true">
            <div className="vent"></div>
            <div className="vent"></div>
            <div className="vent"></div>
            <div className="vent"></div>
            <div className="vent"></div>
          </div>

          <p className="mod-hint">
            {status === 'sent'
              ? 'Yêu cầu gửi mã khôi phục mật khẩu đã được thực thi.'
              : 'Nhập email của bạn để nhận hướng dẫn đặt lại mật khẩu từ hệ thống.'}
          </p>

          {status === 'sent' ? (
            <div className="form-ok show" role="status">
              📬 Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư của bạn.
            </div>
          ) : (
            <form id="forgotForm" onSubmit={handleSubmit} noValidate>
              <div className={`fg${email ? ' fg--active' : ''}`}>
                <input
                  id="emailForgot"
                  className="finput"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <label className="flabel" htmlFor="emailForgot">Địa chỉ Email</label>
              </div>

              <div className={`form-err${status === 'error' ? ' show' : ''}`} role="alert">
                {error}
              </div>

              <button
                type="submit"
                className="btn-cta"
                id="forgotBtn"
                disabled={status === 'loading'}
              >
                <span className="spinner" aria-hidden="true"></span>
                <span className="btn-text">{status === 'loading' ? 'ĐANG GỬI...' : 'GỬI YÊU CẦU'}</span>
              </button>
            </form>
          )}

          <p className="mod-footer">
            Quay lại{' '}
            <button
              type="button"
              className="lnk"
              onClick={() => onNavigate('login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline' }}
            >
              ĐĂNG NHẬP
            </button>
          </p>
        </div>
      </main>
    </>
  );
}

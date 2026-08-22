import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router';
import { authService } from '../services/authService';
import { StatusBar } from '../components/ui/StatusBar';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';
import { FloatingInput } from '../components/ui/FloatingInput';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email');
  const navigate = useNavigate();

  const isResetMode = !!(token && emailParam);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const isForgotEmailValid = /\S+@\S+\.\S+/.test(forgotEmail.trim());

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!isForgotEmailValid) {
      setForgotError('Email không hợp lệ.');
      return;
    }

    setIsForgotSubmitting(true);

    try {
      const data = await authService.forgotPassword({ email: forgotEmail.trim() });
      if (data.success) {
        setForgotSuccess(data.message || 'Đã gửi liên kết khôi phục mật khẩu tới email của bạn.');
      } else {
        setForgotError(data.message || 'Lỗi gửi yêu cầu.');
      }
    } catch (err) {
      setForgotError(err.message || 'Không thể kết nối với máy chủ.');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (newPassword.length < 6) {
      setResetError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsResetSubmitting(true);

    try {
      const data = await authService.resetPassword({
        token,
        email: emailParam,
        newPassword
      });

      if (data.success) {
        setResetSuccess(data.message || 'Mật khẩu đã đặt lại thành công!');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setResetError(data.message || 'Có lỗi xảy ra.');
        setIsResetSubmitting(false);
      }
    } catch (err) {
      setResetError(err.message || 'Không thể kết nối với máy chủ.');
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="orb2" aria-hidden="true"></div>

      <div className="pg-screw s-tl" aria-hidden="true"></div>
      <div className="pg-screw s-tr" aria-hidden="true"></div>
      <div className="pg-screw s-bl" aria-hidden="true"></div>
      <div className="pg-screw s-br" aria-hidden="true"></div>

      <StatusBar label={isResetMode ? 'Đặt Lại Mật Khẩu' : 'Quên Mật Khẩu'} />

      <main>
        <IndustrialPanel
          eyebrow="CaltDHy Account"
          title={isResetMode ? 'Đặt Lại' : 'Quên'}
          titleHighlight="MẬT KHẨU"
        >
          <p id="modHint" style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginBottom: '20px' }}>
            {isResetMode
              ? 'Nhập mật khẩu mới cho tài khoản của bạn. Mật khẩu tối thiểu 6 ký tự.'
              : 'Nhập địa chỉ email đăng ký để nhận liên kết đặt lại mật khẩu.'}
          </p>

          {!isResetMode ? (
            <form id="forgotForm" onSubmit={handleForgotSubmit} noValidate>
              <FloatingInput
                id="emailForgot"
                type="email"
                label="Email Address"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                isValid={isForgotEmailValid}
                autoComplete="email"
                required
              />

              {forgotError && (
                <div id="forgotError" className="form-err show" role="alert">
                  ⚠ {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div id="forgotSuccess" className="form-success show" role="alert" style={{ color: 'var(--success)', marginTop: '8px', fontSize: '12px', textAlign: 'center' }}>
                  ✓ {forgotSuccess}
                </div>
              )}

              <button type="submit" className={`btn-cta ${isForgotSubmitting ? 'loading' : ''}`} disabled={isForgotSubmitting}>
                <span className="spinner" aria-hidden="true"></span>
                <span className="btn-text">{isForgotSubmitting ? 'ĐANG GỬI YÊU CẦU...' : 'GỬI YÊU CẦU'}</span>
              </button>
            </form>
          ) : (
            <form id="resetForm" onSubmit={handleResetSubmit} noValidate>
              <FloatingInput
                id="newPass"
                type="password"
                label="Mật khẩu mới (ít nhất 6 ký tự)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                isValid={newPassword.length >= 6}
                autoComplete="new-password"
                required
              />

              <FloatingInput
                id="confirmPass"
                type="password"
                label="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                isValid={confirmPassword.length >= 6 && confirmPassword === newPassword}
                autoComplete="new-password"
                required
              />

              {resetError && (
                <div id="resetError" className="form-err show" role="alert">
                  ⚠ {resetError}
                </div>
              )}

              {resetSuccess && (
                <div id="resetSuccess" className="form-success show" role="alert" style={{ color: 'var(--success)', marginTop: '8px', fontSize: '12px', textAlign: 'center' }}>
                  ✓ {resetSuccess}
                </div>
              )}

              <button type="submit" className={`btn-cta ${isResetSubmitting ? 'loading' : ''}`} disabled={isResetSubmitting}>
                <span className="spinner" aria-hidden="true"></span>
                <span className="btn-text">{isResetSubmitting ? 'ĐANG THIẾT LẬP...' : 'ĐẶT LẠI MẬT KHẨU'}</span>
              </button>
            </form>
          )}

          <div className="divider">
            <span>OR</span>
          </div>

          <Link to="/login" className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            BACK TO LOGIN
          </Link>
        </IndustrialPanel>
      </main>
    </div>
  );
};

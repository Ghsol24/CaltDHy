import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authService } from '../services/authService';
import { StatusBar } from '../components/ui/StatusBar';
import { IndustrialPanel } from '../components/ui/IndustrialPanel';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const [message, setMessage] = useState('Đang kiểm tra liên kết xác minh…');
  const [canResend, setCanResend] = useState(!token && Boolean(email));
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setMessage('Hãy kiểm tra hộp thư và mở liên kết xác minh để kích hoạt tài khoản.');
      return;
    }
    authService.verifyEmail({ email, token })
      .then((data) => {
        setMessage(data.message || 'Email đã được xác minh.');
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      })
      .catch((error) => {
        setMessage(error.message || 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
        setCanResend(true);
      });
  }, [email, navigate, token]);

  const resend = async () => {
    setIsSending(true);
    try {
      const data = await authService.resendVerification(email);
      setMessage(data.message || 'Đã xử lý yêu cầu gửi lại email.');
    } catch (error) {
      setMessage(error.message || 'Không thể gửi lại email. Vui lòng thử lại sau.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="auth-page">
      <StatusBar label="Xác Minh Email" />
      <main>
        <IndustrialPanel eyebrow="CaltDHy Account" title="Verify" titleHighlight="EMAIL">
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center', margin: '0 0 20px' }}>{message}</p>
          {canResend && <button className="btn-cta" type="button" onClick={resend} disabled={isSending}>
            {isSending ? 'ĐANG GỬI...' : 'GỬI LẠI EMAIL'}
          </button>}
          <p className="mod-footer"><Link to="/login" className="lnk">QUAY LẠI ĐĂNG NHẬP</Link></p>
        </IndustrialPanel>
      </main>
    </div>
  );
}

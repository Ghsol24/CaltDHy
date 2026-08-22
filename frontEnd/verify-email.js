const params = new URLSearchParams(window.location.search);
const email = params.get('email') || '';
const token = params.get('token') || '';
const message = document.getElementById('verificationMessage');
const resendButton = document.getElementById('resendButton');

async function resendVerification() {
  resendButton.disabled = true;
  try {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    message.textContent = data.message || 'Đã xử lý yêu cầu gửi lại email.';
  } catch (_) {
    message.textContent = 'Không thể gửi lại email. Vui lòng thử lại sau.';
  } finally {
    resendButton.disabled = false;
  }
}

async function verifyEmail() {
  if (!token || !email) {
    message.textContent = 'Hãy kiểm tra hộp thư và mở liên kết xác minh để kích hoạt tài khoản.';
    resendButton.hidden = !email;
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token })
    });
    const data = await res.json();
    message.textContent = data.message || 'Không thể xác minh email.';
    if (res.ok && data.success) {
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    } else {
      resendButton.hidden = !email;
    }
  } catch (_) {
    message.textContent = 'Không thể kết nối máy chủ để xác minh email.';
    resendButton.hidden = !email;
  }
}

resendButton.addEventListener('click', resendVerification);
verifyEmail();

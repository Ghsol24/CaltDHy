var API_BASE = '/api';
var params = new URLSearchParams(window.location.search);
var token = params.get('token');
var email = params.get('email');

var forgotForm = document.getElementById('forgotForm');
var resetForm = document.getElementById('resetForm');
var modTitle = document.getElementById('modTitle');
var modHint = document.getElementById('modHint');
var statusLabel = document.getElementById('statusLabel');

/* ── Toggle forms dynamically depending on URL parameters ── */
if (token && email) {
  // RESET PASSWORD MODE
  resetForm.classList.remove('u-hide');
  modTitle.innerHTML = 'Đặt Lại <span>Mật Khẩu</span>';
  modHint.innerHTML = 'Nhập mật khẩu mới cho tài khoản của bạn.<br>Mật khẩu tối thiểu 6 ký tự.';
  statusLabel.textContent = 'Password Reset Active';
} else {
  // FORGOT PASSWORD MODE
  forgotForm.classList.remove('u-hide');
  modTitle.innerHTML = 'Quên <span>Mật Khẩu</span>';
  modHint.innerHTML = 'Nhập địa chỉ email đăng ký để nhận liên kết đặt lại mật khẩu.';
  statusLabel.textContent = 'Forgot Password Active';
}

/* ── SVG paths for eye toggle ── */
var SVG_OPEN = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
var SVG_SLASH = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

function togglePw(id, btn) {
  var inp = document.getElementById(id);
  var svg = btn.querySelector('svg');
  if (inp.type === 'password') {
    inp.type = 'text';
    svg.innerHTML = SVG_SLASH;
  } else {
    inp.type = 'password';
    svg.innerHTML = SVG_OPEN;
  }
}

/* ── Inline validation ── */
function validateEmail(el) {
  var ok = /\S+@\S+\.\S+/.test(el.value.trim());
  el.classList.toggle('valid', ok && el.value.length > 0);
}

function validatePw(el) {
  el.classList.toggle('valid', el.value.length >= 6);
}

/* ── Form 1 Submission: Forgot Password ── */
forgotForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  var errEl = document.getElementById('forgotError');
  var okEl = document.getElementById('forgotSuccess');
  var btn = document.getElementById('forgotBtn');
  var emailVal = document.getElementById('emailForgot').value.trim();

  errEl.classList.remove('show');
  okEl.classList.remove('show');

  if (!emailVal || !/\S+@\S+\.\S+/.test(emailVal)) {
    errEl.textContent = '⚠ Email không hợp lệ.';
    errEl.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'ĐANG GỬI YÊU CẦU...';

  try {
    var res = await fetch(API_BASE + '/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailVal })
    });
    var data = await res.json();

    if (data.success) {
      okEl.textContent = '✓ ' + data.message;
      okEl.classList.add('show');
      btn.querySelector('.btn-text').textContent = 'ĐÃ GỬI';
    } else {
      errEl.textContent = '⚠ ' + (data.message || 'Lỗi gửi yêu cầu.');
      errEl.classList.add('show');
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.querySelector('.btn-text').textContent = 'GỬI YÊU CẦU';
    }
  } catch (err) {
    errEl.textContent = '⚠ Không thể kết nối với máy chủ.';
    errEl.classList.add('show');
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-text').textContent = 'GỬI YÊU CẦU';
  }
});

/* ── Form 2 Submission: Reset Password ── */
resetForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  var errEl = document.getElementById('resetError');
  var okEl = document.getElementById('resetSuccess');
  var btn = document.getElementById('resetBtn');
  var newPassword = document.getElementById('newPass').value;
  var confirm = document.getElementById('confirmPass').value;

  errEl.classList.remove('show');
  okEl.classList.remove('show');

  if (newPassword.length < 6) {
    errEl.textContent = '⚠ Mật khẩu phải có ít nhất 6 ký tự.';
    errEl.classList.add('show');
    return;
  }
  if (newPassword !== confirm) {
    errEl.textContent = '⚠ Mật khẩu xác nhận không khớp.';
    errEl.classList.add('show');
    return;
  }

  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'ĐANG THIẾT LẬP...';

  try {
    var res = await fetch(API_BASE + '/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, email: email, newPassword: newPassword })
    });
    var data = await res.json();

    if (data.success) {
      okEl.textContent = '✓ ' + (data.message || 'Mật khẩu đã đặt lại thành công!');
      okEl.classList.add('show');
      btn.querySelector('.btn-text').textContent = 'THÀNH CÔNG';
      setTimeout(function () { window.location.href = 'login.html'; }, 2000);
    } else {
      errEl.textContent = '⚠ ' + (data.message || 'Có lỗi xảy ra.');
      errEl.classList.add('show');
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.querySelector('.btn-text').textContent = 'ĐẶT LẠI MẬT KHẨU';
    }
  } catch (err) {
    errEl.textContent = '⚠ Không thể kết nối với máy chủ.';
    errEl.classList.add('show');
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-text').textContent = 'ĐẶT LẠI MẬT KHẨU';
  }
});

/* ESC → go back to login */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') window.location.href = 'login.html';
});

/* ── Toggle password visibility ── */
function togglePw(id, btn) {
  const inp = document.getElementById(id);
  const open  = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  const slash = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  const svg = btn.querySelector('svg');
  if (inp.type === 'password') { inp.type = 'text';     svg.innerHTML = slash; }
  else                         { inp.type = 'password'; svg.innerHTML = open;  }
}

/* ── Inline validation ── */
function validateEmail(el) {
  const ok = /\S+@\S+\.\S+/.test(el.value.trim());
  el.classList.toggle('valid', ok && el.value.length > 0);
}

function validatePw(el) {
  el.classList.toggle('valid', el.value.length >= 1);
}

/* ── Form submit ── */
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const errEl  = document.getElementById('formErr');
  const btn    = document.getElementById('submitBtn');
  const email  = document.getElementById('emailIn').value.trim();
  const pw     = document.getElementById('pwIn').value;

  errEl.classList.remove('show');
  function showErr(msg) { errEl.textContent = '⚠ ' + msg; errEl.classList.add('show'); }

  if (!/\S+@\S+\.\S+/.test(email)) { showErr('EMAIL address is invalid.'); return; }
  if (!pw)                          { showErr('PASSWORD is required.'); return; }

  btn.disabled = true;
  btn.classList.add('loading');
  btn.querySelector('.btn-text').textContent = 'AUTHENTICATING...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Email hoặc mật khẩu không hợp lệ.');
    }

    // Clear any existing account-specific cache from previous sessions
    const keysToRemove = [
      'caltdhy_token',
      'caltdhy_user',
      'caltdhy_txns',
      'caltdhy_budgets',
      'caltdhy_custom_cats',
      'caltdhy_hidden_cats',
      'caltdhy_last_reported_month',
      'caltdhy_is_new_user'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Lưu JWT token và thông tin user thực tế
    localStorage.setItem('caltdhy_token', data.token);
    localStorage.setItem('caltdhy_user', JSON.stringify(data.user));

    setTimeout(() => { window.location.href = 'spending.html'; }, 300);
  } catch (err) {
    showErr(err.message || 'Lỗi kết nối server.');
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.querySelector('.btn-text').textContent = 'LOG IN';
  }
});

/* ESC → go back to index */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') window.location.href = 'index.html';
});

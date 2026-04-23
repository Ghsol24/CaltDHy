/* =============================================
   auth.js – REAL BACKEND MODE
   Backend: https://caltdhy.onrender.com
   ============================================= */

const API_BASE = 'https://caltdhy.onrender.com';

// ---- Tab Switcher ----
function switchTab(tab) {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotForm').style.display = 'none';

    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    if (loginTab) loginTab.classList.remove('active');
    if (registerTab) registerTab.classList.remove('active');

    clearMessages();

    if (tab === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        if (loginTab) loginTab.classList.add('active');
    } else if (tab === 'register') {
        document.getElementById('registerForm').style.display = 'block';
        if (registerTab) registerTab.classList.add('active');
    } else if (tab === 'forgot') {
        document.getElementById('forgotForm').style.display = 'block';
    }
}

function clearMessages() {
    ['loginError', 'registerError', 'registerSuccess', 'forgotError', 'forgotSuccess'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
}

function showMessage(id, message, isError = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = `form-message ${isError ? 'error' : 'success'}`;
    el.style.display = 'block';
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁';
    }
}

function setLoading(btnId, loading, text = '') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
        btn.dataset.original = btn.textContent;
        btn.textContent = '⏳ Đang xử lý...';
    } else {
        btn.textContent = text || btn.dataset.original;
    }
}

// ---- ĐĂNG KÝ ----
async function handleRegister() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;

    clearMessages();

    if (!name || !email || !password || !confirm) {
        showMessage('registerError', 'Vui lòng điền đầy đủ tất cả các trường.');
        return;
    }
    if (password.length < 6) {
        showMessage('registerError', 'Mật khẩu phải có ít nhất 6 ký tự.');
        return;
    }
    if (password !== confirm) {
        showMessage('registerError', 'Mật khẩu xác nhận không khớp.');
        return;
    }

    setLoading('registerBtn', true);

    try {
        const res = await fetch(API_BASE + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            showMessage('registerError', data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
            setLoading('registerBtn', false, 'Tạo tài khoản');
            return;
        }

        // Lưu token và thông tin user
        localStorage.setItem('pcn_token', data.token);
        localStorage.setItem('pcn_user', JSON.stringify(data.user));

        showMessage('registerSuccess', '✅ Đăng ký thành công! Đang chuyển đến trang chính...', false);
        setTimeout(() => { window.location.href = 'spending.html'; }, 1000);

    } catch (err) {
        showMessage('registerError', 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
        setLoading('registerBtn', false, 'Tạo tài khoản');
    }
}

// ---- ĐĂNG NHẬP ----
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    clearMessages();

    if (!email || !password) {
        showMessage('loginError', 'Vui lòng nhập đầy đủ email và mật khẩu.');
        return;
    }

    setLoading('loginBtn', true);

    try {
        const res = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            showMessage('loginError', data.message || 'Email hoặc mật khẩu không đúng.');
            setLoading('loginBtn', false, 'Đăng nhập');
            return;
        }

        // Lưu token và thông tin user
        localStorage.setItem('pcn_token', data.token);
        localStorage.setItem('pcn_user', JSON.stringify(data.user));

        window.location.href = 'spending.html';

    } catch (err) {
        showMessage('loginError', 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
        setLoading('loginBtn', false, 'Đăng nhập');
    }
}

// ---- QUÊN MẬT KHẨU ----
async function handleForgotPassword() {
    const email = document.getElementById('forgotEmail').value.trim();

    clearMessages();

    if (!email) {
        showMessage('forgotError', 'Vui lòng nhập địa chỉ email.');
        return;
    }

    setLoading('forgotBtn', true);

    try {
        const res = await fetch(API_BASE + '/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (data.success) {
            showMessage('forgotSuccess', data.message || 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.', false);
        } else {
            showMessage('forgotError', data.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
        }

    } catch (err) {
        showMessage('forgotError', 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
    } finally {
        setLoading('forgotBtn', false, 'Gửi email đặt lại');
    }
}

// ---- Redirect nếu đã đăng nhập (bỏ qua nếu có ?force=true) ----
(function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('force') === 'true') return;
    const token = localStorage.getItem('pcn_token');
    if (token) window.location.href = 'spending.html';
})();

// ---- Enter key ----
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');

    if (loginForm && loginForm.style.display !== 'none') handleLogin();
    else if (registerForm && registerForm.style.display !== 'none') handleRegister();
    else if (forgotForm && forgotForm.style.display !== 'none') handleForgotPassword();
});

// ---- Auto-switch tab based on ?tab= URL param ----
(function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'register') switchTab('register');
})();

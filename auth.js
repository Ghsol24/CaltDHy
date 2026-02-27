/* =============================================
   auth.js – DEMO MODE (localStorage, không cần server)
   projectcanhan.com
   ============================================= */

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

// ---- Helper: Lấy danh sách users từ localStorage ----
function getUsers() {
    return JSON.parse(localStorage.getItem('pcn_users') || '[]');
}
function saveUsers(users) {
    localStorage.setItem('pcn_users', JSON.stringify(users));
}

// ---- ĐĂNG KÝ (Demo) ----
function handleRegister() {
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

    const users = getUsers();
    if (users.find(u => u.email === email)) {
        showMessage('registerError', 'Email này đã được đăng ký. Vui lòng dùng email khác.');
        return;
    }

    setLoading('registerBtn', true);

    setTimeout(() => {
        const newUser = {
            id: 'user_' + Date.now(),
            name,
            email,
            password // Demo: lưu plain text (production phải hash)
        };
        users.push(newUser);
        saveUsers(users);

        showMessage('registerSuccess', '✅ Đăng ký thành công! Đang chuyển đến trang chính...', false);
        localStorage.setItem('pcn_token', 'demo_token_' + newUser.id);
        localStorage.setItem('pcn_user', JSON.stringify({ id: newUser.id, name: newUser.name, email: newUser.email }));
        localStorage.setItem('caltdhy_user', JSON.stringify({ username: newUser.name, id: newUser.id, email: newUser.email }));

        setTimeout(() => { window.location.href = 'hub.html'; }, 1000);
        setLoading('registerBtn', false, 'Tạo tài khoản');
    }, 600);
}

// ---- ĐĂNG NHẬP (Demo) ----
function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    clearMessages();

    if (!email || !password) {
        showMessage('loginError', 'Vui lòng nhập đầy đủ email và mật khẩu.');
        return;
    }

    setLoading('loginBtn', true);

    setTimeout(() => {
        const users = getUsers();
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            showMessage('loginError', 'Email hoặc mật khẩu không đúng.');
            setLoading('loginBtn', false, 'Đăng nhập');
            return;
        }

        localStorage.setItem('pcn_token', 'demo_token_' + user.id);
        localStorage.setItem('pcn_user', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
        localStorage.setItem('caltdhy_user', JSON.stringify({ username: user.name, id: user.id, email: user.email }));
        window.location.href = 'hub.html';
    }, 600);
}

// ---- QUÊN MẬT KHẨU (Demo) ----
function handleForgotPassword() {
    const email = document.getElementById('forgotEmail').value.trim();

    clearMessages();

    if (!email) {
        showMessage('forgotError', 'Vui lòng nhập địa chỉ email.');
        return;
    }

    setLoading('forgotBtn', true);

    setTimeout(() => {
        const users = getUsers();
        const user = users.find(u => u.email === email);

        if (user) {
            // Demo: hiển thị mật khẩu trực tiếp (không gửi email thật)
            showMessage('forgotSuccess',
                `📧 [DEMO MODE] Mật khẩu của tài khoản "${user.name}" là: "${user.password}"`, false);
        } else {
            showMessage('forgotSuccess',
                'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.', false);
        }

        setLoading('forgotBtn', false, 'Gửi email đặt lại');
    }, 600);
}

// ---- Redirect nếu đã đăng nhập (bỏ qua nếu có ?force=true) ----
(function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('force') === 'true') return; // Người dùng chủ động muốn vào trang login
    const token = localStorage.getItem('pcn_token');
    if (token) window.location.href = 'hub.html';
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

// ---- Auto-switch tab based on ?tab= URL param (e.g. from welcome.html) ----
(function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'register') switchTab('register');
})();


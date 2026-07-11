const http = require('http');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT       = 8080;
const DB_FILE    = path.join(__dirname, 'caltdhy_db.json');
const USERS_FILE = path.join(__dirname, 'caltdhy_users.json');
const STATIC_DIR = path.join(__dirname, 'frontEnd');

/* ── Init DB files ── */
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    transactions: [], budgets: {}, customCategories: []
  }, null, 2));
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
}

/* ── Helpers ── */
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return { users: [] }; }
}

function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + '_caltdhy_salt').digest('hex');
}

/** Tạo token giả dạng JWT (base64 payload, không verify crypto — đủ dùng local) */
function makeToken(user) {
  const header  = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id, email: user.email, name: user.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30  // 30 days
  })).toString('base64url');
  return `${header}.${payload}.local`;
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/* ── Server ── */
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  /* ── AUTH: Register ── */
  if (url === '/api/auth/register' && req.method === 'POST') {
    const { name, email, password } = await readBody(req);
    if (!name || !email || !password)
      return json(res, 400, { success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
    if (password.length < 6)
      return json(res, 400, { success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });

    const db = readUsers();
    const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists)
      return json(res, 409, { success: false, message: 'Email này đã được đăng ký.' });

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeUsers(db);

    const token = makeToken(user);
    return json(res, 201, {
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  }

  /* ── AUTH: Login ── */
  if (url === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await readBody(req);
    if (!email || !password)
      return json(res, 400, { success: false, message: 'Vui lòng nhập email và mật khẩu.' });

    const db   = readUsers();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.passwordHash !== hashPassword(password))
      return json(res, 401, { success: false, message: 'Email hoặc mật khẩu không đúng.' });

    const token = makeToken(user);
    return json(res, 200, {
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  }

  /* ── AUTH: Forgot Password (reset link mock) ── */
  if (url === '/api/auth/forgot-password' && req.method === 'POST') {
    const { email } = await readBody(req);
    // Luôn trả về success (không lộ thông tin account)
    return json(res, 200, {
      success: true,
      message: 'Nếu email tồn tại, link reset sẽ được gửi đến.'
    });
  }

  /* ── AUTH: Reset Password ── */
  if (url === '/api/auth/reset-password' && req.method === 'POST') {
    const { email, password } = await readBody(req);
    if (!email || !password)
      return json(res, 400, { success: false, message: 'Thiếu thông tin.' });

    const db   = readUsers();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user)
      return json(res, 404, { success: false, message: 'Email không tồn tại.' });

    user.passwordHash = hashPassword(password);
    writeUsers(db);
    return json(res, 200, { success: true, message: 'Mật khẩu đã được cập nhật.' });
  }

  /* ── DATA: Load ── */
  if (url === '/api/load' && req.method === 'GET') {
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
      if (err) return json(res, 500, { success: false, error: err.message });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  /* ── DATA: Save ── */
  if (url === '/api/save' && req.method === 'POST') {
    const body = await readBody(req);
    fs.writeFile(DB_FILE, JSON.stringify(body, null, 2), 'utf8', err => {
      if (err) return json(res, 500, { success: false, error: err.message });
      json(res, 200, { success: true });
    });
    return;
  }

  /* ── Static Files ── */
  const staticUrl = url === '/' ? '/spending.html' : url;
  const filePath  = path.join(STATIC_DIR, staticUrl);
  const ext       = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.png': 'image/png',  '.jpg': 'image/jpeg', '.gif': 'image/gif',
    '.svg': 'image/svg+xml', '.json': 'application/json', '.webp': 'image/webp'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '404 Not Found' }));
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 CaltDHy Local Server is running!`);
  console.log(`📂 Database     : ${DB_FILE}`);
  console.log(`👤 Users DB     : ${USERS_FILE}`);
  console.log(`🌐 Open         : http://localhost:${PORT}`);
  console.log(`🔐 Auth APIs    : /api/auth/login | /api/auth/register`);
  console.log('========================================================');
});

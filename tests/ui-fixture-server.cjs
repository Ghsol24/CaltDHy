'use strict';
// Serves the built frontend (frontEnd-react/dist) together with an in-memory
// fixture API, so UI checks can run in a browser without MongoDB or the real
// backend. Data is generated relative to the current month so it never ages.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'
};

const pad = (n) => String(n).padStart(2, '0');
function monthDate(monthOffset, day) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(Math.min(day, last))}`;
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Keep fixture days in the past so "today" logic stays meaningful.
const pastDay = (day) => Math.max(1, Math.min(day, new Date().getDate()));

function buildFixtures() {
  const wallets = [
    { _id: 'w-zalo', name: 'ZaloPay', type: 'ewallet', initialBalance: 1200000, isDefault: true },
    { _id: 'w-cash', name: 'Tiền mặt', type: 'cash', initialBalance: 300000 },
    { _id: 'w-momo', name: 'Momo(tg)', type: 'ewallet', initialBalance: 150000 },
    { _id: 'w-tcb', name: 'Techcombank (Định kỳ).', type: 'bank', initialBalance: 1500000 },
    { _id: 'w-bidv', name: 'BIDV(Hũ)', type: 'bank', initialBalance: 0 },
    { _id: 'w-mb', name: 'MBbank', type: 'bank', initialBalance: 2500000 }
  ];
  let seq = 0;
  const tx = (type, amount, category, day, walletId, desc, extra = {}) => ({
    _id: `t-${++seq}`, type, amount, category, date: monthDate(extra.monthOffset || 0, day), walletId, desc, ...extra
  });
  const transactions = [
    tx('income', 1500000, 'Gift & Bonus', pastDay(24), 'w-mb', 'ba mẹ gửi tiền sinh nhật'),
    tx('expense', 35000, 'Coffee', pastDay(26), 'w-zalo', 'cf'),
    tx('expense', 32000, 'Food & Dining', pastDay(26), 'w-zalo', 'cơm'),
    tx('expense', 67000, 'Food & Dining', pastDay(25), 'w-zalo', 'cơm'),
    tx('expense', 40000, 'Coffee', pastDay(25), 'w-zalo', 'cf'),
    tx('expense', 420000, 'Shopping', pastDay(20), 'w-momo', 'áo khoác'),
    tx('expense', 1108484, 'Shopping', pastDay(12), 'w-tcb', 'tai nghe'),
    tx('expense', 529000, 'Health & Beauty', pastDay(15), 'w-zalo', 'khám răng'),
    tx('expense', 1919224, 'Other Expense', pastDay(9), 'w-mb', 'linh tinh'),
    tx('expense', 698000, 'Coffee', pastDay(8), 'w-cash', 'cf tuần'),
    tx('transfer', 300000, 'Transfer', pastDay(26), 'w-mb', 'Chuyển tiền ví', { toWalletId: 'w-zalo' }),
    tx('income', 6000000, 'Salary', 5, 'w-mb', 'lương', { monthOffset: -1 }),
    tx('expense', 120000, 'Food & Dining', 18, 'w-zalo', 'ăn tối', { monthOffset: -1 })
  ];
  const iso = (offset, day) => `${monthDate(offset, day)}T09:00:00.000Z`;
  const jars = [
    {
      _id: 'j-health', name: 'Sức khoẻ', category: 'Mục tiêu chung', target: 7000000, current: 1500000,
      color: '#E2557A', createdAt: iso(0, 1),
      history: [{ _id: 'h1', type: 'deposit', amount: 1500000, reason: '', date: iso(0, pastDay(2)) }]
    },
    {
      _id: 'j-travel', name: 'Du Lịch (Tích trữ ở BIDV)', category: 'Mục tiêu chung', target: 5000000, current: 500000,
      color: '#3B82F6', createdAt: iso(0, 1),
      history: [
        { _id: 'h2', type: 'deposit', amount: 1000000, reason: '', date: iso(0, pastDay(11)) },
        { _id: 'h3', type: 'withdraw', amount: 765000, reason: '', date: iso(0, pastDay(19)) },
        { _id: 'h4', type: 'withdraw', amount: 5000, reason: '', date: iso(0, pastDay(19)) },
        { _id: 'h5', type: 'withdraw', amount: 100000, reason: '', date: iso(0, pastDay(19)) },
        { _id: 'h6', type: 'deposit', amount: 370000, reason: '', date: iso(0, pastDay(26)) }
      ]
    }
  ];
  const installments = [
    { _id: 'i1', name: 'Giữ xe định kỳ', category: 'Transportation', amount: 50000, cycle: 'monthly', nextDueDate: monthDate(1, 7) },
    { _id: 'i2', name: 'Góp đt', category: 'Shopping', amount: 917000, cycle: 'monthly', nextDueDate: monthDate(0, Math.min(new Date().getDate() + 2, 28)) },
    { _id: 'i3', name: 'Youtube Pre', category: 'Entertainment', amount: 54444, cycle: 'monthly', nextDueDate: monthDate(1, 13) },
    { _id: 'i4', name: 'Trả góp cái bàn', category: 'Shopping', amount: 180484, cycle: 'monthly', nextDueDate: monthDate(1, 24) }
  ];
  const budgets = {
    'Other Expense': 200000, Shopping: 300000, Coffee: 500000, 'Health & Beauty': 400000,
    'Food & Dining': 1500000, Transportation: 1000000
  };
  const user = {
    id: '64b7f0c2a1d3e4f5a6b7c8d9', name: 'Trần Gia Huy', email: 'fixture@example.com', avatar: '', emailVerified: true,
    preferences: { analyticsExcludeRecurring: false, cashFlow: {} }
  };
  return { wallets, transactions, jars, installments, budgets, user };
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function handleApi(req, res, db) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname;
  const ok = (data, extra = {}) => json(res, 200, { success: true, data, ...extra });
  if (p === '/api/auth/csrf') return json(res, 200, { success: true, csrfToken: 'fixture-csrf' });
  if (p === '/api/auth/registration') return json(res, 200, { success: true, inviteOnly: false });
  if (p === '/api/auth/session' || p === '/api/auth/profile') return json(res, 200, { success: true, user: db.user, csrfToken: 'fixture-csrf' });
  if (p === '/api/auth/preferences') return json(res, 200, { success: true, user: db.user, preferences: db.user.preferences });
  if (p === '/api/auth/logout') return json(res, 200, { success: true });
  if (p === '/api/wallets' && req.method === 'GET') return ok(db.wallets, { history: [] });
  if (p === '/api/jars' && req.method === 'GET') return ok(db.jars);
  if (p === '/api/jars/installments' && req.method === 'GET') return ok(db.installments);
  if (p === '/api/spending' && req.method === 'GET') return ok(db.transactions);
  if (p === '/api/spending/budget') return ok(db.budgets);
  if (p === '/api/spending/categories') return ok([]);
  if (p === '/api/spending/expected-days') return ok([]);
  if (p === '/api/health') return json(res, 200, { ok: true });
  return ok(null);
}

async function startUiFixtureServer({ distDir = path.join(__dirname, '..', 'frontEnd-react', 'dist') } = {}) {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Missing build at ${distDir}. Run "npm run build --prefix frontEnd-react" first.`);
  }
  const db = buildFixtures();
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => handleApi(req, res, db));
      return;
    }
    const clean = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    let file = path.normalize(path.join(distDir, clean));
    if (!file.startsWith(distDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, db, close: () => new Promise((resolve) => server.close(resolve)), today };
}

module.exports = { startUiFixtureServer, buildFixtures, monthDate };

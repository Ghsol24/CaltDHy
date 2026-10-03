'use strict';

// Focused integration coverage for historical edits, category layout and transfer wallet order.
// Run after building the frontend: node tests/transaction-period-browser.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { chromium, expect } = require('@playwright/test');
const backend = createRequire(path.resolve(__dirname, '../backEnd/server/package.json'));
const mongoose = backend('mongoose');
const { MongoMemoryReplSet } = backend('mongodb-memory-server');
let server, db, browser;
let passed = 0;
const evidenceDir = process.env.TRANSACTION_QA_DIR || path.join(os.tmpdir(), 'caltdhy-transaction-period-evidence');
async function check(name, work) {
  await work();
  passed += 1;
  console.log('PASS ' + name);
}

(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_EXPIRES_IN: '1h', HOST: '127.0.0.1', REGISTRATION_MODE: 'open',
    AUTH_RATE_LIMIT_MAX: '1000', API_RATE_LIMIT_MAX: '100000'
  });
  for (const key of ['MONGODB_URI', 'CLIENT_URL', 'CORS_WHITELIST', 'GMAIL_USER', 'GMAIL_PASS', 'COOKIE_SECURE']) {
    delete process.env[key];
  }
  let app;
  server = http.createServer((req, res) => app(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.PORT = String(server.address().port);
  app = backend('./server');
  db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(db.getUri('caltdhy_transaction_period_test'));
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
  }
  const baseURL = 'http://127.0.0.1:' + server.address().port;
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } :
      process.platform === 'darwin' && fs.existsSync(localChrome) ? { executablePath: localChrome } : {})
  });
  const context = await browser.newContext({ baseURL, locale: 'vi-VN', serviceWorkers: 'block',
    timezoneId: 'Asia/Ho_Chi_Minh', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-02T05:00:00Z'));
  const actorName = 'Period Audit User';
  const email = 'period-' + crypto.randomUUID() + '@example.test';
  await page.goto('/signup');
  await page.locator('#fullName').fill(actorName);
  await page.locator('#emailIn').fill(email);
  await page.locator('#pwIn').fill('Browser-test-1234');
  await page.locator('#signupForm button[type=submit]').click();
  await page.waitForURL('**/spending/home');
  await expect(page.locator('.user-chip-name')).toHaveText(actorName);

  const user = await backend('./models/User').findOne({ email });
  const Wallet = backend('./models/Wallet');
  const primary = await Wallet.findOneAndUpdate({ userId: user._id, isDefault: true },
    { name: 'Ví chính', initialBalance: 3000000 }, { new: true });
  assert.ok(primary);
  // Deliberately create these in a different order from their signed balances.
  await Wallet.insertMany([
    { userId: user._id, name: 'Tiền mặt rỗng', type: 'cash', initialBalance: 0 },
    { userId: user._id, name: 'MoMo', type: 'e-wallet', initialBalance: 1000000 },
    { userId: user._id, name: 'Thẻ dư nợ', type: 'credit', initialBalance: -200000, creditLimit: 10000000 },
    { userId: user._id, name: 'Ngân hàng lớn', type: 'bank', initialBalance: 6000000 },
    { userId: user._id, name: 'Ví bằng số dư', type: 'cash', initialBalance: 1000000 }
  ]);
  const { csrfToken } = await (await context.request.get('/api/auth/csrf')).json();
  async function mutate(method, url, data) {
    const response = await context.request[method](url, {
      headers: { 'X-CSRF-Token': csrfToken, 'Idempotency-Key': crypto.randomUUID() }, data
    });
    assert.ok(response.ok(), `${method} ${url}: ${response.status()} ${await response.text()}`);
    return response.json();
  }
  // Past budgets are already closed to budget edits; seed those historical facts directly.
  await backend('./models/Budget').insertMany([
    { userId: user._id, category: 'Ăn uống', month: '2026-09', limit: 100000 },
    { userId: user._id, category: 'Ăn uống', month: '2026-10', limit: 500000 }
  ]);
  const past = (await mutate('post', '/api/spending', {
    type: 'expense', amount: 30000, category: 'Ăn uống', date: '2026-09-28',
    walletId: primary.id, desc: 'Giao dịch tháng 9'
  })).data;
  await mutate('post', '/api/spending', {
    type: 'expense', amount: 20000, category: 'Ăn uống', date: '2026-10-01',
    walletId: primary.id, desc: 'Chi tháng 10'
  });
  const toDelete = (await mutate('post', '/api/spending', {
    type: 'expense', amount: 5000, category: 'Cà phê', date: '2026-09-30',
    walletId: primary.id, desc: 'Xóa tháng 9'
  })).data;
  const pastId = past.id || past._id;
  const deleteId = toDelete.id || toDelete._id;
  const legacy = await backend('./models/Transaction').create({
    userId: user._id, walletId: null, type: 'expense', amount: 10000,
    category: 'Cà phê', date: '2026-09-29', desc: 'Giao dịch cũ không gắn ví'
  });
  const modal = page.getByRole('dialog', { name: 'Chỉnh sửa giao dịch', exact: true });
  const confirmation = page.locator('.confirm-dialog-card');
  const mealCard = () => modal.locator('.txn-category-card').filter({ has: page.locator('.txn-card-name', { hasText: /^Ăn uống$/ }) });
  const historyRow = description => page.locator('.transaction-ledger-row').filter({ hasText: description });
  async function openPast(description = 'Giao dịch tháng 9') {
    await page.goto('/spending/analytics/transactions');
    await historyRow(description).click();
    await expect(modal).toBeVisible();
  }
  async function ledger() {
    const response = await context.request.get('/api/spending');
    assert.equal(response.status(), 200);
    return (await response.json()).data;
  }

  await check('historical editing uses the September budget and previews the draft once', async () => {
    await openPast();
    await expect(modal.locator('.txn-period-notice')).toContainText('tháng 9 năm 2026');
    await expect(modal.locator('.txn-budget-period').first()).toContainText('tháng 9 năm 2026');
    await expect(mealCard().locator('.txn-card-amount')).toContainText(/70\.000\s*₫/);
    await modal.locator('#txn-amount-input').fill('40000');
    await expect(mealCard().locator('.txn-card-amount')).toContainText(/60\.000\s*₫/);
    await modal.locator('.txn-btn-submit').click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText('tháng 9 năm 2026');
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText(/10\.000\s*₫/);
    assert.equal((await ledger()).find(tx => (tx.id || tx._id) === pastId).amount, 30000);
  });

  await check('cancelling and Escape preserve the historical edit form and draft', async () => {
    await confirmation.locator('.confirm-dialog-btn').first().click();
    await expect(confirmation).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(modal.locator('#txn-amount-input')).toHaveValue('40.000');
    await modal.locator('.txn-btn-submit').click();
    await expect(confirmation).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirmation).toHaveCount(0);
    await expect(modal).toBeVisible();
    await expect(modal.locator('#txn-amount-input')).toHaveValue('40.000');
    await modal.locator('.txn-btn-submit').click();
    await expect(confirmation).toBeVisible();
    await confirmation.locator('.confirm-dialog-btn').last().click();
    await expect(modal).toHaveCount(0);
    assert.equal((await ledger()).find(tx => (tx.id || tx._id) === pastId).amount, 40000);
  });

  await check('reopening shows an audit with the amount before/after and actor; note-only save needs no confirmation', async () => {
    await openPast();
    await modal.locator('.txn-revisions-toggle').click();
    await expect(modal.locator('.txn-revision-entry')).toHaveCount(1);
    await expect(modal.locator('.txn-revision-entry')).toContainText(actorName);
    await expect(modal.locator('.txn-revision-entry')).toContainText(/30\.000\s*₫\s*→\s*40\.000\s*₫/);
    await modal.locator('#txn-desc-input').fill('Giao dịch tháng 9 — ghi chú đã sửa');
    await modal.locator('.txn-btn-submit').click();
    await expect(modal).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    const saved = (await ledger()).find(tx => (tx.id || tx._id) === pastId);
    assert.equal(saved.amount, 40000);
    assert.equal(saved.date, '2026-09-28');
    assert.equal(saved.desc, 'Giao dịch tháng 9 — ghi chú đã sửa');
  });

  await check('legacy walletless notes-only edit preserves the absent wallet and every wallet balance', async () => {
    const before = (await (await context.request.get('/api/wallets/balances')).json()).data;
    await openPast('Giao dịch cũ không gắn ví');
    await modal.locator('#txn-desc-input').fill('Giao dịch cũ không gắn ví — đã sửa ghi chú');
    await modal.locator('.txn-btn-submit').click();
    await expect(modal).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    const saved = (await ledger()).find(tx => (tx.id || tx._id) === legacy.id);
    assert.equal(saved.walletId, null);
    assert.equal(saved.amount, 10000);
    assert.equal(saved.date, '2026-09-29');
    assert.equal(saved.desc, 'Giao dịch cũ không gắn ví — đã sửa ghi chú');
    const after = (await (await context.request.get('/api/wallets/balances')).json()).data;
    assert.deepEqual(after, before);
  });

  const septemberBudget = url => url.pathname === '/api/spending/budget' && url.searchParams.get('month') === '2026-09';
  await check('a delayed September budget response cannot overwrite the October date preview', async () => {
    let held = false, release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(septemberBudget, async route => {
      const response = await route.fetch();
      held = true;
      await gate;
      await route.fulfill({ response });
    });
    try {
      await openPast('Giao dịch tháng 9 — ghi chú đã sửa');
      await expect.poll(() => held).toBe(true);
      await modal.locator('#txn-date-input').fill('2026-10-01');
      await expect(mealCard().locator('.txn-card-amount')).toContainText(/440\.000\s*₫/);
      const completed = page.waitForResponse(response => septemberBudget(new URL(response.url())));
      release();
      await completed;
      await expect(modal.locator('.txn-budget-period').first()).toContainText('tháng 10 năm 2026');
      await expect(mealCard().locator('.txn-card-amount')).toContainText(/440\.000\s*₫/);
      await modal.locator('.txn-modal-close-btn').click();
    } finally {
      release();
      await page.unroute(septemberBudget);
    }
  });

  await check('failed historical budget fetch hides limits until an explicit retry succeeds', async () => {
    let fail = true;
    await page.route(septemberBudget, route => fail
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"success":false,"message":"Budget fixture unavailable"}' })
      : route.continue());
    try {
      await openPast('Giao dịch tháng 9 — ghi chú đã sửa');
      await expect(modal.locator('.txn-budget-error')).toBeVisible();
      await expect(modal.locator('.txn-card-amount')).toHaveCount(0);
      fail = false;
      await modal.locator('.txn-budget-error button').click();
      await expect(mealCard().locator('.txn-card-amount')).toContainText(/60\.000\s*₫/);
      await expect(modal.locator('.txn-budget-error')).toHaveCount(0);
      await modal.locator('.txn-modal-close-btn').click();
    } finally { await page.unroute(septemberBudget); }
  });

  await check('historical notice and audit fit desktop/mobile and all four themes', async () => {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const noticeBackgrounds = new Set();
    for (const theme of ['dark', 'cream', 'green', 'light']) {
      await page.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
      for (const [device, viewport] of [
        ['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]
      ]) {
        await page.setViewportSize(viewport);
        await openPast('Giao dịch tháng 9 — ghi chú đã sửa');
        await expect(page.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
        await expect(modal.locator('.txn-period-notice')).toBeVisible();
        await expect(mealCard().locator('.txn-card-amount')).toContainText(/60\.000\s*₫/);
        const noticePalette = await modal.locator('.txn-period-notice').evaluate(element => {
          const color = css => css.match(/[\d.]+/g).map(Number);
          const blend = (foreground, background) => foreground.slice(0, 3)
            .map((channel, index) => channel * (foreground[3] ?? 1) + background[index] * (1 - (foreground[3] ?? 1)));
          const effectiveBackground = node => {
            const ancestors = [];
            for (let current = node; current; current = current.parentElement) ancestors.unshift(current);
            return ancestors.reduce((background, current) => blend(color(getComputedStyle(current).backgroundColor), background), [255, 255, 255]);
          };
          const luminance = rgb => rgb.map(value => value / 255)
            .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
          const contrast = node => {
            const background = effectiveBackground(node);
            const foreground = blend(color(getComputedStyle(node).color), background);
            const first = luminance(foreground), second = luminance(background);
            return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
          };
          return { background: getComputedStyle(element).backgroundColor,
            contrast: [...element.querySelectorAll('strong, span')].map(contrast) };
        });
        noticeBackgrounds.add(noticePalette.background);
        assert.ok(noticePalette.contrast.every(value => value >= 4.5),
          `${theme}/${device}: historical notice contrast ${noticePalette.contrast.join(', ')} must be ≥4.5:1`);
        const layout = await modal.evaluate(element => {
          const box = element.getBoundingClientRect();
          const footer = element.querySelector('.txn-modal-footer').getBoundingClientRect();
          const body = element.querySelector('.txn-modal-body');
          return { left: box.left, right: box.right, width: innerWidth,
            footerTop: footer.top, footerBottom: footer.bottom, height: innerHeight,
            bodyOverflow: body.scrollWidth - body.clientWidth,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        assert.ok(layout.left >= -1 && layout.right <= layout.width + 1, `${theme}/${device}: modal fits horizontally`);
        assert.ok(layout.footerTop >= 0 && layout.footerBottom <= layout.height + 1, `${theme}/${device}: save actions remain reachable`);
        assert.ok(layout.bodyOverflow <= 1 && layout.documentOverflow <= 1, `${theme}/${device}: no horizontal overflow`);
        await page.screenshot({ path: path.join(evidenceDir, `${device}-${theme}-period.png`), animations: 'disabled' });
        await modal.locator('.txn-revisions-toggle').click();
        await expect(modal.locator('.txn-revision-entry')).toHaveCount(2);
        await expect(modal.locator('.txn-revision-entry').first()).toContainText(actorName);
        await modal.locator('.txn-revision-entry').last().scrollIntoViewIfNeeded();
        assert.equal(await modal.locator('.txn-revisions-content').evaluate(element => element.scrollWidth > element.clientWidth + 1), false,
          `${theme}/${device}: audit values must wrap inside the modal`);
        await page.screenshot({ path: path.join(evidenceDir, `${device}-${theme}-audit.png`), animations: 'disabled' });
        await modal.locator('#txn-amount-input').fill('50000');
        await modal.locator('.txn-btn-submit').click();
        await expect(confirmation).toBeVisible();
        await expect(confirmation.locator('.confirm-dialog-message')).toContainText('tháng 9 năm 2026');
        const confirmLayout = await confirmation.evaluate(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
            width: innerWidth, height: innerHeight, overflow: element.scrollWidth - element.clientWidth };
        });
        assert.ok(confirmLayout.left >= -1 && confirmLayout.right <= confirmLayout.width + 1
          && confirmLayout.top >= -1 && confirmLayout.bottom <= confirmLayout.height + 1
          && confirmLayout.overflow <= 1, `${theme}/${device}: historical confirmation must fit the viewport`);
        await page.screenshot({ path: path.join(evidenceDir, `${device}-${theme}-confirm.png`), animations: 'disabled' });
        await confirmation.locator('.confirm-dialog-btn').first().click();
        await expect(confirmation).toHaveCount(0);
        await modal.locator('.txn-modal-close-btn').click();
      }
    }
    assert.ok(noticeBackgrounds.size >= 3, 'Historical notice must adapt to each theme');
  });

  await check('moving September expense to October previews October and confirms both affected months', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPast('Giao dịch tháng 9 — ghi chú đã sửa');
    await modal.locator('#txn-date-input').fill('2026-10-01');
    await expect(modal.locator('.txn-budget-period').first()).toContainText('tháng 10 năm 2026');
    await expect(mealCard().locator('.txn-card-amount')).toContainText(/440\.000\s*₫/);
    await modal.locator('.txn-btn-submit').click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText('tháng 9 năm 2026');
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText('tháng 10 năm 2026');
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText(/40\.000\s*₫/);
    await confirmation.locator('.confirm-dialog-btn').last().click();
    await expect(modal).toHaveCount(0);
    const saved = (await ledger()).find(tx => (tx.id || tx._id) === pastId);
    assert.equal(saved.date, '2026-10-01');
    assert.equal(saved.amount, 40000);
    const budgets = await (await context.request.get('/api/spending/budget?month=2026-10')).json();
    assert.equal(budgets.data['Ăn uống'], 500000, 'Draft editing must not mutate the selected dashboard budget');
  });

  await check('homepage deletion of a previous-month entry explains historical impact and records deletion', async () => {
    await page.goto('/spending/home');
    const row = page.locator('.home-txn-row').filter({ hasText: 'Xóa tháng 9' });
    await row.hover();
    await row.locator('.home-txn-btn-action--delete').click();
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText('tháng 9 năm 2026');
    await expect(confirmation.locator('.confirm-dialog-message')).toContainText(/5\.000\s*₫/);
    await confirmation.locator('.confirm-dialog-btn').last().click();
    await expect(row).toHaveCount(0);
    assert.ok(!(await ledger()).some(tx => (tx.id || tx._id) === deleteId));
    const revision = await backend('./models/TransactionRevision').findOne({ userId: user._id, transactionId: deleteId, action: 'delete' });
    assert.ok(revision);
    assert.equal(revision.actorName, actorName);
    assert.equal(revision.before.amount, 5000);
    assert.equal(revision.after, null);
  });

  await check('both transfer dropdowns sort current signed balances descending and exclude the source', async () => {
    await page.goto('/spending/plan/wallets');
    await page.getByRole('button', { name: 'Chuyển tiền', exact: true }).first().click();
    const transfer = page.getByRole('dialog', { name: 'Chuyển tiền giữa các ví', exact: true });
    await expect(transfer).toBeVisible();
    await expect(transfer.locator('#from-wallet-select')).toContainText('Ví chính');
    await transfer.locator('#from-wallet-select').click();
    const sourceOptions = transfer.locator('#from-wallet-select-listbox .custom-wallet-item-name');
    await expect(sourceOptions).toHaveText(['Ngân hàng lớn', 'Ví chính', 'MoMo', 'Ví bằng số dư', 'Tiền mặt rỗng', 'Thẻ dư nợ']);
    await page.keyboard.press('Escape');
    await transfer.locator('#to-wallet-select').click();
    await expect(transfer.locator('#to-wallet-select-listbox .custom-wallet-item-name'))
      .toHaveText(['Ngân hàng lớn', 'MoMo', 'Ví bằng số dư', 'Tiền mặt rỗng', 'Thẻ dư nợ']);
    await transfer.locator('#to-wallet-select-listbox .custom-wallet-item').filter({ hasText: 'Ngân hàng lớn' }).click();
    await transfer.locator('#from-wallet-select').click();
    await transfer.locator('#from-wallet-select-listbox .custom-wallet-item').filter({ hasText: 'Ngân hàng lớn' }).click();
    await transfer.locator('#to-wallet-select').click();
    await expect(transfer.locator('#to-wallet-select-listbox .custom-wallet-item-name'))
      .toHaveText(['Ví chính', 'MoMo', 'Ví bằng số dư', 'Tiền mặt rỗng', 'Thẻ dư nợ']);
    await page.keyboard.press('Escape');
    await transfer.locator('.txn-modal-close-btn').click();
  });

  // Real saved categories exercise the production modal, including budget amounts/statuses.
  // Keep this fixture after the historical audit checks so their revision counts remain stable.
  const layoutCategories = ['Ăn uống', 'Sức khỏe và chăm sóc cá nhân dài hạn',
    'Học tập và phát triển kỹ năng chuyên môn', 'Chi phí gia đình và hỗ trợ người thân',
    'Mua sắm thiết bị phục vụ công việc',
    ...Array.from({ length: 13 }, (_, index) =>
      `Danh mục ${String(index + 1).padStart(2, '0')} — chi tiêu chăm sóc gia đình dài hạn`)];
  assert.ok(layoutCategories.every(name => name.length <= 50), 'Category fixture respects the API name limit');
  await mutate('put', '/api/spending/categories', { categories: layoutCategories });
  await backend('./models/Budget').insertMany(layoutCategories.slice(1).map(category => ({
    userId: user._id, category, month: '2026-10', limit: 987654321
  })));

  async function openCategoryLayout(theme, viewport) {
    await page.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
    await page.setViewportSize(viewport);
    await openPast('Giao dịch tháng 9 — ghi chú đã sửa');
    await expect(page.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
    await expect(modal.locator('.txn-category-card')).toHaveCount(layoutCategories.length);
    await expect(modal.locator('.txn-card-amount')).toHaveCount(layoutCategories.length);
  }

  async function assertCategoryLayout(name, columns) {
    const layout = await modal.evaluate(element => {
      const bounds = node => {
        const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const body = element.querySelector('.txn-modal-body');
      const grid = element.querySelector('.txn-category-grid');
      const cards = [...grid.querySelectorAll('.txn-category-card')].map(card => {
        const name = card.querySelector('.txn-card-name');
        const range = document.createRange();
        range.selectNodeContents(name);
        return { box: bounds(card), name: bounds(name), text: name.textContent,
          textRects: [...range.getClientRects()].map(({ left, right, top, bottom }) => ({ left, right, top, bottom })),
          children: [...card.querySelectorAll('.txn-card-icon, .txn-card-name, .txn-card-amount, .txn-card-subtitle, .txn-card-progress-track, .txn-card-income-tag')]
            .map(child => ({ selector: child.className, box: bounds(child) })) };
      });
      const originalBodyScroll = body.scrollTop;
      body.scrollTop = 32;
      const bodyCanScroll = body.scrollTop > 0;
      body.scrollTop = originalBodyScroll;
      // Probe actual scroll behavior, including overflow:hidden containers that can
      // still scroll programmatically. This detects nested clipping without copying CSS.
      const nestedScrollers = [...element.querySelectorAll('*')].filter(node => {
        if (node === body || !node.clientHeight || node.scrollHeight <= node.clientHeight + 1) return false;
        const previous = node.scrollTop;
        node.scrollTop = 1;
        const scrolls = node.scrollTop > 0;
        node.scrollTop = previous;
        return scrolls;
      }).map(node => node.className);
      return { cards, grid: bounds(grid), bodyCanScroll, nestedScrollers,
        bodyOverflow: body.scrollWidth - body.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        modal: bounds(element), footer: bounds(element.querySelector('.txn-modal-footer')),
        viewport: { width: innerWidth, height: innerHeight } };
    });
    const firstRow = layout.cards.filter(card => Math.abs(card.box.top - layout.cards[0].box.top) <= 1);
    assert.equal(firstRow.length, columns, `${name}: expected ${columns} cards in the first row`);
    assert.ok(layout.bodyCanScroll, `${name}: many categories remain reachable through the modal body`);
    assert.deepEqual(layout.nestedScrollers, [], `${name}: the body is the only vertical scroll region`);
    assert.ok(layout.bodyOverflow <= 1 && layout.documentOverflow <= 1, `${name}: no horizontal page/body overflow`);
    assert.ok(layout.modal.left >= -1 && layout.modal.right <= layout.viewport.width + 1,
      `${name}: modal fits the viewport width`);
    assert.ok(layout.footer.top >= 0 && layout.footer.bottom <= layout.viewport.height + 1,
      `${name}: save actions stay visible on short screens`);
    for (const card of layout.cards) {
      assert.ok(card.name.height > 0 && card.textRects.length > 0, `${name}: ${card.text} has visible text`);
      for (const text of card.textRects) {
        assert.ok(text.left >= card.name.left - 1 && text.right <= card.name.right + 1
          && text.top >= card.name.top - 1 && text.bottom <= card.name.bottom + 1,
        `${name}: the full name wraps inside its box: ${card.text}`);
      }
      for (const child of card.children) {
        assert.ok(child.box.left >= card.box.left - 1 && child.box.right <= card.box.right + 1
          && child.box.top >= card.box.top - 1 && child.box.bottom <= card.box.bottom + 1,
        `${name}: ${child.selector} stays inside ${card.text}`);
      }
    }
    return layout;
  }

  await check('many long category names fit desktop/mobile across all four themes with one modal scroll region', async () => {
    fs.mkdirSync(evidenceDir, { recursive: true });
    for (const theme of ['dark', 'cream', 'green', 'light']) {
      for (const [device, viewport, columns] of [
        ['compact-desktop', { width: 1024, height: 640 }, 3],
        ['mobile-boundary', { width: 599, height: 600 }, 1]
      ]) {
        await openCategoryLayout(theme, viewport);
        const layout = await assertCategoryLayout(`${theme}/${device}`, columns);
        if (columns === 3) assert.ok(layout.cards.some(card => card.textRects.length > 1),
          `${theme}/${device}: long-name fixture must exercise multiline wrapping`);
        await page.screenshot({ path: path.join(evidenceDir, `${device}-${theme}-categories.png`), animations: 'disabled' });
        await modal.locator('.txn-modal-close-btn').click();
      }
    }
  });

  await check('category layout survives the 599/600 breakpoint and simulated larger text on short screens', async () => {
    await openCategoryLayout('light', { width: 600, height: 600 });
    await assertCategoryLayout('light/600px desktop boundary', 3);
    await modal.locator('.txn-modal-close-btn').click();
    await openCategoryLayout('cream', { width: 390, height: 568 });
    await assertCategoryLayout('cream/390px short mobile', 1);
    // Capture the natural opening position before scrolling to the final category.
    await page.screenshot({ path: path.join(evidenceDir, 'mobile-cream-categories-opening.png'), animations: 'disabled' });
    // CSS font pressure is deliberate fixture emulation, not a claim that Chrome's
    // minimum-font-size preference or an old Windows installation was exercised.
    const largeText = await page.addStyleTag({ content:
      '.txn-card-name, .txn-card-amount, .txn-card-subtitle { font-size: 20px !important; }' });
    try {
      await assertCategoryLayout('cream/390px simulated 20px text', 1);
      await page.screenshot({ path: path.join(evidenceDir, 'mobile-cream-categories-large-text.png'), animations: 'disabled' });
      await page.setViewportSize({ width: 800, height: 480 });
      await assertCategoryLayout('cream/800px short desktop simulated 20px text', 3);
    } finally { await largeText.evaluate(element => element.remove()); }
    await page.setViewportSize({ width: 320, height: 480 });
    await assertCategoryLayout('cream/320px narrow mobile', 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(evidenceDir, 'mobile-cream-categories.png'), animations: 'disabled' });
    await modal.locator('.txn-modal-close-btn').click();
  });

  await check('the final category is selectable by body scrolling and its saved value persists', async () => {
    await openCategoryLayout('cream', { width: 390, height: 568 });
    const lastName = layoutCategories.at(-1);
    const lastCard = modal.locator('.txn-category-card').last();
    await expect(lastCard.locator('.txn-card-name')).toHaveText(lastName);
    await lastCard.click();
    await expect(lastCard).toHaveAttribute('aria-checked', 'true');
    assert.ok(await modal.locator('.txn-modal-body').evaluate(element => element.scrollTop > 0),
      'Selecting the final category scrolls the sole modal body');
    await page.screenshot({ path: path.join(evidenceDir, 'mobile-cream-last-category-selected.png'), animations: 'disabled' });
    await modal.locator('.txn-btn-submit').click();
    await expect(modal).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    const saved = (await ledger()).find(tx => (tx.id || tx._id) === pastId);
    assert.equal(saved.category, lastName);
    assert.equal(saved.amount, 40000);
    assert.equal(saved.date, '2026-10-01');
    assert.equal(saved.walletId, primary.id);
    await openPast('Giao dịch tháng 9 — ghi chú đã sửa');
    await expect(modal.locator('.txn-category-card[aria-checked="true"] .txn-card-name')).toHaveText(lastName);
    await modal.locator('.txn-modal-close-btn').click();
  });

  await check('unset budgets and the wallet menu remain usable after scrolling a long category list', async () => {
    const octoberBudget = url => url.pathname === '/api/spending/budget' && url.searchParams.get('month') === '2026-10';
    await page.route(octoberBudget, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} })
    }));
    try {
      await openCategoryLayout('light', { width: 320, height: 480 });
      await expect(modal.locator('.txn-category-card.is-unset')).toHaveCount(layoutCategories.length);
      await assertCategoryLayout('light/320px unset budgets', 1);
      const wallet = modal.locator('.custom-wallet-trigger');
      await wallet.click();
      const lastOption = modal.locator('.custom-wallet-item').last();
      const lastWalletName = await lastOption.locator('.custom-wallet-item-name').innerText();
      await page.keyboard.press('End');
      await expect(lastOption).toHaveClass(/is-highlighted/);
      const visible = await lastOption.evaluate(element => {
        const box = element.getBoundingClientRect();
        const footer = element.closest('.txn-modal-card').querySelector('.txn-modal-footer').getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return box.top >= 0 && box.bottom <= footer.top + 1 && !!hit && element.contains(hit);
      });
      assert.ok(visible, 'The final wallet option is visible above the fixed footer');
      await page.keyboard.press('Enter');
      await expect(modal.locator('.custom-wallet-menu')).toHaveCount(0);
      await expect(wallet).toContainText(lastWalletName);
      await modal.locator('.txn-modal-close-btn').click();
    } finally { await page.unroute(octoberBudget); }
  });

  await check('budget failure and income cards keep their labels readable on mobile', async () => {
    await openCategoryLayout('light', { width: 390, height: 568 });
    await page.route(septemberBudget, route => route.fulfill({
      status: 503, contentType: 'application/json', body: '{"success":false,"message":"Budget fixture unavailable"}'
    }));
    try {
      await modal.locator('#txn-date-input').fill('2026-09-28');
      await expect(modal.locator('.txn-budget-error')).toBeVisible();
      await expect(modal.locator('.txn-card-income-tag')).toHaveCount(layoutCategories.length);
      await assertCategoryLayout('mobile/failed budget labels', 1);
      await modal.locator('.txn-type-btn--income').click();
      await expect(modal.locator('.txn-category-card')).not.toHaveCount(0);
      await expect(modal.locator('.txn-card-amount')).toHaveCount(0);
      await assertCategoryLayout('mobile/income labels', 1);
      await modal.locator('.txn-modal-close-btn').click();
    } finally { await page.unroute(septemberBudget); }
  });
  assert.deepEqual(errors, []);
  console.log(`PASS ${passed} transaction period/browser scenarios; screenshots: ${evidenceDir}`);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await mongoose.disconnect();
  if (db) await db.stop();
});

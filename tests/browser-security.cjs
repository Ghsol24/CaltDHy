'use strict';
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { chromium, expect } = require('@playwright/test');
const backend = createRequire(require('node:path').resolve(__dirname, '../backEnd/server/package.json'));
const mongoose = backend('mongoose');
const { MongoMemoryReplSet } = backend('mongodb-memory-server');
let server, db, browser;
let passed = 0;
async function check(name, work) { await work(); passed += 1; console.log('PASS ' + name); }
const password = 'Browser-test-1234';

(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_EXPIRES_IN: '1h', HOST: '127.0.0.1', AUTH_RATE_LIMIT_MAX: '1000', API_RATE_LIMIT_MAX: '100000' });
  for (const key of ['MONGODB_URI', 'CLIENT_URL', 'CORS_WHITELIST', 'GMAIL_USER', 'GMAIL_PASS', 'COOKIE_SECURE']) delete process.env[key];
  let app;
  server = http.createServer((req, res) => app(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.PORT = String(server.address().port);
  app = backend('./server');
  db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(db.getUri('caltdhy_browser_test'));
  for (const model of Object.values(mongoose.models)) { await model.createCollection(); await model.createIndexes(); }
  const baseURL = 'http://127.0.0.1:' + server.address().port;
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } :
      process.platform === 'darwin' && fs.existsSync(localChrome) ? { executablePath: localChrome } : {}) });
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const emailA = 'a-' + crypto.randomUUID() + '@example.test';
  const emailB = 'b-' + crypto.randomUUID() + '@example.test';
  async function signup(page, name, email) {
    await page.goto('/signup');
    await page.locator('#fullName').fill(name);
    await page.locator('#emailIn').fill(email);
    await page.locator('#pwIn').fill(password);
    await page.locator('#signupForm button[type=submit]').click();
    await page.waitForURL('**/spending/home');
    await expect(page.locator('.user-chip-name')).toHaveText(name);
  }
  async function logout(page) {
    await page.locator('.tb-settings-btn').click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await page.locator('.confirm-dialog-card button').filter({ hasText: /Đăng xuất/i }).click();
    await page.waitForURL('**/login');
  }
  await check('register through UI, verified server session, HttpOnly cookies, no stored credentials', async () => {
    await signup(page, 'Account Alpha', emailA);
    const cookies = await context.cookies();
    assert.ok(cookies.find(cookie => cookie.name === 'caltdhy_session')?.httpOnly);
    assert.ok(!await page.evaluate(() => document.cookie.includes('caltdhy_session')));
    const stored = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(!stored.some(key => /token|wallets|txns|jars|budgets|caltdhy_user/.test(key)));
  });
  const second = await context.newPage();
  await second.goto('/spending');
  await expect(second.locator('.user-chip-name')).toHaveText('Account Alpha');
  await check('four themes retain usable authenticated account controls', async () => {
    for (const theme of ['dark', 'cream', 'green', 'light']) {
      await page.evaluate(value => { localStorage.setItem('caltdhy_theme', value); }, theme);
      await page.reload();
      await expect(page.locator('.user-chip-name')).toBeVisible();
      await expect(page.locator('.tb-settings-btn')).toBeVisible();
    }
  });
  await check('settings and account entry points share one accessible Settings Center', async () => {
    const settingsButton = page.locator('.tb-settings-btn');
    await settingsButton.click();
    const settingsDialog = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog.getByRole('button', { name: 'Ngôn ngữ & khu vực' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['Hồ sơ', 'Bảo mật', 'Dữ liệu & quyền riêng tư', 'Giao diện', 'Hướng dẫn sử dụng', 'Đăng xuất']) {
      await expect(settingsDialog.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    const languageGroup = settingsDialog.getByRole('group', { name: 'Ngôn ngữ' });
    const currencyGroup = settingsDialog.getByRole('group', { name: 'Đơn vị tiền hiển thị' });
    await expect(languageGroup.getByRole('button')).toHaveCount(3);
    await expect(currencyGroup.getByRole('button', { name: 'VND' })).toHaveAttribute('aria-pressed', 'true');
    await expect(currencyGroup.getByRole('button', { name: 'USD' })).toBeDisabled();
    for (const [buttonName, locale] of [['English', 'en'], ['简体中文', 'zh-CN'], ['Tiếng Việt', 'vi']]) {
      await page.locator('.settings-center-dialog').getByRole('button', { name: buttonName, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('.settings-center-dialog')).toHaveAccessibleName({ en: 'Settings', 'zh-CN': '设置', vi: 'Cài đặt' }[locale]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true,
        `${locale}: Settings không được tràn ngang`);
    }
    await settingsDialog.getByRole('button', { name: 'Giao diện', exact: true }).click();
    const themeGroup = settingsDialog.getByRole('group', { name: 'Chọn giao diện' });
    await expect(themeGroup.getByRole('button')).toHaveCount(4);
    await themeGroup.getByRole('button', { name: 'Giao diện Tối' }).click();
    await expect(page.locator('html')).toHaveClass(/dark-theme/);
    await themeGroup.getByRole('button', { name: 'Giao diện Sáng' }).click();
    await expect(page.locator('html')).toHaveClass(/light-theme/);
    await settingsDialog.getByRole('button', { name: 'Hướng dẫn sử dụng', exact: true }).click();
    await settingsDialog.getByRole('button', { name: 'Mở hướng dẫn' }).click();
    const guideDialog = page.getByRole('dialog', { name: 'Sổ tay hướng dẫn CaltDHy' });
    await expect(guideDialog).toBeVisible();
    await guideDialog.getByRole('button', { name: 'Đóng hướng dẫn' }).click();
    await settingsButton.click();
    await expect(settingsDialog.getByRole('button', { name: 'Ngôn ngữ & khu vực' })).toHaveAttribute('aria-current', 'page');
    await settingsDialog.getByRole('button', { name: 'Đóng trung tâm cài đặt' }).click();
    await expect(settingsDialog).toHaveCount(0);
    await expect(settingsButton).toBeFocused();

    await page.locator('.user-chip').click();
    const profileDialog = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(profileDialog.getByRole('button', { name: 'Hồ sơ', exact: true })).toHaveAttribute('aria-current', 'page');
    const displayName = profileDialog.locator('#acc-display-name');
    await displayName.fill('Tên chưa lưu');
    await profileDialog.getByRole('button', { name: 'Đóng trung tâm cài đặt' }).click();
    await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(profileDialog).toBeVisible();
    await profileDialog.getByRole('button', { name: 'Đóng trung tâm cài đặt' }).click();
    await page.getByRole('button', { name: 'Bỏ thay đổi' }).click();
    await expect(profileDialog).toHaveCount(0);
    await expect(page.locator('.user-chip-name')).toHaveText('Account Alpha');
  });
  await check('password strength, external Settings tab changes and Escape stay in sync', async () => {
    await page.locator('.tb-settings-btn').click();
    const dialog = page.getByRole('dialog', { name: 'Cài đặt' });
    await dialog.getByRole('button', { name: 'Bảo mật', exact: true }).click();
    const newPassword = dialog.locator('#acc-new-password');
    await page.evaluate(() => {
      window.__keydownAdds = 0;
      window.__originalAddEventListener = window.addEventListener;
      window.addEventListener = function (type, ...args) {
        if (type === 'keydown') window.__keydownAdds += 1;
        return window.__originalAddEventListener.call(this, type, ...args);
      };
    });
    await newPassword.fill('Aa1!aaaaaa');
    await expect(dialog.locator('.account-strength-text')).toHaveText('Khá');
    await newPassword.fill('Aa1!aaaaaaaa');
    await expect(dialog.locator('.account-strength-text')).toHaveText('Mạnh');
    const keydownAdds = await page.evaluate(() => {
      const count = window.__keydownAdds;
      window.addEventListener = window.__originalAddEventListener;
      delete window.__originalAddEventListener;
      delete window.__keydownAdds;
      return count;
    });
    assert.equal(keydownAdds, 0, 'Gõ mật khẩu không được gắn lại listener Escape');
    await newPassword.fill('');
    await page.locator('.user-chip').evaluate((element) => element.click());
    await expect(dialog.getByRole('button', { name: 'Hồ sơ', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.locator('.tb-settings-btn').evaluate((element) => element.click());
    await expect(dialog.getByRole('button', { name: 'Ngôn ngữ & khu vực' })).toHaveAttribute('aria-current', 'page');
    await dialog.getByRole('button', { name: 'Bảo mật', exact: true }).click();
    await dialog.locator('#acc-new-password').fill('Aa1!aaaaaaaa');
    await dialog.locator('#acc-new-password').press('Escape');
    await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await dialog.locator('#acc-new-password').press('Escape');
    await page.getByRole('button', { name: 'Bỏ thay đổi' }).click();
    await expect(dialog).toHaveCount(0);
  });
  await check('logout synchronizes tabs and a late financial response cannot restore private data', async () => {
    let release;
    let intercepted;
    const waiting = new Promise(resolve => { intercepted = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/spending', async route => {
      intercepted(); await held;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true,
        data: [{ id: 'old', desc: 'ALPHA_PRIVATE_STALE', amount: 123, date: '2026-09-21', category: 'Private', type: 'income' }] }) }).catch(() => {});
    });
    await page.reload(); await waiting;
    await logout(page);
    await second.waitForURL('**/login');
    release(); await page.unroute('**/api/spending');
    await page.goto('/spending'); await page.waitForURL('**/login');
    await expect(page.locator('body')).not.toContainText('ALPHA_PRIVATE_STALE');
    assert.ok(!await page.evaluate(() => JSON.stringify(localStorage).includes('ALPHA_PRIVATE_STALE')));
  });
  await check('switch account shows only the verified new account in both tabs', async () => {
    await signup(page, 'Account Beta', emailB);
    await second.goto('/spending');
    await expect(second.locator('.user-chip-name')).toHaveText('Account Beta');
    await expect(page.locator('body')).not.toContainText('ALPHA_PRIVATE_STALE');
  });
  await check('failed financial write stays unconfirmed; retries reuse the same idempotency key', async () => {
    await page.getByRole('button', { name: 'Thêm giao dịch', exact: true }).click();
    await page.locator('.txn-type-btn--income').click();
    await page.locator('#txn-amount-input').fill('123');
    await page.locator('#txn-desc-input').fill('NETWORK_MUST_NOT_FAKE_SUCCESS');
    const keys = [];
    await page.route('**/api/spending', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      keys.push(route.request().headers()['idempotency-key']);
      return route.abort('failed');
    });
    await page.locator('.txn-btn-submit').click();
    await expect(page.locator('[role=alert]').filter({ hasText: /Chưa xác nhận|kết nối/ })).toBeVisible();
    await expect(page.locator('#txn-amount-input')).toBeVisible();
    const userBefore = await backend('./models/User').findOne({ email: emailB });
    assert.equal(await backend('./models/Transaction').countDocuments({ userId: userBefore._id }), 0);
    await page.unroute('**/api/spending');
    await page.route('**/api/spending', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      keys.push(route.request().headers()['idempotency-key']);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.locator('.txn-btn-submit').click();
    await expect(page.locator('[role=alert]').filter({ hasText: /Chưa xác nhận|kết nối/ })).toBeVisible();
    await expect(page.locator('#txn-amount-input')).toBeVisible();
    assert.equal(await backend('./models/Transaction').countDocuments({ userId: userBefore._id }), 0);
    await page.unroute('**/api/spending');
    const sent = page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === '/api/spending');
    await page.locator('.txn-btn-submit').click();
    keys.push((await sent).headers()['idempotency-key']);
    await expect(page.locator('#txn-amount-input')).toHaveCount(0);
    assert.equal(keys.length, 3); assert.equal(new Set(keys).size, 1);
    assert.equal(await backend('./models/Transaction').countDocuments({ userId: userBefore._id }), 1);
  });
  await check('expired session is rejected on reload before private pages render', async () => {
    const user = await backend('./models/User').findOne({ email: emailB });
    await backend('./models/AuthSession').updateMany({ userId: user._id }, { $set: { expiresAt: new Date(0) } });
    await page.reload(); await page.waitForURL('**/login');
    await expect(page.locator('.user-chip-name')).toHaveCount(0);
  });
  await check('network failure cannot create a local authenticated session', async () => {
    await page.route('**/api/auth/login', route => route.abort('failed'));
    await page.locator('#emailIn').fill(emailA);
    await page.locator('#pwIn').fill(password);
    await page.locator('#loginForm button[type=submit]').click();
    await expect(page.locator('#formErr')).toBeVisible();
    assert.ok(page.url().endsWith('/login'));
    await expect(page.locator('.user-chip-name')).toHaveCount(0);
    await page.unroute('**/api/auth/login');
  });
  await check('malformed login success cannot authorize a protected page', async () => {
    await page.route('**/api/auth/login', route => route.fulfill({ status: 200,
      contentType: 'application/json', body: '{"success":true}' }));
    await page.locator('#loginForm button[type=submit]').click();
    await expect(page.locator('#formErr')).toBeVisible();
    assert.ok(page.url().endsWith('/login'));
    await expect(page.locator('.user-chip-name')).toHaveCount(0);
    await page.unroute('**/api/auth/login');
  });
  await check('offline logout locks both tabs and remains locked after reload until deliberate login', async () => {
    await page.locator('#loginForm button[type=submit]').click();
    await page.waitForURL('**/spending/home');
    await expect(page.locator('.user-chip-name')).toHaveText('Account Alpha');
    await second.goto('/spending');
    await expect(second.locator('.user-chip-name')).toHaveText('Account Alpha');
    await context.route('**/api/auth/logout', route => route.abort('failed'));
    await logout(page);
    await second.waitForURL('**/login');
    const user = await backend('./models/User').findOne({ email: emailA });
    assert.ok(await backend('./models/AuthSession').countDocuments({ userId: user._id, expiresAt: { $gt: new Date() } }));
    await page.goto('/spending');
    await page.waitForURL('**/login');
    await expect(page.locator('.user-chip-name')).toHaveCount(0);
    assert.equal(await page.evaluate(() => localStorage.getItem('caltdhy_logout_pending')), '1');
    await context.unroute('**/api/auth/logout');
    await page.locator('#emailIn').fill(emailB);
    await page.locator('#pwIn').fill(password);
    await page.locator('#loginForm button[type=submit]').click();
    await page.waitForURL('**/spending/home');
    await expect(page.locator('.user-chip-name')).toHaveText('Account Beta');
    assert.equal(await page.evaluate(() => localStorage.getItem('caltdhy_logout_pending')), null);
  });
  await check('oversized turnover shows exact range notice across all four themes', async () => {
    const user = await backend('./models/User').findOne({ email: emailB });
    const wallet = await backend('./models/Wallet').findOne({ userId: user._id, archived: false });
    await backend('./models/Transaction').insertMany(['income', 'expense', 'income', 'expense'].map((type, index) => ({
      userId: user._id, walletId: wallet._id, type, amount: index < 2 ? Number.MAX_SAFE_INTEGER : 2,
      category: 'Precision test', date: '2026-09-22', desc: 'Exact turnover fixture'
    })));
    const total = BigInt(Number.MAX_SAFE_INTEGER) * 2n + 4n + 123n;
    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0
    }).format(total);
    for (const theme of ['dark', 'cream', 'green', 'light']) {
      await page.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
      await page.reload();
      const notice = page.getByTestId('money-range-notice');
      await expect(notice).toBeVisible();
      await expect(notice).toContainText(formatted);
      await expect(page.locator('.tb-settings-btn')).toBeVisible();
    }
  });
  await check('mobile navigation remains reachable, touch-friendly, and free of fake currencies', async () => {
    const mobileContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    const mobileErrors = [];
    const mobileScriptRequests = [];
    const mobileEmail = 'mobile-' + crypto.randomUUID() + '@example.test';
    await mobilePage.addInitScript(() => {
      const NativeMutationObserver = window.MutationObserver;
      window.__localizationObserverStarts = 0;
      window.MutationObserver = class extends NativeMutationObserver {
        observe(...args) {
          window.__localizationObserverStarts += 1;
          return super.observe(...args);
        }
      };
    });
    mobilePage.on('pageerror', error => mobileErrors.push(error.message));
    mobilePage.on('request', request => {
      if (request.resourceType() === 'script') mobileScriptRequests.push(request.url());
    });
    await signup(mobilePage, 'Mobile Account', mobileEmail);
    const mobileUser = await backend('./models/User').findOne({ email: mobileEmail });
    assert.equal(await backend('./models/Budget').countDocuments({ userId: mobileUser._id }), 0,
      'Tài khoản mới không được tự gán ngân sách mẫu như dữ liệu thật');
    const mobileWallet = await backend('./models/Wallet').findOne({ userId: mobileUser._id, archived: false });
    const fixtureNow = new Date();
    const fixtureMonth = `${fixtureNow.getFullYear()}-${String(fixtureNow.getMonth() + 1).padStart(2, '0')}`;
    const previousMonthDate = new Date(fixtureNow.getFullYear(), fixtureNow.getMonth() - 1, 1);
    const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const fixtureDate = `${fixtureMonth}-02`;
    await backend('./models/Budget').create({
      userId: mobileUser._id, category: 'Ăn uống', limit: 100000, month: fixtureMonth
    });
    await backend('./models/Budget').create({
      userId: mobileUser._id, category: 'Ăn uống', limit: 200000, month: previousMonth
    });
    await backend('./models/Transaction').insertMany([
      {
        userId: mobileUser._id, walletId: mobileWallet._id, type: 'expense', amount: 150000, fee: 0,
        category: 'Ăn uống', date: fixtureDate, desc: 'Kiểm thử vượt hạn mức'
      },
      {
        userId: mobileUser._id, walletId: mobileWallet._id, type: 'expense', amount: 250000, fee: 10000,
        category: 'Dịch vụ', date: fixtureDate, desc: 'Thanh toán định kỳ: Internet'
      }
    ]);

    const guideDisclosure = mobilePage.getByRole('button', { name: 'Gợi ý cho trang chủ' });
    await expect(guideDisclosure).toBeVisible();
    await expect(mobilePage.locator('#contextual-section-guide')).toHaveCount(0);
    await guideDisclosure.click();
    await expect(mobilePage.getByRole('complementary', { name: 'Hướng dẫn nhanh' })).toBeVisible();
    await mobilePage.getByRole('button', { name: 'Đóng hướng dẫn' }).click();
    await expect(mobilePage.locator('#contextual-section-guide')).toHaveCount(0);

    const primaryNav = mobilePage.getByRole('navigation', { name: 'Điều hướng chính trên thiết bị di động' });
    await expect(primaryNav).toBeVisible();
    await expect(mobilePage.locator('.app-sidebar-nav')).toBeHidden();
    const primaryItems = primaryNav.getByRole('button');
    await expect(primaryItems).toHaveCount(4);
    for (const item of await primaryItems.all()) {
      const box = await item.boundingBox();
      assert.ok(box && box.height >= 44, 'Mỗi mục điều hướng mobile phải cao ít nhất 44px');
    }

    await primaryNav.getByRole('button', { name: 'Kế hoạch' }).click();
    await mobilePage.waitForURL('**/spending/plan/overview');
    const planNav = mobilePage.getByRole('navigation', { name: 'Điều hướng Kế hoạch' });
    await expect(planNav).toBeVisible();
    await planNav.getByRole('button', { name: 'Ngân sách' }).click();
    await mobilePage.waitForURL('**/spending/plan/budgets');
    await expect(mobilePage.getByRole('heading', { name: 'Ngân sách', exact: true })).toBeVisible();
    assert.equal(await mobilePage.title(), 'Ngân sách – CaltDHy');
    await mobilePage.reload();
    await expect(mobilePage.getByRole('heading', { name: 'Ngân sách', exact: true })).toBeVisible();
    await expect(mobilePage.locator('.budget-category-card.is-overdue-danger')).toHaveCount(1);
    await expect(mobilePage.locator('.budget-category-card.is-overdue-danger')).toContainText(/Vượt hạn mức \+50\.000\s*₫/);
    await expect(mobilePage.locator('.budget-overdue-indicator')).toHaveAttribute('aria-label', /50\.000\s*₫/);
    assert.ok(!mobileScriptRequests.some((url) => /AnalyticsView-.*\.js/.test(url)),
      'Analytics/Chart.js không được tải trước khi người dùng mở Phân tích');
    assert.equal(await mobilePage.evaluate(() => window.__localizationObserverStarts), 0,
      'Locale vi không được khởi chạy MutationObserver dịch DOM legacy');
    await mobilePage.getByRole('button', { name: 'Thiết lập hạn mức ngân sách' }).click();
    const mobileBudgetDialog = mobilePage.getByRole('dialog', { name: 'Thiết lập hạn mức ngân sách tháng' });
    await expect(mobileBudgetDialog).toBeVisible();
    const mobileBudgetBox = await mobileBudgetDialog.boundingBox();
    assert.ok(mobileBudgetBox && Math.abs(mobileBudgetBox.x + mobileBudgetBox.width / 2 - 195) < 2,
      'Modal ngân sách phải căn giữa trên mobile');
    assert.ok(mobileBudgetBox.y >= 0 && mobileBudgetBox.y + mobileBudgetBox.height <= 844,
      'Modal ngân sách phải nằm trọn trong viewport mobile');
    await mobilePage.keyboard.press('Escape');
    await expect(mobileBudgetDialog).toHaveCount(0);

    const delayedMonth = (url) => url.pathname === '/api/spending/budget' && url.searchParams.get('month') === previousMonth;
    await mobilePage.route(delayedMonth, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await mobilePage.getByRole('button', { name: 'Xem tháng trước' }).click();
    await expect(mobilePage.locator('.budget-skeleton-summary')).toHaveCount(4);
    await expect(mobilePage.locator('.budget-skeleton-summary')).toHaveCount(0, { timeout: 3000 });
    await mobilePage.unroute(delayedMonth);
    await mobilePage.getByRole('button', { name: 'Xem tháng sau' }).click();
    await expect(mobilePage.locator('.budget-category-card.is-overdue-danger')).toHaveCount(1);
    let releaseStaleBudget;
    const staleBudgetGate = new Promise((resolve) => { releaseStaleBudget = resolve; });
    await mobilePage.route(delayedMonth, async (route) => {
      await staleBudgetGate;
      await route.continue();
    });
    await mobilePage.getByRole('button', { name: 'Xem tháng trước' }).click();
    await expect(mobilePage.locator('.budget-skeleton-summary')).toHaveCount(4);
    await mobilePage.getByRole('button', { name: 'Xem tháng sau' }).click();
    await expect(mobilePage.locator('.budget-ov-value').first()).toContainText(/100\.000\s*₫/);
    const staleResponse = mobilePage.waitForResponse((response) => response.url().includes(`month=${previousMonth}`));
    releaseStaleBudget();
    await staleResponse;
    await mobilePage.waitForTimeout(200);
    await expect(mobilePage.locator('.budget-ov-value').first()).toContainText(/100\.000\s*₫/);
    await mobilePage.unroute(delayedMonth);
    await primaryNav.getByRole('button', { name: 'Phân tích' }).click();
    await mobilePage.waitForURL('**/spending/analytics/overview');
    const analyticsNav = mobilePage.getByRole('navigation', { name: 'Điều hướng Phân tích' });
    await expect(analyticsNav).toBeVisible();
    await expect(mobilePage.locator('#analytics-overview')).toBeVisible();
    await expect(mobilePage.locator('#analytics-spending, #analytics-cashflow, #analytics-reports')).toHaveCount(0);
    await analyticsNav.getByRole('button', { name: 'Chi tiêu' }).click();
    await mobilePage.waitForURL('**/spending/analytics/spending');
    await expect(mobilePage.locator('#analytics-spending')).toBeVisible();
    await expect(mobilePage.locator('#analytics-overview, #analytics-cashflow, #analytics-reports')).toHaveCount(0);
    await expect(mobilePage).toHaveTitle('Chi tiêu – CaltDHy');
    await analyticsNav.getByRole('button', { name: 'Dòng tiền' }).click();
    await mobilePage.waitForURL('**/spending/analytics/cash-flow');
    const recurringToggle = mobilePage.getByRole('button', { name: 'Gồm định kỳ' });
    await expect(recurringToggle).toHaveAttribute('aria-pressed', 'false');
    const includedToggleBox = await recurringToggle.boundingBox();
    await recurringToggle.click();
    const excludedToggle = mobilePage.getByRole('button', { name: 'Đã trừ định kỳ' });
    await expect(excludedToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(excludedToggle).toBeEnabled();
    const excludedToggleBox = await excludedToggle.boundingBox();
    assert.equal(Math.round(excludedToggleBox.width), Math.round(includedToggleBox.width),
      'Nhãn trạng thái không được làm thay đổi chiều rộng nút định kỳ');
    await expect(mobilePage.locator('.trend-recurring-cooldown, .trend-recurring-summary')).toHaveCount(0);
    const recurringToast = mobilePage.locator('.toast-item').filter({ hasText: /Đã ẩn 1 khoản định kỳ/ });
    await expect(recurringToast).toContainText(/−260\.000\s*₫/);
    const [toastBox, mobileNavBox] = await Promise.all([recurringToast.boundingBox(), primaryNav.boundingBox()]);
    assert.ok(toastBox && mobileNavBox && toastBox.y + toastBox.height <= mobileNavBox.y,
      'Toast mobile phải nằm phía trên thanh điều hướng');
    await excludedToggle.click();
    const restoredToggle = mobilePage.getByRole('button', { name: 'Gồm định kỳ' });
    await expect(restoredToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(restoredToggle).toBeEnabled();
    await expect(mobilePage.locator('.toast-item')).toHaveCount(1);
    await expect(mobilePage.locator('.toast-item')).toContainText(/Đã đưa 1 khoản định kỳ trở lại biểu đồ/);
    await analyticsNav.getByRole('button', { name: 'Chi tiêu' }).click();
    await mobilePage.waitForURL('**/spending/analytics/spending');
    await analyticsNav.getByRole('button', { name: 'Dòng tiền' }).click();
    await mobilePage.waitForURL('**/spending/analytics/cash-flow');
    await expect(mobilePage.getByRole('button', { name: 'Gồm định kỳ' })).toBeEnabled();
    await analyticsNav.getByRole('button', { name: 'Chi tiêu' }).click();
    await mobilePage.waitForURL('**/spending/analytics/spending');
    await primaryNav.getByRole('button', { name: 'Hũ' }).click();
    await mobilePage.waitForURL('**/spending/jars/goals');
    await expect(mobilePage.getByRole('navigation', { name: 'Điều hướng Hũ' })).toBeVisible();
    await expect(mobilePage.getByText('Bạn chưa có hũ tiết kiệm')).toBeVisible();
    const emptyJarsDomCount = await mobilePage.locator('.jars-page-root *').count();
    assert.ok(emptyJarsDomCount < 80, `Hũ rỗng không được dựng dashboard nặng (${emptyJarsDomCount} node)`);

    await mobilePage.goBack();
    await mobilePage.waitForURL('**/spending/analytics/spending');
    await expect(mobilePage.locator('#analytics-spending')).toBeVisible();
    await expect(mobilePage.getByRole('navigation', { name: 'Điều hướng Phân tích' })).toBeVisible();
    await mobilePage.goForward();
    await mobilePage.waitForURL('**/spending/jars/goals');
    await expect(mobilePage.getByText('Bạn chưa có hũ tiết kiệm')).toBeVisible();

    await backend('./models/Jar').insertMany(Array.from({ length: 20 }, (_, index) => ({
      userId: mobileUser._id,
      name: `Hũ kiểm thử ${String(index + 1).padStart(2, '0')}`,
      category: 'Mục tiêu kiểm thử',
      target: 1000000 + index,
      current: 1000 * index,
      color: '#5356F1'
    })));
    await mobilePage.reload();
    const jarsNav = mobilePage.getByRole('navigation', { name: 'Điều hướng Hũ' });
    await jarsNav.getByRole('button', { name: 'Danh sách hũ' }).click();
    await mobilePage.waitForURL('**/spending/jars/list');
    await expect(mobilePage.locator('#jars-section-list')).toBeVisible();
    await expect(mobilePage.locator('#jars-section-goals, #jars-section-history')).toHaveCount(0);
    await expect(mobilePage.locator('.jar-premium-card')).toHaveCount(12);
    await expect(mobilePage.getByRole('navigation', { name: 'Phân trang danh sách hũ' })).toBeVisible();
    const fullJarsDomCount = await mobilePage.locator('.jars-page-root *').count();
    assert.ok(fullJarsDomCount < 800, `Trang đầu 20 hũ vượt DOM budget (${fullJarsDomCount} node)`);
    console.log(`METRIC mobile DOM: empty jars=${emptyJarsDomCount}; 20 jars page 1=${fullJarsDomCount}`);
    await mobilePage.getByRole('button', { name: 'Trang hũ sau' }).click();
    await expect(mobilePage.locator('.jar-premium-card')).toHaveCount(8);
    await expect(mobilePage.getByRole('button', { name: 'Trang hũ 2' })).toHaveAttribute('aria-current', 'page');
    await jarsNav.getByRole('button', { name: 'Lịch sử' }).click();
    await mobilePage.waitForURL('**/spending/jars/history');
    await expect(mobilePage.locator('#jars-section-history')).toBeVisible();
    await expect(mobilePage.locator('#jars-section-goals, #jars-section-list')).toHaveCount(0);

    const hasHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(hasHorizontalOverflow, false, 'Trang mobile không được tràn ngang');

    await mobilePage.setViewportSize({ width: 1440, height: 1000 });
    await mobilePage.goto('/spending/plan/overview');
    for (const [menuName, dialogName, overlaySelector] of [
      [/Ví \/ Tài khoản/, 'Thêm ví / tài khoản mới', '.txn-modal-backdrop'],
      [/Ngân sách/, 'Thiết lập hạn mức ngân sách tháng', '.modal-backdrop-overlay'],
      [/Khoản định kỳ/, 'Thêm khoản định kỳ', '.txn-modal-backdrop'],
    ]) {
      await mobilePage.getByRole('button', { name: 'Lập kế hoạch tài chính' }).click();
      await mobilePage.getByRole('menuitem', { name: menuName }).click();
      const dialog = mobilePage.getByRole('dialog', { name: dialogName });
      await expect(dialog).toBeVisible();
      await mobilePage.waitForTimeout(260);
      const box = await dialog.boundingBox();
      assert.ok(box && Math.abs(box.x + box.width / 2 - 720) < 2 && Math.abs(box.y + box.height / 2 - 500) < 2,
        `${dialogName}: modal phải căn giữa viewport desktop (${JSON.stringify(box)})`);
      const coversChrome = await mobilePage.evaluate((selector) => {
        const overlay = document.querySelector(selector);
        const rect = overlay?.getBoundingClientRect();
        return Boolean(rect && rect.left === 0 && rect.top === 0 && rect.right >= innerWidth && rect.bottom >= innerHeight
          && overlay.contains(document.elementFromPoint(20, 20))
          && overlay.contains(document.elementFromPoint(20, innerHeight / 2)));
      }, overlaySelector);
      assert.ok(coversChrome, `${dialogName}: backdrop phải phủ cả header và sidebar`);
      await mobilePage.mouse.click(8, 8);
      await expect(dialog).toHaveCount(0);
    }
    await backend('./models/Wallet').create({
      userId: mobileUser._id, name: 'Archive target', type: 'cash', initialBalance: 0, isDefault: false
    });
    await mobilePage.goto('/spending/plan/wallets');
    const targetWalletCard = mobilePage.locator('.wallet-grid-card').filter({ hasText: 'Archive target' });
    await expect(targetWalletCard).toBeVisible();
    await targetWalletCard.getByRole('button', { name: 'Tùy chọn ví Archive target' }).click();
    await mobilePage.getByRole('menuitem', { name: 'Lưu trữ / Đóng ví' }).click();
    const archiveDialog = mobilePage.getByRole('dialog', { name: 'Lưu trữ & Đóng ví' });
    await expect(archiveDialog).toBeVisible();
    const archiveBox = await archiveDialog.boundingBox();
    assert.ok(archiveBox && Math.abs(archiveBox.x + archiveBox.width / 2 - 720) < 2
      && Math.abs(archiveBox.y + archiveBox.height / 2 - 500) < 2,
    'Modal lưu trữ ví phải căn giữa viewport desktop');
    await archiveDialog.getByRole('button', { name: 'Đóng cửa sổ' }).click();
    await expect(archiveDialog).toHaveCount(0);

    let walletDeleteIntercepted = false;
    let releaseWalletDelete;
    const walletDeleteGate = new Promise((resolve) => { releaseWalletDelete = resolve; });
    await mobilePage.route((url) => url.pathname.startsWith('/api/wallets/'), async (route) => {
      if (route.request().method() === 'DELETE') {
        walletDeleteIntercepted = true;
        await walletDeleteGate;
      }
      await route.continue();
    });
    await targetWalletCard.getByRole('button', { name: 'Tùy chọn ví Archive target' }).click();
    await mobilePage.getByRole('menuitem', { name: 'Xóa vĩnh viễn' }).click();
    const deleteWalletDialog = mobilePage.getByRole('dialog', { name: 'Xóa ví / tài khoản' });
    await deleteWalletDialog.getByRole('button', { name: 'Xóa ví' }).click();
    try {
      await expect(deleteWalletDialog.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
      await expect(deleteWalletDialog.getByRole('button', { name: 'Hủy' })).toBeDisabled();
      await expect.poll(() => walletDeleteIntercepted, { message: 'Yêu cầu xóa ví phải được giữ lại trong kiểm thử loading' }).toBe(true);
      await expect(targetWalletCard).toHaveClass(/is-deleting/);
      await expect(targetWalletCard).toHaveCSS('opacity', '0.4');
      await expect(targetWalletCard).toHaveCSS('pointer-events', 'none');
      await mobilePage.keyboard.press('Escape');
      await expect(deleteWalletDialog).toBeVisible();
      await mobilePage.mouse.click(8, 8);
      await expect(deleteWalletDialog).toBeVisible();
    } finally {
      releaseWalletDelete();
    }
    await expect(deleteWalletDialog.locator('.confirm-dialog-error')).toContainText('Số dư ví không đủ');
    await expect(deleteWalletDialog.getByRole('button', { name: 'Hủy' })).toBeEnabled();
    await expect(targetWalletCard).not.toHaveClass(/is-deleting/);
    await deleteWalletDialog.getByRole('button', { name: 'Hủy' }).click();
    await expect(deleteWalletDialog).toHaveCount(0);
    await mobilePage.goto('/spending/analytics/cash-flow');
    for (const sectionId of ['analytics-overview', 'analytics-spending', 'analytics-cashflow', 'analytics-reports']) {
      await expect(mobilePage.locator(`#${sectionId}`)).toBeVisible();
    }
    await mobilePage.waitForTimeout(700);
    const desktopReportsNav = mobilePage.getByRole('button', { name: 'Báo cáo', exact: true });
    await desktopReportsNav.click();
    await mobilePage.waitForURL('**/spending/analytics/reports');
    await expect(desktopReportsNav).toHaveAttribute('aria-current', 'page');
    await mobilePage.locator('#analytics-cashflow').evaluate((section) => section.scrollIntoView({ behavior: 'auto', block: 'start' }));
    await expect(mobilePage.getByRole('button', { name: 'Xu hướng dòng tiền', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(mobilePage).toHaveURL(/\/spending\/analytics\/reports$/);
    await mobilePage.locator('#analytics-reports').evaluate((section) => section.scrollIntoView({ behavior: 'auto', block: 'start' }));
    await expect(desktopReportsNav).toHaveAttribute('aria-current', 'page');
    const desktopRecurringToggle = mobilePage.getByRole('button', { name: 'Gồm định kỳ' });
    await desktopRecurringToggle.click();
    await expect(mobilePage.getByRole('button', { name: 'Đã trừ định kỳ' })).toHaveAttribute('aria-pressed', 'true');

    await mobilePage.goto('/spending/jars/list');
    for (const sectionId of ['jars-section-goals', 'jars-section-list', 'jars-section-history']) {
      await expect(mobilePage.locator(`#${sectionId}`)).toBeVisible();
    }
    await expect(mobilePage.locator('.jar-premium-card')).toHaveCount(12);
    await mobilePage.waitForTimeout(700);
    await mobilePage.locator('#jars-section-history').evaluate((section) => section.scrollIntoView({ behavior: 'auto', block: 'start' }));
    await expect(mobilePage.getByRole('button', { name: 'Lịch sử', exact: true })).toHaveAttribute('aria-current', 'page');
    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false,
      'Trang desktop không được tràn ngang khi dựng đồng thời mọi khu vực');

    const themeVisuals = new Map();
    const periodVisuals = new Map();
    for (const theme of ['dark', 'cream', 'green', 'light']) {
      await mobilePage.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
      await mobilePage.goto('/spending/plan/budgets');
      const overdueCard = mobilePage.locator('.budget-category-card.is-overdue-danger');
      await expect(overdueCard).toHaveCount(1);
      await expect(overdueCard).toContainText(/Vượt hạn mức \+50\.000\s*₫/);
      const visual = await overdueCard.evaluate((card) => {
        const icon = card.querySelector('.budget-overdue-indicator svg');
        const progress = card.querySelector('.budget-card-fill.is-overdue-danger');
        return {
          borderColor: getComputedStyle(card).borderColor,
          backgroundImage: getComputedStyle(card).backgroundImage,
          animationName: getComputedStyle(card).animationName,
          iconFill: icon ? getComputedStyle(icon).fill : null,
          progressImage: progress ? getComputedStyle(progress).backgroundImage : null
        };
      });
      assert.notEqual(visual.backgroundImage, 'none', `${theme}: thẻ vượt hạn mức cần nền cảnh báo`);
      assert.notEqual(visual.progressImage, 'none', `${theme}: tiến độ vượt hạn mức cần vân tĩnh`);
      assert.equal(visual.animationName, 'none', `${theme}: cảnh báo không được nhấp nháy`);
      assert.equal(visual.iconFill, 'none', `${theme}: icon cảnh báo phải là nét rỗng`);
      themeVisuals.set(theme, visual.borderColor);
      await mobilePage.getByRole('button', { name: 'Xem tháng trước' }).click();
      const periodCard = mobilePage.locator('.budget-category-card.is-period-overdue');
      await expect(periodCard).toHaveCount(1);
      await expect(periodCard).not.toHaveClass(/is-overdue-danger/);
      await expect(periodCard.locator('.budget-card-period-overdue-badge')).toHaveText('Đã quá hạn');
      const periodVisual = await periodCard.evaluate((card) => ({
        borderColor: getComputedStyle(card).borderColor,
        borderStartWidth: getComputedStyle(card).borderInlineStartWidth,
        backgroundImage: getComputedStyle(card).backgroundImage
      }));
      assert.equal(periodVisual.borderStartWidth, '4px', `${theme}: kỳ đã hết cần viền cảnh báo`);
      assert.notEqual(periodVisual.backgroundImage, 'none', `${theme}: kỳ đã hết cần nền cảnh báo`);
      periodVisuals.set(theme, periodVisual.borderColor);
    }
    assert.ok(new Set(themeVisuals.values()).size >= 3, 'Cảnh báo phải được hiệu chỉnh theo bốn theme');
    assert.ok(new Set(periodVisuals.values()).size >= 3, 'Ngân sách quá hạn phải được hiệu chỉnh theo bốn theme');

    await mobilePage.setViewportSize({ width: 390, height: 844 });
    const mobileSettingsButton = mobilePage.locator('.tb-settings-btn');
    await mobileSettingsButton.click();
    const mobileSettingsDialog = mobilePage.locator('.settings-center-dialog');
    await expect(mobileSettingsDialog).toBeVisible();
    await expect(mobileSettingsDialog).toHaveAccessibleName('Ngôn ngữ & khu vực');
    const mobileSettingsBox = await mobileSettingsDialog.boundingBox();
    assert.ok(mobileSettingsBox && mobileSettingsBox.width >= 389 && mobileSettingsBox.height >= 843,
      'Settings Center phải chiếm toàn màn hình trên mobile');
    const mobileCurrencyGroup = mobileSettingsDialog.getByRole('group', { name: 'Đơn vị tiền hiển thị' });
    await expect(mobileCurrencyGroup.getByRole('button', { name: 'VND' })).toHaveAttribute('aria-pressed', 'true');
    await expect(mobileCurrencyGroup.getByRole('button', { name: 'USD' })).toBeDisabled();
    await expect(mobileSettingsDialog.getByRole('button', { name: 'CNY' })).toHaveCount(0);
    await mobileSettingsDialog.getByRole('button', { name: 'Quay lại danh sách cài đặt' }).click();
    await expect(mobileSettingsDialog).toHaveAccessibleName('Cài đặt');
    await expect(mobileSettingsDialog.locator('.settings-center-content')).toBeHidden();
    await mobileSettingsDialog.getByRole('button', { name: 'Hồ sơ', exact: true }).click();
    await expect(mobilePage.getByRole('dialog', { name: 'Hồ sơ' })).toBeVisible();
    await expect(mobileSettingsDialog.getByRole('heading', { name: 'Hồ sơ cá nhân' })).toBeVisible();
    await mobileSettingsDialog.getByRole('button', { name: 'Đóng trung tâm cài đặt' }).click();
    await expect(mobileSettingsDialog).toHaveCount(0);
    await expect(mobileSettingsButton).toBeFocused();
    await expect(mobilePage.locator('.budget-setup-dialog')).toHaveCount(0);

    const localizedRoutes = [
      ['/spending/home', 'Dashboard', '首页'],
      ['/spending/plan/wallets', 'Wallets & Accounts', '钱包与账户'],
      ['/spending/plan/budgets', 'Budgets', '预算'],
      ['/spending/plan/recurring', 'Recurring items', '周期项目'],
      ['/spending/analytics/overview', 'Overview', '总览'],
      ['/spending/jars/list', 'Jar list', '储蓄罐列表']
    ];
    for (const [locale, column, homeLabel, transactionLabel] of [
      ['en', 1, 'Dashboard', 'Add transaction'],
      ['zh-CN', 2, '首页', '添加交易']
    ]) {
      await mobilePage.evaluate(value => localStorage.setItem('caltdhy_lang', value), locale);
      for (const [path, englishTitle, chineseTitle] of localizedRoutes) {
        await mobilePage.goto(path);
        await expect(mobilePage.locator('html')).toHaveAttribute('lang', locale);
        await expect(mobilePage).toHaveTitle(`${column === 1 ? englishTitle : chineseTitle} – CaltDHy`);
        await expect(mobilePage.locator('.mobile-primary-nav')).toContainText(homeLabel);
        if (path === '/spending/plan/budgets') {
          await expect(mobilePage.locator('.budget-section-heading')).toContainText(
            locale === 'en' ? 'Category budget details' : '分类预算明细');
          await mobilePage.getByRole('button', { name: locale === 'en' ? 'View previous month' : '查看上个月' }).click();
          await expect(mobilePage.locator('.budget-card-period-overdue-badge')).toHaveText(
            locale === 'en' ? 'Overdue' : '已过期');
        }
        assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false,
          `${locale} ${path}: nội dung không được tràn ngang trên mobile`);
      }
      await mobilePage.goto('/spending/home');
      await mobilePage.locator('.home-btn-add-txn').click();
      await expect(mobilePage.getByRole('dialog', { name: transactionLabel })).toBeVisible();
      await mobilePage.locator('.txn-modal-close-btn').click();
    }
    const observerStartsBeforeVietnamese = await mobilePage.evaluate(() => window.__localizationObserverStarts);
    await mobilePage.locator('.tb-settings-btn').click();
    await mobilePage.getByRole('button', { name: '返回设置列表' }).click();
    await mobilePage.getByRole('button', { name: '语言与地区' }).click();
    await mobilePage.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
    await expect(mobilePage.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(mobilePage.locator('.mobile-primary-nav')).toContainText('Trang chủ');
    assert.equal(await mobilePage.evaluate(() => window.__localizationObserverStarts), observerStartsBeforeVietnamese,
      'Chuyển về tiếng Việt phải khôi phục văn bản mà không khởi chạy observer mới');
    assert.deepEqual(mobileErrors, []);
    await mobileContext.close();
  });
  assert.deepEqual(errors, []);
  console.log('PASS ' + passed + ' browser security scenarios; no unhandled browser errors.');
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await mongoose.disconnect();
  if (db) await db.stop();
});

'use strict';

// Run against the production build with an isolated, temporary database.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { chromium, expect } = require('@playwright/test');
const backend = createRequire(path.resolve(__dirname, '../backEnd/server/package.json'));
const mongoose = backend('mongoose');
const { MongoMemoryReplSet } = backend('mongodb-memory-server');
const evidence = process.env.MOBILE_UX_QA_DIR || path.join(os.tmpdir(), 'caltdhy-mobile-ux');
let server, database, browser, page, passed = 0;
async function check(name, work) {
  if (process.env.MOBILE_UX_SCENARIO && !name.includes(process.env.MOBILE_UX_SCENARIO)) return;
  await work(); passed++; console.log('PASS ' + name);
}
async function fit(locator, name) {
  const layout = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: innerWidth,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflow: element.scrollWidth - element.clientWidth,
      ...(element.classList.contains('plan-feature-view') ? { overflowing: [...element.querySelectorAll('*')]
        .filter(node => node.getBoundingClientRect().right > rect.right + 1)
        .slice(0, 12).map(node => ({ tag: node.tagName, className: node.className,
          right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width })) } : {}) };
  });
  assert.ok(layout.left >= -1 && layout.right <= layout.width + 1 && layout.documentOverflow <= 1 && layout.overflow <= 1,
    `${name}: fits without horizontal scrolling ${JSON.stringify(layout)}`);
}

(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', HOST: '127.0.0.1', REGISTRATION_MODE: 'open',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'), JWT_EXPIRES_IN: '1h',
    AUTH_RATE_LIMIT_MAX: '1000', API_RATE_LIMIT_MAX: '100000' });
  for (const key of ['MONGODB_URI', 'CLIENT_URL', 'CORS_WHITELIST', 'GMAIL_USER', 'GMAIL_PASS', 'COOKIE_SECURE']) delete process.env[key];
  let app;
  server = http.createServer((req, res) => app(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.PORT = String(server.address().port);
  app = backend('./server');
  database = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(database.getUri('caltdhy_mobile_ux'));
  for (const model of Object.values(mongoose.models)) { await model.createCollection(); await model.createIndexes(); }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : process.platform === 'darwin' && fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:' + server.address().port,
    locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', serviceWorkers: 'block', reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
  const email = 'mobile-' + crypto.randomUUID() + '@example.test';
  await page.goto('/signup');
  await page.locator('#fullName').fill('Kiểm thử giao diện điện thoại');
  await page.locator('#emailIn').fill(email);
  await page.locator('#pwIn').fill('Browser-test-1234');
  await page.locator('#signupForm button[type=submit]').click();
  await page.waitForURL('**/spending/home');
  const user = await backend('./models/User').findOne({ email });
  const wallet = await backend('./models/Wallet').findOne({ userId: user._id, isDefault: true });
  wallet.name = 'Tài khoản có tên dài để kiểm tra trên điện thoại';
  wallet.initialBalance = 1252252957;
  await wallet.save();
  const categories = ['Food & Dining', 'Shopping', 'Health & Beauty'];
  await backend('./models/Budget').insertMany(categories.map(category => ({ userId: user._id, category,
    limit: 100000, month: '2026-10' })));
  await backend('./models/Transaction').insertMany(categories.map((category, index) => ({
    userId: user._id, walletId: wallet._id, type: 'expense', amount: index === 2 ? 79000 : 250000,
    category, date: '2026-10-02', desc: 'Dữ liệu kiểm thử giao diện' })));
  await backend('./models/Installment').create({ userId: user._id, walletId: wallet._id,
    name: 'Khoản định kỳ kiểm thử có tên dài', category: 'Housing & Bills', amount: 1211444,
    cycle: 'monthly', nextDueDate: '2026-10-12' });
  await page.reload();
  fs.mkdirSync(evidence, { recursive: true });
  const dialog = page.locator('.settings-center-dialog');
  const openSettings = async () => { await page.locator('.tb-settings-btn').click(); await expect(dialog).toBeVisible(); };
  const closeSettings = async () => { await dialog.locator('.account-modal-close-btn').click(); await expect(dialog).toHaveCount(0); };
  const goPlan = async () => { await page.goto('/spending/plan/overview'); await expect(page.locator('.plan-metrics-grid')).toBeVisible(); };

  await check('settings opens its home, themes take one further tap and profile opens directly', async () => {
    await openSettings();
    await expect(dialog).toHaveAccessibleName('Cài đặt');
    await expect(dialog.locator('.settings-user-summary')).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Chọn giao diện' }).getByRole('button')).toHaveCount(4);
    await dialog.getByRole('button', { name: 'Giao diện Kem', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/cream-theme/);
    await dialog.locator('.settings-user-summary').click();
    await expect(dialog).toHaveAccessibleName('Hồ sơ');
    await dialog.locator('#acc-display-name').fill('Nội dung chưa lưu');
    await dialog.locator('.settings-mobile-back').click();
    await expect(dialog).toHaveAccessibleName('Cài đặt');
    await dialog.locator('.settings-user-summary').click();
    await expect(dialog.locator('#acc-display-name')).toHaveValue('Nội dung chưa lưu');
    await dialog.locator('.account-modal-close-btn').click();
    await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(dialog.locator('#acc-display-name')).toHaveValue('Nội dung chưa lưu');
    await dialog.locator('.account-modal-close-btn').click();
    await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.tb-settings-btn')).toBeFocused();
    await page.locator('.user-chip').click();
    await expect(dialog).toHaveAccessibleName('Hồ sơ');
    await closeSettings();
    await expect(page.locator('.user-chip')).toBeFocused();
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/cream-theme/);
    await openSettings();
    await dialog.getByRole('button', { name: 'Bảo mật', exact: true }).click();
    await dialog.locator('#acc-new-password').fill('Draft-password-123');
    await page.locator('.user-chip').evaluate(button => button.click());
    await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(dialog).toHaveAccessibleName('Bảo mật');
    await expect(dialog.locator('#acc-new-password')).toHaveValue('Draft-password-123');
    await dialog.locator('.account-modal-close-btn').click();
    await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  });

  await check('plan shows the real alert count and expands mixed alerts without changing the page', async () => {
    await goPlan();
    const alerts = page.locator('.plan-top-alerts-card');
    await expect(alerts.locator('.top-alerts-subtext')).toContainText('4');
    await expect(alerts.locator('.top-alert-pill-item')).toHaveCount(2);
    await alerts.locator('.top-alerts-view-all-link').click();
    await expect(alerts.locator('.top-alert-pill-item')).toHaveCount(4);
    await expect(page).toHaveURL(/\/plan\/overview$/);
    await alerts.locator('.top-alert-pill-item').filter({ hasText: /định kỳ kiểm thử/ }).click();
    await page.waitForURL('**/plan/recurring');
    await expect(page.locator('.recurring-view-v2-container')).toBeVisible();
    await expect(page.locator('.recurring-row-card')).toHaveCount(1);
  });

  await check('settings and compact planning fit small phones in all four themes', async () => {
    for (const [theme, label] of [['dark', 'Tối'], ['light', 'Sáng'], ['cream', 'Kem'], ['green', 'Xanh']]) {
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await openSettings();
        await dialog.getByRole('button', { name: 'Giao diện ' + label, exact: true }).click();
        await expect(page.locator('html')).toHaveClass(new RegExp(theme + '-theme'));
        await fit(dialog, `${theme}/${width} settings`);
        for (const button of await dialog.getByRole('group', { name: 'Chọn giao diện' }).getByRole('button').all()) {
          const box = await button.boundingBox();
          assert.ok(box.height >= 44 && box.width >= 44, 'Theme touch target');
        }
        if (width === 390) await dialog.screenshot({ path: path.join(evidence, `settings-${theme}.png`) });
        await closeSettings();
        await goPlan();
        await fit(page.locator('.plan-feature-view'), `${theme}/${width} plan`);
        const metricsBox = await page.locator('.plan-metrics-grid').boundingBox();
        assert.ok(metricsBox.height < 380, `${theme}/${width}: summary stays compact (${metricsBox.height})`);
        const clipped = await page.locator('.plan-metric-value').evaluateAll(nodes => nodes.filter(node =>
          node.scrollWidth > node.clientWidth + 1).map(node => node.textContent));
        assert.deepEqual(clipped, [], 'Summary amounts must remain fully readable');
        // Capture the phone viewport: full-page images place fixed navigation
        // in the middle of a tall image and misrepresent the actual screen.
        if (width === 390) await page.screenshot({ path: path.join(evidence, `plan-${theme}.png`) });
        for (const tab of ['wallets', 'budgets', 'recurring']) {
          await page.goto('/spending/plan/' + tab);
          await expect(page.locator('.plan-feature-view')).toBeVisible();
          // The route shell can render before the fixture data reaches its store.
          if (tab === 'wallets') await expect(page.locator('.wallet-grid-name').filter({ hasText: wallet.name })).toBeVisible();
          if (tab === 'budgets') await expect(page.locator('.budget-category-card.is-overdue-danger')).toHaveCount(2);
          if (tab === 'recurring') await expect(page.locator('.recurring-row-card')).toHaveCount(1);
          await fit(page.locator('.plan-feature-view'), `${theme}/${width} ${tab}`);
          if (width === 390) await page.screenshot({ path: path.join(evidence, `${tab}-${theme}.png`) });
        }
      }
    }
  });

  await check('bottom navigation stays at the viewport edge throughout scrolling', async () => {
    const layouts = [];
    for (const [theme, label] of [['dark', 'Tối'], ['light', 'Sáng'], ['cream', 'Kem'], ['green', 'Xanh']]) {
      await openSettings();
      await dialog.getByRole('button', { name: 'Giao diện ' + label, exact: true }).click();
      await closeSettings();
      await goPlan();
      for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
        await page.setViewportSize({ width, height });
        for (const [position, fraction] of [['top', 0], ['middle', .5], ['bottom', 1]]) {
          await page.evaluate(value => {
            document.activeElement?.blur();
            window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * value, behavior: 'instant' });
          }, fraction);
          await expect.poll(() => page.locator('.mobile-primary-nav').evaluate(nav => {
            const rect = nav.getBoundingClientRect();
            return Math.abs(rect.bottom - innerHeight);
          }), { message: `${theme}/${width}/${position}: navigation sits at the screen bottom` }).toBeLessThanOrEqual(1);
          const layout = await page.locator('.mobile-primary-nav').evaluate(nav => {
            const rect = nav.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, height: rect.height, scrollY,
              viewportHeight: innerHeight, position: getComputedStyle(nav).position };
          });
          assert.equal(layout.position, 'fixed');
          assert.ok(layout.top >= 0 && layout.height >= 44);
          if (fraction > 0) assert.ok(layout.scrollY > 0, 'The long page actually scrolled');
          if (position === 'bottom') {
            const contentBottom = await page.locator('.plan-insight-banner-card').evaluate(node => node.getBoundingClientRect().bottom);
            assert.ok(contentBottom <= layout.top, 'The last planning card can scroll clear of navigation');
          }
          layouts.push({ theme, width, position, ...layout });
          if (theme === 'cream' && width === 390) {
            await page.screenshot({ path: path.join(evidence, `plan-cream-${position}.png`) });
          }
        }
      }
    }
    fs.writeFileSync(path.join(evidence, 'bottom-navigation-layouts.json'), JSON.stringify(layouts, null, 2));
  });

  await check('profile failure shows safe actionable copy instead of an API exception', async () => {
    await page.locator('.user-chip').click();
    await dialog.locator('#acc-display-name').fill('Tên mới kiểm thử');
    await page.route('**/api/auth/profile', route => route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, message: "Cannot read properties of undefined (reading 'getPixelForValue')" }) }), { times: 1 });
    await dialog.locator('form button[type=submit]').first().click();
    await expect(dialog.locator('.account-feedback-msg.error[role="alert"]').first()).toBeVisible();
    assert.doesNotMatch(await dialog.innerText(), /getPixelForValue|undefined|TypeError/);
    await dialog.locator('.account-modal-close-btn').click();
    await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  });

  await check('three languages keep the settings entry and theme controls usable', async () => {
    for (const [locale, title] of [['en', 'Settings'], ['zh-CN', '设置'], ['vi', 'Cài đặt']]) {
      await page.evaluate(value => localStorage.setItem('caltdhy_lang', value), locale);
      await page.reload();
      await openSettings();
      await expect(dialog).toHaveAccessibleName(title);
      await fit(dialog, locale + ' settings');
      await closeSettings();
      await goPlan();
      await fit(page.locator('.plan-feature-view'), locale + ' plan');
    }
  });

  await check('a failed screen uses safe themed copy and navigation recovers', async () => {
    for (const theme of ['dark', 'light', 'cream', 'green']) {
      const errorPage = await context.newPage();
      try {
        await errorPage.addInitScript(value => localStorage.setItem('caltdhy_theme', value), theme);
        await errorPage.route('**/assets/PlanView-*.js', route => route.fulfill({ contentType: 'application/javascript',
          body: "throw new TypeError(\"Cannot read properties of undefined (reading 'getPixelForValue')\");" }));
        await errorPage.goto('/spending/plan/overview');
        await expect(errorPage.getByRole('heading', { name: 'Đã xảy ra lỗi hiển thị', exact: true })).toBeVisible();
        assert.doesNotMatch(await errorPage.locator('body').innerText(), /getPixelForValue|undefined|TypeError/);
        await fit(errorPage.locator('.app-container'), theme + ' error');
        await errorPage.screenshot({ path: path.join(evidence, `error-${theme}.png`) });
        await errorPage.locator('.mobile-primary-nav').getByRole('button', { name: 'Trang chủ' }).click();
        await expect(errorPage.locator('.home-txns-view-all-btn')).toBeVisible();
        await expect(errorPage.getByRole('heading', { name: 'Đã xảy ra lỗi hiển thị', exact: true })).toHaveCount(0);
      } finally { await errorPage.close(); }
    }
  });
  assert.deepEqual(errors, [], 'No unhandled browser errors in normal flows');
  console.log(`PASS ${passed} mobile UX scenarios; screenshots: ${evidence}`);
  await context.close();
})().catch(async error => {
  console.error(error); process.exitCode = 1;
  if (page && !page.isClosed()) {
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true });
    fs.writeFileSync(path.join(evidence, 'failure.txt'), await page.locator('body').innerText());
  }
}).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await mongoose.disconnect();
  if (database) await database.stop();
});

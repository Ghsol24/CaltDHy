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
function contrastHex(first, second) {
  const luminance = (hex) => {
    const value = hex.replace('#', '');
    const channels = value.length === 3 ? [...value].map(channel => channel + channel) : value.match(/.{2}/g);
    return channels.slice(0, 3)
      .map(channel => parseInt(channel, 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function blendCssColor(color, background) {
  const rgba = color.match(/[\d.]+/g)?.map(Number);
  assert.ok(rgba && rgba.length >= 3, `Màu CSS không hợp lệ: ${color}`);
  const hex = background.replace('#', '');
  const base = (hex.length === 3 ? [...hex].map(channel => channel + channel) : hex.match(/.{2}/g))
    .map(channel => parseInt(channel, 16));
  const alpha = rgba[3] ?? 1;
  return '#' + rgba.slice(0, 3).map((channel, index) =>
    Math.round(channel * alpha + base[index] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

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
  await check('PWA manifest and service worker install without caching private API responses', async () => {
    const manifest = await (await context.request.get('/manifest.json')).json();
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.background_color, '#090A0F');
    assert.equal(manifest.theme_color, '#090A0F');
    assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
    assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
    const sw = await context.request.get('/sw.js');
    assert.equal(sw.status(), 200);
    await page.goto('/signup');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.evaluate(() => fetch('/api/health'));
    const cachedPaths = await page.evaluate(async () => {
      const names = await caches.keys();
      const entries = await Promise.all(names.map(async name => (await (await caches.open(name)).keys())
        .map(request => new URL(request.url).pathname)));
      return entries.flat();
    });
    assert.ok(!cachedPaths.some(path => path.startsWith('/api/')));
  });
  await check('returning to a laptop tab checks for an updated application without reloading the form', async () => {
    const updatePage = await context.newPage();
    try {
      await updatePage.addInitScript(() => {
        window.__updateChecks = 0;
        const update = ServiceWorkerRegistration.prototype.update;
        ServiceWorkerRegistration.prototype.update = function (...args) {
          window.__updateChecks += 1;
          return update.apply(this, args);
        };
      });
      await updatePage.clock.install();
      await updatePage.goto('/login');
      await expect.poll(() => updatePage.evaluate(() => window.__updateChecks)).toBeGreaterThan(0);
      await updatePage.locator('#emailIn').fill('keep-form@example.test');
      const checks = await updatePage.evaluate(() => window.__updateChecks);
      await updatePage.clock.fastForward(61000);
      await updatePage.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect.poll(() => updatePage.evaluate(() => window.__updateChecks)).toBeGreaterThan(checks);
      await expect(updatePage.locator('#emailIn')).toHaveValue('keep-form@example.test');
    } finally { await updatePage.close(); }
  });
  await check('saved theme colors the first frame before the React bundle loads', async () => {
    const bootContext = await browser.newContext({ baseURL, serviceWorkers: 'block' });
    try {
      const bootPage = await bootContext.newPage();
      await bootPage.goto('/login');
      await bootPage.route('**/assets/*.js', route => route.abort());
      for (const [theme, expected] of [['dark', '#090a0f'], ['light', '#fafafb'], ['cream', '#f5ede0'], ['green', '#f0f9f4']]) {
        await bootPage.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
        await bootPage.reload();
        const colors = await bootPage.evaluate(() => ({
          theme: document.documentElement.className,
          canvas: getComputedStyle(document.documentElement).getPropertyValue('--theme-bootstrap-background').trim(),
          meta: document.querySelector('meta[name="theme-color"]').content
        }));
        assert.ok(colors.theme.includes(`${theme}-theme`));
        assert.equal(colors.canvas.toLowerCase(), expected);
        assert.equal(colors.meta.toLowerCase(), expected);
      }
      await bootPage.evaluate(() => localStorage.setItem('caltdhy_theme', 'invalid'));
      await bootPage.reload();
      assert.equal(await bootPage.locator('html').getAttribute('class'), 'dark-theme');
      assert.equal(await bootPage.locator('meta[name="theme-color"]').getAttribute('content'), '#090A0F');
    } finally {
      await bootContext.close();
    }
  });
  await check('public settings preserve all four themes across tabs, reopening and desktop login', async () => {
    const publicContext = await browser.newContext({ baseURL, serviceWorkers: 'block',
      viewport: { width: 1536, height: 960 } });
    const publicPage = await publicContext.newPage();
    const sibling = await publicContext.newPage();
    publicPage.on('pageerror', error => errors.push(error.message));
    try {
      await publicPage.goto('/');
      await sibling.goto('/login');
      for (const [theme, label] of [['dark', 'Tối'], ['light', 'Sáng'], ['cream', 'Kem'], ['green', 'Xanh']]) {
        await publicPage.locator('#idxSettingsBtn').click();
        const dialog = publicPage.locator('#idxSettingsModal');
        await expect(dialog.locator('.idx-theme-btn')).toHaveCount(4);
        await expect(dialog.locator('.idx-theme-hint')).toHaveCount(0);
        const choice = dialog.getByRole('button', { name: label, exact: true });
        await choice.click();
        await expect(choice).toHaveAttribute('aria-pressed', 'true');
        await expect(sibling.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
        assert.equal(await publicPage.evaluate(() => localStorage.getItem('caltdhy_theme')), theme);
        assert.equal(await dialog.locator('[aria-pressed=true].idx-theme-btn').count(), 1);
        if (process.env.LOADING_QA_DIR) {
          fs.mkdirSync(process.env.LOADING_QA_DIR, { recursive: true });
          await publicPage.screenshot({ path: `${process.env.LOADING_QA_DIR}/settings-${theme}.png`, animations: 'disabled' });
        }
        await publicPage.keyboard.press('Escape');
        await expect(publicPage.locator('#idxSettingsBtn')).toBeFocused();
        await publicPage.reload();
        await expect(publicPage.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));

        const loginPage = await publicContext.newPage();
        loginPage.on('pageerror', error => errors.push(error.message));
        let heldLogin;
        try {
          await loginPage.route('**/api/auth/login', route => { heldLogin = route; });
          await loginPage.goto('/login');
          await expect(loginPage.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
          await expect(loginPage.locator('.mod-eyebrow, .security-note, .status-bar')).toHaveCount(0);
          await loginPage.locator('#emailIn').fill('motion@example.test');
          await loginPage.locator('#pwIn').fill(password);
          await loginPage.locator('#loginForm button[type=submit]').click();
          const overlay = loginPage.locator('.signature-login');
          await expect(overlay).toBeVisible();
          await expect(overlay.locator('.signature-login__cube')).toHaveCSS('animation-name', 'signature-cube-bounce');
          const geometry = await overlay.evaluate(node => {
            const rect = node.getBoundingClientRect();
            return { width: rect.width, height: rect.height, top: rect.top, left: rect.left,
              coversCenter: node.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2)),
              portal: node.parentElement === document.body };
          });
          assert.deepEqual(geometry, { width: 1536, height: 960, top: 0, left: 0, coversCenter: true, portal: true });
          await expect.poll(() => Boolean(heldLogin)).toBe(true);
          if (process.env.LOADING_QA_DIR) {
            await loginPage.screenshot({ path: `${process.env.LOADING_QA_DIR}/loading-${theme}.png` });
          }
          await heldLogin.fulfill({ status: 401, contentType: 'application/json',
            body: '{"message":"Test login rejected"}' });
          heldLogin = null;
          await expect(overlay).toHaveCount(0);
          await expect(loginPage.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
        } finally {
          if (heldLogin) await heldLogin.abort().catch(() => {});
          await loginPage.close();
        }
      }
      await publicPage.setViewportSize({ width: 390, height: 844 });
      await publicPage.locator('#idxSettingsBtn').click();
      const dialog = publicPage.locator('#idxSettingsModal');
      await expect(dialog.locator('.idx-theme-btn')).toHaveCount(4);
      await expect.poll(() => dialog.locator('.idx-theme-btn').evaluateAll(buttons => buttons.every(button => {
        const rect = button.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth;
      })), { message: 'All four theme choices must fit and remain touch-friendly on mobile' }).toBe(true);
      if (process.env.LOADING_QA_DIR) await publicPage.screenshot({ path: `${process.env.LOADING_QA_DIR}/settings-mobile.png` });
    } finally { await publicContext.close(); }
  });
  await check('invite-only signup explains access and accepts only a private link', async () => {
    app.locals.registrationMode = 'invite';
    try {
      await page.goto('/signup');
      await expect(page.getByText('Đăng ký chỉ dành cho người được mời.')).toBeVisible();
      await expect(page.locator('#signupForm')).toHaveCount(0);
      const backgrounds = new Set();
      for (const theme of ['dark', 'cream', 'green', 'light']) {
        await page.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
        await page.reload();
        const notice = page.locator('.signup-invite-message');
        await expect(notice).toBeVisible();
        backgrounds.add(await notice.evaluate(element => getComputedStyle(element).backgroundColor));
        await expect(page.locator('body')).toHaveCSS('font-family', /Inter/);
      }
      assert.equal(backgrounds.size, 4, 'Invitation notice must follow every theme');
      const invitedEmail = crypto.randomUUID() + '@example.test';
      const token = crypto.randomBytes(32).toString('hex');
      await backend('./models/Invitation').create({
        email: invitedEmail,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 86400000)
      });
      await page.goto('/signup?invite=' + token + '&email=' + encodeURIComponent(invitedEmail));
      await expect(page.locator('#signupForm')).toBeVisible();
      await expect(page.locator('#emailIn')).toHaveValue(invitedEmail);
      await expect(page.locator('#emailIn')).toHaveAttribute('readonly', '');
    } finally {
      app.locals.registrationMode = 'open';
    }
  });
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
      const palette = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const value = name => root.getPropertyValue(name).trim();
        return {
          muted: value('--color-text-muted'), surface: value('--color-surface-muted'),
          card: value('--color-surface'),
          link: value('--color-link'), active: value('--color-active-text'),
          action: value('--color-action-bg'), hover: value('--color-action-hover-bg'),
          onAction: value('--color-on-action'),
          success: value('--color-success'), danger: value('--color-danger'),
          warning: value('--color-warning'),
          meta: document.querySelector('meta[name="theme-color"]').content,
          canvas: value('--color-canvas')
        };
      });
      assert.equal(palette.meta.toLowerCase(), palette.canvas.toLowerCase(), `${theme}: browser chrome phải theo theme`);
      for (const [name, foreground, background] of [
        ['muted', palette.muted, palette.surface],
        ['link', palette.link, palette.surface],
        ['active', palette.active, palette.surface],
        ['action', palette.onAction, palette.action],
        ['action hover', palette.onAction, palette.hover],
        ...['success', 'danger', 'warning'].flatMap(name => [
          [name + ' on card', palette[name], palette.card],
          [name + ' on subtle surface', palette[name], palette.surface]
        ])
      ]) {
        assert.ok(contrastHex(foreground, background) >= 4.5,
          `${theme}: ${name} ${foreground}/${background} = ${contrastHex(foreground, background).toFixed(2)} cần tương phản chữ ≥4.5:1`);
      }
      const badges = await page.evaluate(() => {
        const element = document.createElement('span');
        document.body.appendChild(element);
        const read = (background, foreground) => {
          element.style.background = `var(${background})`;
          element.style.color = `var(${foreground})`;
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, foreground: style.color };
        };
        const result = {
          warning: read('--warning-bg', '--warning-text'),
          danger: read('--danger-bg', '--danger-text')
        };
        element.remove();
        return result;
      });
      for (const [name, colors] of Object.entries(badges)) {
        const background = blendCssColor(colors.background, palette.card);
        const foreground = blendCssColor(colors.foreground, background);
        assert.ok(contrastHex(foreground, background) >= 4.5,
          `${theme}: nhãn ${name} chỉ đạt ${contrastHex(foreground, background).toFixed(2)}:1`);
      }
    }
  });
  await check('dark dialog icons and mobile actions remain visible', async () => {
    await page.evaluate(() => localStorage.setItem('caltdhy_theme', 'dark'));
    const auditPage = await context.newPage();
    try {
      await auditPage.setViewportSize({ width: 390, height: 844 });
      await auditPage.goto('/spending/home');
      await auditPage.getByRole('button', { name: 'Thêm giao dịch', exact: true }).first().click();
      const dialog = auditPage.getByRole('dialog', { name: 'Thêm giao dịch mới' });
      await expect(dialog).toBeVisible();
      const icon = dialog.locator('.txn-card-icon svg').first();
      await expect(icon).toHaveCSS('stroke', /rgb\((?!0, 0, 0)/);
      const footer = await dialog.locator('.txn-modal-footer').boundingBox();
      assert.ok(footer && footer.y >= 0 && footer.y + footer.height <= 844,
        'Các nút lưu/hủy phải nằm trong viewport mobile');
      await expect(dialog.locator('.txn-btn-submit')).toBeVisible();
      await auditPage.setViewportSize({ width: 390, height: 430 });
      await dialog.locator('.txn-input').first().focus();
      const compactFooter = await dialog.locator('.txn-modal-footer').boundingBox();
      assert.ok(compactFooter && compactFooter.y >= 0 && compactFooter.y + compactFooter.height <= 430,
        'Các nút giao dịch phải còn truy cập được khi bàn phím thu hẹp viewport');
    } finally {
      await auditPage.close();
    }
  });
  await check('jar creation dialog uses the surface of each theme', async () => {
    const jarPage = await context.newPage();
    try {
      const expectedSurface = {
        dark: 'rgb(18, 19, 28)', light: 'rgb(255, 255, 255)',
        cream: 'rgb(253, 248, 242)', green: 'rgb(255, 255, 255)'
      };
      for (const theme of ['dark', 'light', 'cream', 'green']) {
        await jarPage.goto('/spending/jars/list');
        await jarPage.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
        await jarPage.reload();
        await jarPage.getByRole('button', { name: 'Tạo hũ đầu tiên' }).click();
        const modal = jarPage.getByRole('dialog', { name: 'Tạo hũ tiết kiệm mới' });
        await expect(modal).toBeVisible();
        const colors = await modal.evaluate(element => {
          const style = selector => getComputedStyle(element.querySelector(selector));
          return {
            body: style('.jar-modal-body').backgroundColor,
            input: style('.jar-text-input').backgroundColor,
            subtitle: style('.jar-modal-subtitle').color
          };
        });
        assert.equal(colors.body, expectedSurface[theme], `${theme}: phần thân modal phải theo bề mặt theme`);
        if (theme === 'dark') {
          assert.equal(colors.input, 'rgb(26, 28, 41)');
          assert.equal(colors.subtitle, 'rgb(148, 163, 184)');
        }
      }
      await jarPage.setViewportSize({ width: 390, height: 430 });
      await jarPage.locator('.jar-text-input').focus();
      const compactFooter = await jarPage.locator('.jar-modal-footer').boundingBox();
      assert.ok(compactFooter && compactFooter.y >= 0 && compactFooter.y + compactFooter.height <= 430,
        'Các nút tạo Hũ phải còn truy cập được khi bàn phím thu hẹp viewport');
    } finally {
      await jarPage.close();
    }
  });
  await check('settings and account entry points share one accessible Settings Center', async () => {
    const settingsButton = page.locator('.tb-settings-btn');
    await settingsButton.click();
    const settingsDialog = page.getByRole('dialog', { name: 'Cài đặt' });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog.locator('.account-header-desc')).toHaveText('Giao diện và ngôn ngữ');
    await expect(settingsDialog.locator('.settings-nav-group').nth(1).locator('p')).toHaveText('GIAO DIỆN VÀ NGÔN NGỮ');
    await expect(settingsDialog.getByRole('button', { name: 'Ngôn ngữ & khu vực' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['Hồ sơ', 'Bảo mật', 'Dữ liệu & quyền riêng tư', 'Giao diện', 'Hướng dẫn sử dụng', 'Đăng xuất']) {
      await expect(settingsDialog.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    const languageGroup = settingsDialog.getByRole('group', { name: 'Ngôn ngữ' });
    const currencyGroup = settingsDialog.getByRole('group', { name: 'Đơn vị tiền hiển thị' });
    await expect(languageGroup.getByRole('button')).toHaveCount(3);
    await expect(currencyGroup.getByRole('button', { name: 'VND' })).toHaveAttribute('aria-pressed', 'true');
    await expect(currencyGroup.getByRole('button', { name: 'USD' })).toBeDisabled();
    for (const [buttonName, locale, groupTitle] of [
      ['English', 'en', 'Appearance and language'],
      ['简体中文', 'zh-CN', '界面与语言'],
      ['Tiếng Việt', 'vi', 'Giao diện và ngôn ngữ']
    ]) {
      await page.locator('.settings-center-dialog').getByRole('button', { name: buttonName, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('.settings-center-dialog')).toHaveAccessibleName({ en: 'Settings', 'zh-CN': '设置', vi: 'Cài đặt' }[locale]);
      await expect(page.locator('.settings-center-dialog .account-header-desc')).toHaveText(groupTitle);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true,
        `${locale}: Settings không được tràn ngang`);
    }
    await settingsDialog.getByRole('button', { name: 'Giao diện', exact: true }).click();
    await expect(settingsDialog.locator('.account-header-desc')).toHaveText('Giao diện và ngôn ngữ');
    const themeGroup = settingsDialog.getByRole('group', { name: 'Chọn giao diện' });
    await expect(themeGroup.getByRole('button')).toHaveCount(4);
    await themeGroup.getByRole('button', { name: 'Giao diện Tối' }).click();
    await expect(page.locator('html')).toHaveClass(/dark-theme/);
    await themeGroup.getByRole('button', { name: 'Giao diện Sáng' }).click();
    await expect(page.locator('html')).toHaveClass(/light-theme/);
    await settingsDialog.getByRole('button', { name: 'Dữ liệu & quyền riêng tư' }).click();
    await expect(settingsDialog.locator('.account-header-desc')).toHaveText('Quản lý Tài khoản');
    const downloadPromise = page.waitForEvent('download');
    await settingsDialog.getByRole('button', { name: 'Xuất JSON' }).click();
    const backupDownload = await downloadPromise;
    assert.match(backupDownload.suggestedFilename(), /^caltdhy_backup_\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(fs.readFileSync(await backupDownload.path(), 'utf8'));
    assert.equal(backup.user.email, emailA);
    assert.ok(Array.isArray(backup.wallets) && Array.isArray(backup.budgets));
    await settingsDialog.getByRole('button', { name: 'Hướng dẫn sử dụng', exact: true }).click();
    await expect(settingsDialog.locator('.account-header-desc')).toHaveText('Hỗ trợ');
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
    await expect(profileDialog.locator('.account-header-desc')).toHaveText('Quản lý Tài khoản');
    const displayName = profileDialog.locator('#acc-display-name');
    await displayName.fill('Tên chưa lưu');
    await profileDialog.getByRole('button', { name: 'Đóng trung tâm cài đặt' }).click();
    await expect(page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' })).toBeVisible();
    const overlayOpacity = await page.evaluate(() => {
      const alpha = selector => Number(getComputedStyle(document.querySelector(selector)).backgroundColor.match(/,\s*([\d.]+)\)$/)?.[1]);
      return {
        parent: alpha('.settings-center-overlay'),
        nested: alpha('.confirm-dialog-backdrop')
      };
    });
    assert.ok(overlayOpacity.nested < overlayOpacity.parent,
      'Lớp phủ xác nhận lồng nhau phải nhẹ hơn lớp phủ của Settings');
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
    const savedTheme = await page.evaluate(() => localStorage.getItem('caltdhy_theme'));
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
    assert.equal(await page.evaluate(() => localStorage.getItem('caltdhy_theme')), savedTheme);
    await expect(page.locator('html')).toHaveClass(new RegExp(`${savedTheme}-theme`));
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
  await check('signature login keeps moving during a slow request and returns errors to the form', async () => {
    let heldLogin;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/auth/login', route => { heldLogin = route; });
    try {
      await page.locator('#emailIn').fill(emailA);
      await page.locator('#pwIn').fill(password);
      await page.locator('#loginForm button[type=submit]').click();
      const overlay = page.locator('.signature-login');
      await expect(overlay).toBeVisible();
      await expect(overlay.locator('.signature-login__particle')).toHaveCount(6);
      await expect(overlay.locator('.signature-login__bar')).toHaveCount(9);
      await expect(overlay.locator('.signature-login__cube')).toHaveCSS('animation-name', 'none');
      await page.waitForTimeout(2700);
      const readProgress = async () => Number((await overlay.locator('.signature-login__progress-caption strong')
        .textContent()).replace('%', ''));
      const first = await readProgress();
      await page.waitForTimeout(450);
      const second = await readProgress();
      assert.ok(first >= 70 && second > first, `Tiến độ chờ phải tăng: ${first}% → ${second}%`);
      await heldLogin.fulfill({ status: 401, contentType: 'application/json',
        body: '{"message":"Sai thông tin đăng nhập"}' });
      await expect(page.locator('#formErr')).toContainText('Sai thông tin đăng nhập');
      await expect(overlay).toHaveCount(0);
      assert.ok(page.url().endsWith('/login'));
    } finally {
      if (heldLogin) await heldLogin.abort().catch(() => {});
      await page.unroute('**/api/auth/login');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
  });
  await check('signature login times out safely after 25 seconds', async () => {
    const timeoutPage = await context.newPage();
    let heldLogin;
    try {
      await timeoutPage.clock.install();
      await timeoutPage.route('**/api/auth/login', route => { heldLogin = route; });
      await timeoutPage.goto('/login');
      await timeoutPage.locator('#emailIn').fill(emailA);
      await timeoutPage.locator('#pwIn').fill(password);
      await timeoutPage.locator('#loginForm button[type=submit]').click();
      await expect(timeoutPage.locator('.signature-login')).toBeVisible();
      await timeoutPage.clock.fastForward(25010);
      await expect(timeoutPage.locator('#formErr')).toContainText('25 giây');
      await expect(timeoutPage.locator('.signature-login')).toHaveCount(0);
      assert.ok(timeoutPage.url().endsWith('/login'));
    } finally {
      if (heldLogin) await heldLogin.abort().catch(() => {});
      await timeoutPage.close();
    }
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
    await page.evaluate(() => {
      window.__signatureArrivalAnimations = 0;
      window.__signatureBounceStarted = null;
      window.__signatureArrivalStarted = null;
      document.addEventListener('animationstart', event => {
        if (event.animationName === 'signature-cube-bounce') window.__signatureBounceStarted = performance.now();
        if (event.animationName === 'signature-cube-arrival') {
          window.__signatureArrivalAnimations += 1;
          window.__signatureArrivalStarted = performance.now();
        }
      }, { once: false });
    });
    await page.locator('#loginForm button[type=submit]').click();
    await expect(page.locator('.signature-login')).toBeVisible();
    await page.waitForURL('**/spending/home');
    await expect(page.locator('.signature-login')).toHaveCount(0);
    assert.ok(await page.evaluate(() => window.__signatureArrivalAnimations > 0),
      'Logo C phải chạy chuyển động keyframe đến Topbar trước khi overlay đóng');
    assert.ok(await page.evaluate(() => window.__signatureArrivalStarted - window.__signatureBounceStarted >= 880),
      'Even a fast desktop login must show approximately one complete bounce before arrival');
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
    await mobilePage.reload();
    await expect(mobilePage.locator('.home-txn-row')).toHaveCount(2);
    await expect(mobilePage.locator('.home-txns-view-all-btn')).toBeVisible();

    await primaryNav.getByRole('button', { name: 'Kế hoạch' }).click();
    await mobilePage.waitForURL('**/spending/plan/overview');
    const planNav = mobilePage.getByRole('navigation', { name: 'Điều hướng Kế hoạch' });
    await expect(planNav).toBeVisible();
    await mobilePage.locator('.plan-btn-create-primary').evaluate((button) => button.scrollIntoView({ block: 'center' }));
    const planCreateIsTouchable = await mobilePage.locator('.plan-btn-create-primary').evaluate((button) => {
      const box = button.getBoundingClientRect();
      return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('button') === button;
    });
    assert.equal(planCreateIsTouchable, true, 'Tab con không được đè lên nút tạo kế hoạch');
    await mobilePage.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
    const planBottomIsReachable = await mobilePage.evaluate(() => {
      const last = document.querySelector('.plan-overview-container')?.lastElementChild?.getBoundingClientRect();
      const nav = document.querySelector('.mobile-primary-nav')?.getBoundingClientRect();
      return Boolean(last && nav && last.bottom <= nav.top);
    });
    assert.equal(planBottomIsReachable, true, 'Nội dung cuối kế hoạch phải ở trên thanh điều hướng đáy');
    await planNav.getByRole('button', { name: 'Ngân sách' }).click();
    await mobilePage.waitForURL('**/spending/plan/budgets');
    await expect(mobilePage.getByRole('heading', { name: 'Ngân sách', exact: true })).toBeVisible();
    await expect(mobilePage).toHaveTitle('Ngân sách – CaltDHy');
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
    await mobilePage.locator('.analytics-cat-item-row').filter({ hasText: 'Dịch vụ' })
      .getByRole('button', { name: 'Xem giao dịch' }).click();
    await mobilePage.waitForURL(/\/spending\/analytics\/transactions\?from=/);
    await expect(mobilePage.locator('.transaction-inspection-row')).toHaveCount(1);
    await expect(mobilePage.locator('.transaction-ledger-table')).toBeVisible();
    const categoryFilter = mobilePage.locator('.transaction-filter-dropdown').nth(1);
    await expect(categoryFilter.locator('.transaction-filter-value')).toContainText('Dịch vụ');
    await categoryFilter.locator('.transaction-filter-trigger').click();
    await expect(categoryFilter.getByRole('listbox')).toBeVisible();
    await categoryFilter.getByRole('option', { name: 'Dịch vụ' }).click();
    await expect(categoryFilter.getByRole('listbox')).toHaveCount(0);
    await analyticsNav.getByRole('button', { name: 'Chi tiêu' }).click();
    await mobilePage.waitForURL('**/spending/analytics/spending');
    await analyticsNav.getByRole('button', { name: 'Dòng tiền' }).click();
    await mobilePage.waitForURL('**/spending/analytics/cash-flow');
    const cashFlowPanel = mobilePage.locator('#analytics-cashflow');
    await expect(cashFlowPanel.locator('.trend-week-nav__range')).toHaveText(/Ngày 1–7\//);
    await expect(cashFlowPanel.locator('.trend-legend .legend-item')).toHaveCount(2);
    await expect(cashFlowPanel.locator('.trend-chart-box canvas')).toHaveAttribute('aria-label', 'Biểu đồ cột thu nhập và chi tiêu');
    const chartLayout = await cashFlowPanel.evaluate((panel) => {
      const modes = panel.querySelector('.trend-segmented-group');
      const buttons = [...modes.querySelectorAll('button')];
      return {
        pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        modesOverflow: modes.scrollWidth > modes.clientWidth + 1,
        modesFit: buttons.every((button) => button.getBoundingClientRect().right <= panel.getBoundingClientRect().right),
        weekButtonWidths: [...panel.querySelectorAll('.trend-week-nav__button')]
          .map((button) => button.getBoundingClientRect().width),
      };
    });
    assert.equal(chartLayout.pageOverflows, false, 'Biểu đồ không được gây tràn ngang trang mobile');
    assert.equal(chartLayout.modesOverflow, false, 'Cả ba chế độ biểu đồ phải nằm trong vùng hiển thị');
    assert.equal(chartLayout.modesFit, true, 'Nút chế độ cuối phải hiện đầy đủ');
    assert.ok(chartLayout.weekButtonWidths.every((width) => width >= 44),
      'Nút đổi khoảng ngày phải có vùng chạm tối thiểu 44px');
    await cashFlowPanel.getByRole('button', { name: 'Khoảng ngày sau' }).click();
    await expect(cashFlowPanel.locator('.trend-week-nav__range')).toHaveText(/Ngày 8–14\//);
    await expect(cashFlowPanel.locator('.trend-empty-chart-box')).toBeVisible();
    await cashFlowPanel.getByRole('button', { name: 'Khoảng ngày trước' }).click();
    await expect(cashFlowPanel.locator('.trend-chart-box canvas')).toBeVisible();
    await cashFlowPanel.getByRole('radio', { name: '3 tháng gần đây' }).click();
    await expect(cashFlowPanel.locator('.trend-chart-box canvas')).toBeVisible();
    await cashFlowPanel.getByRole('radio', { name: '6 tháng gần đây' }).click();
    await expect(cashFlowPanel.locator('.trend-chart-box canvas')).toBeVisible();
    await cashFlowPanel.getByRole('radio', { name: 'Theo ngày trong tháng' }).click();
    await expect(cashFlowPanel.locator('.trend-week-nav__range')).toHaveText(/Ngày 1–7\//);
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
    await mobilePage.locator('.analytics-top-days button').first().click();
    const dayDrawer = mobilePage.getByRole('dialog', { name: /Giao dịch ngày/ });
    await expect(dayDrawer).toBeVisible();
    await expect(dayDrawer.locator('.day-drawer-summary strong')).toContainText(/410\.000/);
    await expect(dayDrawer.locator('.transaction-inspection-row')).toHaveCount(2);
    await dayDrawer.getByRole('button', { name: 'Đánh dấu ngày đã dự kiến' }).click();
    await expect(dayDrawer.getByRole('button', { name: 'Bỏ đánh dấu ngày dự kiến' })).toBeVisible();
    await dayDrawer.getByRole('button', { name: 'Xem đầy đủ trong lịch sử' }).click();
    await mobilePage.waitForURL(/\/spending\/analytics\/transactions\?date=/);
    await expect(mobilePage.getByRole('heading', { name: 'Lịch sử giao dịch' })).toBeVisible();
    await expect(analyticsNav.locator('button[aria-current="page"]').filter({ hasText: 'Lịch sử' })).toHaveCount(1);
    const historyTabVisible = await analyticsNav.evaluate((nav) => {
      const scroller = nav.querySelector('.mobile-section-nav__scroller').getBoundingClientRect();
      const active = nav.querySelector('[aria-current="page"]').getBoundingClientRect();
      return active.left >= scroller.left - 1 && active.right <= scroller.right + 1;
    });
    assert.equal(historyTabVisible, true, 'Tab Lịch sử đang chọn phải tự hiện trong thanh tab con');
    await expect(mobilePage.locator('.transaction-inspection-row')).toHaveCount(2);
    const recurringHistoryFilter = mobilePage.getByRole('checkbox', { name: 'Ẩn khoản định kỳ' });
    await recurringHistoryFilter.check();
    await expect(recurringHistoryFilter).toBeChecked();
    await expect(mobilePage.locator('.transaction-history-checkbox')).toHaveClass(/is-active/);
    await mobilePage.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await expect(recurringHistoryFilter).not.toBeChecked();
    for (const theme of ['dark', 'cream', 'green', 'light']) {
      await mobilePage.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
      await mobilePage.reload();
      await expect(mobilePage.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
      const periodFilter = mobilePage.locator('.transaction-filter-dropdown').nth(3);
      await periodFilter.locator('.transaction-filter-trigger').click();
      await periodFilter.getByRole('option', { name: 'Tùy chọn ngày' }).click();
      await expect(mobilePage.locator('.transaction-filter-custom-dates input[type="date"]')).toHaveCount(2);
      const walletFilter = mobilePage.locator('.transaction-filter-dropdown').nth(2);
      const walletTrigger = walletFilter.locator('.transaction-filter-trigger');
      await walletTrigger.click();
      await expect(walletFilter.getByRole('listbox')).toBeVisible();
      const styles = await mobilePage.locator('.transaction-history').evaluate((history) => {
        const trigger = history.querySelectorAll('.transaction-filter-trigger')[2];
        const menu = history.querySelector('.transaction-filter-menu');
        const icon = history.querySelector('.transaction-inspection-icon svg');
        const swatch = document.createElement('span');
        swatch.style.backgroundColor = 'var(--color-surface)';
        history.append(swatch);
        const surfaceBackground = getComputedStyle(swatch).backgroundColor;
        swatch.remove();
        return {
          menuBackground: getComputedStyle(menu).backgroundColor,
          surfaceBackground,
          menuBorderRadius: getComputedStyle(menu).borderRadius,
          triggerExpanded: trigger.getAttribute('aria-expanded'),
          dateColorScheme: getComputedStyle(history.querySelector('input[type="date"]')).colorScheme,
          iconFill: icon?.getAttribute('fill'),
          clearIconFill: history.querySelector('.transaction-history-clear svg')?.getAttribute('fill'),
          clearRadius: getComputedStyle(history.querySelector('.transaction-history-clear')).borderRadius,
          pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
      });
      assert.equal(styles.triggerExpanded, 'true', `${theme}: menu tự vẽ đang mở`);
      assert.notEqual(styles.menuBorderRadius, '0px', `${theme}: menu phải bo góc`);
      assert.equal(styles.iconFill, 'none', `${theme}: icon giao dịch là nét rỗng`);
      assert.equal(styles.clearIconFill, 'none', `${theme}: icon xóa bộ lọc là nét rỗng`);
      assert.ok(styles.clearRadius !== '0px', `${theme}: nút xóa bộ lọc phải bo góc`);
      assert.equal(styles.pageOverflows, false, `${theme}: lịch sử không được tràn ngang`);
      assert.equal(styles.menuBackground, styles.surfaceBackground, `${theme}: menu cần màu nền theo theme`);
      assert.equal(styles.dateColorScheme, theme === 'dark' ? 'dark' : 'light', `${theme}: ô ngày cần đúng bảng màu`);
      await walletFilter.getByRole('option', { selected: true }).press('Escape');
      await expect(walletFilter.getByRole('listbox')).toHaveCount(0);
      await expect(walletTrigger).toBeFocused();
    }
    await mobilePage.getByPlaceholder('Tìm mô tả hoặc danh mục').fill('Internet');
    await expect(mobilePage.locator('.transaction-inspection-row')).toHaveCount(1);
    await mobilePage.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await expect(mobilePage.locator('.transaction-inspection-row')).toHaveCount(2);
    await analyticsNav.getByRole('button', { name: 'Dòng tiền' }).click();
    await mobilePage.waitForURL('**/spending/analytics/cash-flow');
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
    await expect(mobilePage.locator('button.sidebar-nav-item.active').filter({ hasText: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
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
    await mobilePage.getByRole('button', { name: 'Đóng trung tâm cài đặt' }).click();
    await expect(mobilePage.locator('.settings-center-dialog')).toHaveCount(0);
    await mobilePage.locator('.home-txns-view-all-btn').click();
    await mobilePage.waitForURL('**/spending/analytics/transactions');
    await expect(mobilePage.locator('.transaction-ledger-table')).toBeVisible();
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

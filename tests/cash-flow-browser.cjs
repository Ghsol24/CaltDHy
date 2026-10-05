'use strict';

// Real production-browser coverage. Build first: npm run build --prefix frontEnd-react.
// Fixtures live in an ephemeral database; evidence contains synthetic transactions only.
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
const evidenceDir = process.env.CASH_FLOW_QA_DIR || path.join(os.tmpdir(), 'caltdhy-cash-flow-evidence');
let server, db, browser, auditPage, passed = 0;
async function check(name, work) { await work(); passed += 1; console.log('PASS ' + name); }

(async () => {
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_EXPIRES_IN: '1h', HOST: '127.0.0.1', REGISTRATION_MODE: 'open',
    AUTH_RATE_LIMIT_MAX: '1000', API_RATE_LIMIT_MAX: '100000' });
  for (const key of ['MONGODB_URI', 'CLIENT_URL', 'CORS_WHITELIST', 'GMAIL_USER', 'GMAIL_PASS', 'COOKIE_SECURE']) delete process.env[key];
  let app;
  server = http.createServer((req, res) => app(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.PORT = String(server.address().port);
  app = backend('./server');
  db = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(db.getUri('caltdhy_cash_flow_test'));
  for (const model of Object.values(mongoose.models)) { await model.createCollection(); await model.createIndexes(); }
  const baseURL = 'http://127.0.0.1:' + server.address().port;
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } :
      process.platform === 'darwin' && fs.existsSync(localChrome) ? { executablePath: localChrome } : {}) });
  const context = await browser.newContext({ baseURL, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
    serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  auditPage = page;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // UTC is still October 4; the user's local date is already October 5.
  await page.clock.setFixedTime(new Date('2026-10-04T19:30:00Z'));
  const email = 'cash-flow-' + crypto.randomUUID() + '@example.test';
  await page.goto('/signup');
  await page.locator('#fullName').fill('Cash Flow Audit');
  await page.locator('#emailIn').fill(email);
  await page.locator('#pwIn').fill('Browser-test-1234');
  await page.locator('#signupForm button[type=submit]').click();
  await page.waitForURL('**/spending/home');
  const user = await backend('./models/User').findOne({ email });
  const wallet = await backend('./models/Wallet').findOne({ userId: user._id, isDefault: true });
  const fixture = (date, type, amount, desc, fee = 0) => ({ userId: user._id, walletId: wallet._id,
    date, type, amount, fee, category: type === 'income' ? 'Lương' : 'Ăn uống', desc });
  await backend('./models/Transaction').insertMany([
    fixture('2026-10-02', 'income', 7000000, 'Lương kiểm thử 7 triệu'),
    fixture('2026-10-05', 'income', 80000, 'Thu nhập thêm kiểm thử'),
    fixture('2026-10-01', 'expense', 440000, 'Ngày chi lớn nhất kiểm thử', 8000),
    fixture('2026-10-02', 'expense', 222000, 'Chi ngày 2 kiểm thử'),
    fixture('2026-10-03', 'expense', 129000, 'Chi ngày 3 kiểm thử'),
    fixture('2026-10-04', 'expense', 152000, 'Chi ngày 4 kiểm thử'),
    fixture('2026-10-05', 'expense', 117000, 'Chi ngày 5 kiểm thử'),
    fixture('2026-10-05', 'expense', 70000, 'Thanh toán định kỳ: Internet kiểm thử', 2000),
    ...['04', '05', '06', '07', '08', '09'].flatMap((month, index) => [
      fixture(`2026-${month}-02`, 'income', 7000000, `Lương tháng ${month} kiểm thử`),
      fixture(`2026-${month}-07`, 'expense', 140000 + index * 1000, `Chi tháng ${month} kiểm thử`)
    ]),
    fixture('2026-09-18', 'expense', 350000, 'Chi tháng 9 ngày 18 kiểm thử'),
    fixture('2026-09-21', 'expense', 480000, 'Chi tháng 9 ngày 21 kiểm thử'),
    fixture('2026-09-25', 'expense', 222000, 'Chi tháng 9 ngày 25 kiểm thử'),
    fixture('2026-09-28', 'expense', 152000, 'Chi tháng 9 ngày 28 kiểm thử')
  ]);
  const panel = page.getByTestId('cashflow-panel');
  const chart = page.getByTestId('cashflow-chart');
  const popover = page.getByTestId('cashflow-popover');
  const drawer = page.getByRole('dialog', { name: /Giao dịch ngày/ });
  const period = page.getByTestId('cashflow-period-trigger');
  const display = page.getByTestId('cashflow-display-trigger');
  async function enter() {
    await page.goto('/spending/analytics/cash-flow');
    await expect(panel).toBeVisible();
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute('data-scale-min', '0');
  }
  async function closePopover() {
    if (await popover.count()) { await page.keyboard.press('Escape'); await expect(popover).toHaveCount(0); }
  }
  async function selectMode(mode, month) {
    await closePopover(); await period.click();
    await popover.locator(`input[type=radio][value="${mode}"]`).locator('..').click();
    if (month) await page.getByTestId('cashflow-month-input').fill(month);
    await closePopover(); await expect(chart).toHaveAttribute('data-mode', mode);
  }
  async function selectSeries(series) {
    await closePopover(); await display.click();
    await popover.locator(`input[type=radio][value="${series}"]`).locator('..').click();
    await closePopover(); await expect(chart).toHaveAttribute('data-series', series);
  }
  async function includeRecurring(include) {
    await closePopover(); await display.click();
    await page.getByTestId('cashflow-recurring-input').setChecked(include);
    await closePopover();
  }
  async function drillSeptember() {
    await expect(chart).toHaveAttribute('data-mode', '6months');
    const point = JSON.parse(await chart.getAttribute('data-point-positions'))
      .find(item => item.index === 4 && item.datasetIndex === 0);
    await chart.click({ position: { x: point.x, y: point.y } });
    await expect(page.getByTestId('cashflow-back-period')).toBeVisible();
    await expect(chart).toHaveAttribute('data-mode', 'daily');
    await expect(period).toContainText(/9/);
  }
  async function failNextPreferences() {
    await page.route('**/api/auth/preferences', route => route.fulfill({ status: 500,
      contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Cash-flow preference fixture failure' }) }), { times: 1 });
    return { response: page.waitForResponse(response => response.url().endsWith('/api/auth/preferences') && response.status() === 500) };
  }
  const preferences = async () => (await (await context.request.get('/api/auth/session')).json()).user.preferences;
  const labels = async () => JSON.parse(await chart.getAttribute('data-visible-labels'));
  const currency = amount => new RegExp(amount.toLocaleString('vi-VN').replace(/\./g, '\\.'));
  async function panelScreenshot(name) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    // A fixed phone navigation bar otherwise appears halfway through a tall element capture.
    // This affects the capture only; all viewport/menu captures retain the real navigation.
    await panel.screenshot({ path: path.join(evidenceDir, name), animations: 'disabled',
      style: '.mobile-primary-nav { visibility: hidden !important; }' });
  }
  async function chartAlpha(dayIndex) {
    return chart.evaluate((canvas, index) => {
      const point = JSON.parse(canvas.dataset.pointPositions).find(item => item.index === index && item.datasetIndex === 0);
      const scaleX = canvas.width / canvas.clientWidth, scaleY = canvas.height / canvas.clientHeight;
      return canvas.getContext('2d').getImageData(Math.floor(point.x * scaleX), Math.floor(18 * scaleY), 1, 1).data[3];
    }, dayIndex);
  }
  async function barAlpha(index, datasetIndex = 0) {
    return chart.evaluate((canvas, selected) => {
      const point = JSON.parse(canvas.dataset.pointPositions)
        .find(item => item.index === selected.index && item.datasetIndex === selected.datasetIndex);
      return canvas.getContext('2d').getImageData(Math.floor(point.x * canvas.width / canvas.clientWidth),
        Math.floor(point.y * canvas.height / canvas.clientHeight), 1, 1).data[3];
    }, { index, datasetIndex });
  }
  async function verifyFit(locator, label) {
    const layout = await locator.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        overflow: element.scrollWidth - element.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(layout.left >= -1 && layout.right <= layout.viewportWidth + 1, `${label}: fits horizontally (${JSON.stringify(layout)})`);
    assert.ok(layout.overflow <= 1 && layout.documentOverflow <= 1, `${label}: no horizontal overflow (${JSON.stringify(layout)})`);
    return layout;
  }
  async function verifyTextContrast(locator, selector, label) {
    const violations = await locator.evaluate((element, selected) => {
      const context = document.createElement('canvas').getContext('2d');
      context.canvas.width = context.canvas.height = 1;
      const rgba = color => {
        context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
        const value = [...context.getImageData(0, 0, 1, 1).data]; value[3] /= 255; return value;
      };
      const blend = (foreground, background) => foreground.slice(0, 3)
        .map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]));
      const luminance = rgb => rgb.map(channel => channel / 255)
        .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      return [...element.querySelectorAll(selected)].filter(node => node.getClientRects().length && node.textContent.trim())
        .map(node => {
          const ancestors = [];
          for (let current = node; current; current = current.parentElement) ancestors.unshift(current);
          const background = ancestors.reduce((color, current) => blend(rgba(getComputedStyle(current).backgroundColor), color), [255, 255, 255]);
          const foreground = blend(rgba(getComputedStyle(node).color), background);
          const first = luminance(foreground), second = luminance(background);
          return { text: node.textContent.trim(), contrast: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05) };
        }).filter(item => item.contrast < 4.5);
    }, selector);
    assert.deepEqual(violations, [], `${label}: small text contrast must be at least 4.5:1`);
  }

  await check('expense-only rescales a real 7M salary comparison from a zero baseline', async () => {
    await enter();
    await expect(chart).toHaveAttribute('data-series', 'expense');
    await expect(chart).toHaveAttribute('data-mode', 'daily');
    const expenseScale = Number(await chart.getAttribute('data-scale-max'));
    assert.ok(expenseScale >= 448000 && expenseScale < 700000, `expense scale ${expenseScale}`);
    assert.equal((await labels()).length, 31);
    await expect.poll(() => barAlpha(0)).toBeGreaterThan(240);
    await panelScreenshot('expense-scale-dark.png');
    await selectSeries('both');
    await expect.poll(async () => Number(await chart.getAttribute('data-scale-max'))).toBeGreaterThanOrEqual(7000000);
    await expect(chart).toHaveAttribute('data-scale-min', '0');
    await expect.poll(() => barAlpha(1)).toBeGreaterThan(240);
    await panelScreenshot('both-scale-dark.png');
    await selectSeries('expense');
    await expect.poll(async () => Number(await chart.getAttribute('data-scale-max'))).toBeLessThan(700000);
    await expect.poll(() => chartAlpha(25)).toBeGreaterThan(100);
    assert.equal(await chartAlpha(3), 0, 'Only the future-day region is shaded');
  });

  await check('period choices aggregate months ending in the selected month and retain the current-period qualifier', async () => {
    await selectMode('3months');
    assert.equal((await labels()).length, 3);
    await expect(panel).toContainText(/2026/);
    await expect(panel).toContainText(/đang diễn ra|đến ngày|chưa kết thúc/i);
    await selectMode('6months');
    assert.equal((await labels()).length, 6);
    await selectMode('3months', '2026-09');
    assert.equal((await labels()).length, 3);
    await expect(period).toContainText(/9|09/);
    await selectMode('daily', '2026-10');
    assert.equal((await labels()).length, 31);
    await expect.poll(() => chartAlpha(25)).toBeGreaterThan(100);
    await selectMode('daily', '2026-09');
    await expect.poll(() => chartAlpha(25)).toBe(0);
    await selectMode('daily', '2026-10');
  });

  await check('local date magnifier opens income or expense details without changing the period', async () => {
    await selectSeries('expense');
    await page.getByTestId('cashflow-date-trigger').click();
    await expect(page.getByTestId('cashflow-date-input')).toHaveValue('2026-10-05');
    await page.getByTestId('cashflow-date-input').fill('2026-10-01');
    await page.getByTestId('cashflow-date-open').click();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.day-drawer-summary strong')).toContainText(currency(448000));
    await drawer.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(chart).toHaveAttribute('data-mode', 'daily');
    await selectSeries('income');
    await page.getByTestId('cashflow-date-trigger').click();
    await page.getByTestId('cashflow-date-input').fill('2026-10-02');
    await page.getByTestId('cashflow-date-open').click();
    await expect(drawer.locator('.day-drawer-summary strong')).toContainText(currency(7000000));
    await expect(drawer.locator('.day-drawer-tabs button.is-active')).toHaveText('Thu nhập');
    await drawer.getByRole('button', { name: 'Đóng', exact: true }).click();
    await selectSeries('expense');
  });

  await check('recurring scope agrees in top-day totals, drawer and filtered history including fees', async () => {
    await includeRecurring(true);
    await expect(panel.locator('.cashflow-summary dd').nth(1)).toContainText(currency(1140000));
    await page.getByTestId('cashflow-more-days').click();
    const day = page.locator('[data-testid="cashflow-top-day"][data-date="2026-10-05"]');
    await expect(day).toContainText(currency(189000));
    await day.click();
    await expect(drawer.locator('.day-drawer-summary strong')).toContainText(currency(189000));
    await expect(drawer.locator('.transaction-inspection-row')).toHaveCount(2);
    await drawer.getByRole('button', { name: 'Đóng', exact: true }).click();
    await includeRecurring(false);
    await expect(panel.locator('.cashflow-summary dd').nth(1)).toContainText(currency(1068000));
    await page.getByTestId('cashflow-more-days').click();
    await expect(day).toContainText(currency(117000));
    await day.click();
    await expect(drawer.locator('.day-drawer-summary strong')).toContainText(currency(117000));
    await expect(drawer.locator('.transaction-inspection-row')).toHaveCount(1);
    await expect(drawer.locator('.day-drawer-summary')).toContainText(/định kỳ/i);
    await drawer.getByRole('button', { name: 'Xem đầy đủ trong lịch sử' }).click();
    await page.waitForURL(/transactions\?date=2026-10-05.*excludeRecurring=1/);
    await expect(page.locator('.transaction-inspection-row')).toHaveCount(1);
    await enter();
  });

  await check('remembered choices, pinned default, unpin and month drill-down preserve deliberate preferences', async () => {
    await selectMode('3months'); await selectSeries('expense'); await includeRecurring(false);
    await expect.poll(async () => (await preferences()).cashFlow?.lastUsed)
      .toEqual({ mode: '3months', series: 'expense', excludeRecurring: true });
    await page.reload(); await expect(chart).toHaveAttribute('data-mode', '3months');
    await display.click(); await page.getByTestId('cashflow-pin-default').click(); await closePopover();
    await expect.poll(async () => (await preferences()).cashFlow?.pinnedDefault)
      .toEqual({ mode: '3months', series: 'expense', excludeRecurring: true });
    await selectMode('6months'); await selectSeries('both'); await includeRecurring(true);
    await page.reload();
    await expect(chart).toHaveAttribute('data-mode', '3months');
    await expect(chart).toHaveAttribute('data-series', 'expense');
    await display.click(); await page.getByTestId('cashflow-clear-default').click(); await closePopover();
    await expect.poll(async () => (await preferences()).cashFlow?.pinnedDefault).toBe(null);
    await selectMode('6months'); await selectSeries('both');
    await expect.poll(async () => (await preferences()).cashFlow?.lastUsed?.mode).toBe('6months');
    await page.reload(); await expect(chart).toHaveAttribute('data-mode', '6months');
    const before = (await preferences()).cashFlow.lastUsed;
    // Click the visible September income column in the six-month chart.
    await drillSeptember();
    assert.deepEqual((await preferences()).cashFlow.lastUsed, before, 'Inspecting a month does not rewrite the remembered mode');
    await page.getByTestId('cashflow-back-period').click();
    await expect(chart).toHaveAttribute('data-mode', '6months');
  });

  await check('failed period choices and pinning from a drilled month preserve the remembered view and back context', async () => {
    const remembered = (await preferences()).cashFlow.lastUsed;
    await drillSeptember();
    const periodFailure = await failNextPreferences();
    await period.click();
    await popover.locator('input[type=radio][value="3months"]').locator('..').click();
    await periodFailure.response; await closePopover();
    await expect(chart).toHaveAttribute('data-mode', 'daily');
    await expect(page.getByTestId('cashflow-back-period')).toBeVisible();
    assert.deepEqual((await preferences()).cashFlow.lastUsed, remembered);
    await page.getByTestId('cashflow-back-period').click();
    await expect(chart).toHaveAttribute('data-mode', '6months');
    await expect(period).toContainText(/10/);

    await drillSeptember(); await display.click();
    const pinnedBefore = (await preferences()).cashFlow.pinnedDefault;
    const pinFailure = await failNextPreferences();
    await page.getByTestId('cashflow-pin-default').click();
    await pinFailure.response;
    await expect(page.getByTestId('cashflow-pin-default')).toBeEnabled();
    assert.deepEqual((await preferences()).cashFlow.pinnedDefault, pinnedBefore);
    assert.deepEqual((await preferences()).cashFlow.lastUsed, remembered);
    await expect(chart).toHaveAttribute('data-mode', 'daily');
    await expect(page.getByTestId('cashflow-back-period')).toBeVisible();

    await page.getByTestId('cashflow-pin-default').click();
    await expect.poll(async () => (await preferences()).cashFlow.pinnedDefault)
      .toEqual({ ...remembered, mode: 'daily' });
    assert.deepEqual((await preferences()).cashFlow.lastUsed, remembered);
    await closePopover();
    await expect(page.getByTestId('cashflow-back-period')).toBeVisible();
    await page.getByTestId('cashflow-back-period').click();
    await expect(chart).toHaveAttribute('data-mode', '6months');
    await expect(period).toContainText(/10/);
    await display.click(); await page.getByTestId('cashflow-clear-default').click(); await closePopover();
    await expect.poll(async () => (await preferences()).cashFlow.pinnedDefault).toBe(null);
  });

  await check('mobile seven-day chart keeps its ranking explicitly scoped to the whole selected month', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter();
    await selectSeries('expense'); await selectMode('daily', '2026-10');
    await panel.getByRole('button', { name: 'Khoảng ngày sau' }).click();
    await expect(panel.locator('.cashflow-chart--empty')).toHaveText('Ngày chưa tới');
    await panel.getByRole('button', { name: 'Khoảng ngày trước' }).click();
    await expect(chart).toBeVisible();
    await selectMode('daily', '2026-09');
    assert.ok((await labels()).length <= 7);
    await expect(page.getByTestId('cashflow-top-days')).toContainText(/tháng/i);
    await expect(page.getByTestId('cashflow-top-day').first()).toHaveAttribute('data-date', '2026-09-21');
    await page.getByTestId('cashflow-top-day').first().click();
    await expect(drawer.locator('.day-drawer-summary strong')).toContainText(currency(480000));
    await drawer.getByRole('button', { name: 'Đóng', exact: true }).click();
    await selectMode('daily', '2026-10');
  });

  await check('four themes and six content widths fit the panel, menus and touch targets', async () => {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const layouts = [];
    for (const theme of ['light', 'dark', 'cream', 'green']) {
      await page.evaluate(value => localStorage.setItem('caltdhy_theme', value), theme);
      for (const width of [320, 390, 768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
        await enter();
        await expect(page.locator('html')).toHaveClass(new RegExp(`${theme}-theme`));
        await verifyFit(panel, `${theme}/${width} panel`);
        await verifyTextContrast(panel, '.cashflow-header h3, .cashflow-control > span, .cashflow-summary dt, .cashflow-summary dd, .cashflow-day-date, .cashflow-top-days li strong', `${theme}/${width} panel`);
        const chartBox = await chart.boundingBox();
        const topBox = await page.getByTestId('cashflow-top-days').boundingBox();
        layouts.push({ theme, width, chartBox, topBox });
        await panelScreenshot(`${width}-${theme}-cash-flow.png`);
        for (const trigger of [period, display, page.getByTestId('cashflow-date-trigger')]) {
          await trigger.click(); await expect(popover).toBeVisible();
          const layout = await verifyFit(popover, `${theme}/${width} menu`);
          await verifyTextContrast(popover, 'h4, label strong, label small, p', `${theme}/${width} menu`);
          assert.ok(layout.top >= -1 && layout.bottom <= layout.viewportHeight + 1,
            `${theme}/${width}: menu remains inside the viewport`);
          await page.screenshot({ path: path.join(evidenceDir, `${width}-${theme}-${await popover.getAttribute('data-popover')}.png`), animations: 'disabled' });
          await page.keyboard.press('Escape'); await expect(popover).toHaveCount(0);
          await expect(trigger).toBeFocused();
          if (width <= 768) {
            const triggerBox = await trigger.boundingBox();
            assert.ok(triggerBox.height >= 44 && triggerBox.width >= 44, `${theme}/${width}: accessible touch target`);
          }
        }
      }
    }
    const narrow = layouts.find(item => item.theme === 'light' && item.width === 1024);
    const wide = layouts.find(item => item.theme === 'light' && item.width === 1440);
    assert.ok(narrow.topBox.y >= narrow.chartBox.y + narrow.chartBox.height - 1, 'Narrow content stacks ranking below chart');
    assert.ok(wide.topBox.x > wide.chartBox.x + wide.chartBox.width - 1, 'Wide content places ranking beside chart');
    fs.writeFileSync(path.join(evidenceDir, 'layout-results.json'), JSON.stringify(layouts, null, 2));
  });
  assert.deepEqual(errors, [], 'No unhandled browser errors');
  console.log(`PASS ${passed} cash-flow browser scenarios; screenshots: ${evidenceDir}`);
  await context.close();
})().catch(async error => {
  console.error(error); process.exitCode = 1;
  if (auditPage && !auditPage.isClosed()) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    await auditPage.screenshot({ path: path.join(evidenceDir, 'failure.png'), animations: 'disabled' });
    fs.writeFileSync(path.join(evidenceDir, 'failure.txt'), await auditPage.locator('body').innerText());
    console.error('Failure evidence: ' + path.join(evidenceDir, 'failure.png'));
  }
}).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await mongoose.disconnect();
  if (db) await db.stop();
});

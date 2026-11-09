'use strict';

// Month switching on the budget page, measured frame by frame on desktop and on a
// touch phone, with a fast and a slow (400ms) budget API: a month's spending is
// never shown against another month's limits, no skeleton or dimming flashes,
// the summary card and the table never move, and revisits come from the cache.
// Also covers arrow keys, swipe, reduced motion, the previous-month line and
// cache invalidation after editing limits.
// Run after building the frontend: node tests/budget-month-browser.cjs
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
const evidenceDir = process.env.BUDGET_QA_DIR || path.join(os.tmpdir(), 'caltdhy-budget-month-evidence');
async function check(name, work) {
  await work();
  passed += 1;
  console.log('PASS ' + name);
}
const shiftMonth = (month, delta) => {
  const [year, value] = month.split('-').map(Number);
  const total = year * 12 + value - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};
const digits = (text) => String(text || '').replace(/\D/g, '');

(async () => {
  fs.mkdirSync(evidenceDir, { recursive: true });
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
  await mongoose.connect(db.getUri('caltdhy_budget_month_test'));
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
  const contextOptions = { baseURL, locale: 'vi-VN', serviceWorkers: 'block', timezoneId: 'Asia/Ho_Chi_Minh' };
  const context = await browser.newContext({ ...contextOptions, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const email = 'budget-' + crypto.randomUUID() + '@example.test';
  await page.goto('/signup');
  await page.locator('#fullName').fill('Budget Month User');
  await page.locator('#emailIn').fill(email);
  await page.locator('#pwIn').fill('Browser-test-1234');
  await page.locator('#signupForm button[type=submit]').click();
  await page.waitForURL('**/spending/home');

  // Months follow the real Vietnam date, as the server does.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  const current = today.slice(0, 7);
  const previous = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const user = await backend('./models/User').findOne({ email });
  const primary = await backend('./models/Wallet').findOneAndUpdate({ userId: user._id, isDefault: true },
    { name: 'Ví chính', initialBalance: 5000000 }, { new: true });
  // A closed month cannot be edited through the API; seed both months directly.
  await backend('./models/Budget').insertMany([
    { userId: user._id, category: 'Ăn uống', month: previous, limit: 100000 },
    { userId: user._id, category: 'Ăn uống', month: current, limit: 500000 }
  ]);
  const { csrfToken } = await (await context.request.get('/api/auth/csrf')).json();
  for (const [date, amount] of [[`${previous}-15`, 80000], [`${current}-01`, 300000]]) {
    const response = await context.request.post('/api/spending', {
      headers: { 'X-CSRF-Token': csrfToken, 'Idempotency-Key': crypto.randomUUID() },
      data: { type: 'expense', amount, category: 'Ăn uống', date, walletId: primary.id, desc: 'Bữa ăn' }
    });
    assert.ok(response.ok(), await response.text());
  }
  // Spent|limit pairs that may ever appear together in the summary card.
  const expected = { [previous]: '80000|100000', [current]: '300000|500000', [next]: '0|500000' };
  const allowedPairs = new Set(Object.values(expected));
  const monthLabel = (month) => new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: 'long' })
    .format(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1));

  async function record(target, action) {
    await target.evaluate(() => {
      window.__frames = [];
      window.__shift = 0;
      window.__observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__shift += entry.value; });
      window.__observer.observe({ type: 'layout-shift' });
      const tick = () => {
        const q = selector => document.querySelector(selector);
        const hero = q('.bdash-hero'), card = q('.bdash-card');
        window.__frames.push({
          label: q('.month-name-text')?.textContent,
          skeleton: Boolean(q('.is-skeleton')),
          loading: Boolean(q('.month-icon.is-loading')),
          pair: `${(q('.bdash-hero__meter-labels b')?.textContent || '').replace(/\D/g, '')}|${(q('.bdash-hero__limit-value')?.textContent || '').replace(/\D/g, '')}`,
          hero: Math.round(hero?.getBoundingClientRect().height || 0),
          table: Math.round(card?.getBoundingClientRect().top || 0)
        });
        if (window.__recording) requestAnimationFrame(tick);
      };
      window.__recording = true;
      requestAnimationFrame(tick);
    });
    await action();
    await target.waitForTimeout(1100);
    return target.evaluate(() => {
      window.__recording = false;
      window.__observer.disconnect();
      return { frames: window.__frames, shift: window.__shift };
    });
  }
  function assertSmooth(result, landedOn, name, { coldSwitch = false } = {}) {
    const { frames, shift } = result;
    assert.ok(frames.length > 10, `${name}: frames were recorded`);
    for (const frame of frames) {
      assert.equal(frame.skeleton, false, `${name}: no skeleton flash`);
      assert.ok(allowedPairs.has(frame.pair), `${name}: spending and limits from one month (${frame.pair})`);
    }
    assert.equal(new Set(frames.map(frame => frame.hero)).size, 1, `${name}: summary height is fixed ${[...new Set(frames.map(f => f.hero))]}`);
    assert.equal(new Set(frames.map(frame => frame.table)).size, 1, `${name}: table does not move ${[...new Set(frames.map(f => f.table))]}`);
    assert.ok(shift < 0.02, `${name}: layout shift ${shift.toFixed(3)}`);
    const last = frames.at(-1);
    assert.equal(last.label, monthLabel(landedOn), `${name}: lands on the chosen month`);
    assert.equal(last.pair, expected[landedOn], `${name}: shows that month's numbers`);
    if (!coldSwitch) assert.equal(frames.some(frame => frame.loading), false, `${name}: cached month needs no spinner`);
    return frames;
  }

  async function switchingScenario(target, device, tap) {
    const budgetRequests = [];
    target.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/spending/budget') budgetRequests.push(url.searchParams.get('month'));
    });
    await target.route('**/api/spending/budget**', async route => {
      await new Promise(resolve => setTimeout(resolve, 400));
      await route.continue();
    });
    try {
      await target.goto('/spending/plan/budgets');
      await expect(target.locator('.bdash-hero:not(.is-skeleton)')).toBeVisible();
      const press = name => tap ? target.getByRole('button', { name, exact: true }).tap()
        : target.getByRole('button', { name, exact: true }).click();
      // Cold: the previous month is still loading, so the current month must stay whole.
      const cold = assertSmooth(await record(target, () => press('Xem tháng trước')), previous, `${device} cold`, { coldSwitch: true });
      assert.ok(cold.some(frame => frame.label === monthLabel(previous) && frame.pair === expected[current]),
        `${device}: while loading, the label moves on and the old month stays whole`);
      assert.ok(cold.some(frame => frame.loading), `${device}: a slow month shows the switcher spinner`);
      await target.screenshot({ path: path.join(evidenceDir, `${device}-previous.png`) });
      assertSmooth(await record(target, () => press('Xem tháng sau')), current, `${device} back (cached)`);
      await target.waitForTimeout(700); // neighbours are prefetched once a month settles
      assertSmooth(await record(target, () => press('Xem tháng sau')), next, `${device} next (prefetched)`);
      await target.screenshot({ path: path.join(evidenceDir, `${device}-next.png`) });
      assertSmooth(await record(target, () => press('Xem tháng trước')), current, `${device} current again`);
      assertSmooth(await record(target, () => press('Xem tháng trước')), previous, `${device} previous again`);
      assert.equal(budgetRequests.filter(month => month === previous).length, 1, `${device}: a revisit within a minute uses the cache`);
    } finally { await target.unrouteAll({ behavior: 'ignoreErrors' }); }
  }

  await check('desktop month switching keeps one month whole, a fixed layout and no flashes', async () => {
    await switchingScenario(page, 'desktop', false);
  });

  const phone = await browser.newContext({ ...contextOptions, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    storageState: await context.storageState() });
  const phonePage = await phone.newPage();
  phonePage.on('pageerror', error => errors.push(error.message));

  await check('touch phone month switching keeps one month whole, a fixed layout and no flashes', async () => {
    await switchingScenario(phonePage, 'phone', true);
    // "This month" sits inside the switcher row rather than adding a row.
    await expect(phonePage.locator('.month-today-btn')).toBeVisible();
    const switcher = await phonePage.locator('.budget-month-selector').boundingBox();
    assert.ok(switcher.height < 60, `switcher stays one row: ${switcher.height}px`);
  });

  await check('phones change month with a horizontal swipe, but not from the edge or while scrolling', async () => {
    const cdp = await phone.newCDPSession(phonePage);
    const swipe = async (x1, y1, x2, y2) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
      for (let step = 1; step <= 6; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove',
          touchPoints: [{ x: x1 + ((x2 - x1) * step) / 6, y: y1 + ((y2 - y1) * step) / 6 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const label = phonePage.locator('.month-name-text');
    await phonePage.getByRole('button', { name: 'Về tháng này', exact: true }).tap();
    await expect(label).toHaveText(monthLabel(current));
    const hero = await phonePage.locator('.bdash-hero').boundingBox();
    const y = hero.y + hero.height / 2;
    await swipe(300, y, 120, y);
    await expect(label).toHaveText(monthLabel(next));
    await swipe(100, y, 300, y);
    await expect(label).toHaveText(monthLabel(current));
    await swipe(8, y, 220, y); // starts on the edge: left to the system back gesture
    await phonePage.waitForTimeout(250);
    await expect(label).toHaveText(monthLabel(current));
    await swipe(200, y, 260, y - 220); // mostly vertical: a scroll, not a swipe
    await phonePage.waitForTimeout(250);
    await expect(label).toHaveText(monthLabel(current));
  });
  await phone.close();

  await check('desktop arrow keys change month from the switcher, with a short directional transition', async () => {
    await page.goto('/spending/plan/budgets');
    const label = page.locator('.month-name-text');
    await expect(label).toHaveText(monthLabel(current));
    await page.locator('.month-nav-btn--next').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(label).toHaveText(monthLabel(previous));
    const animated = await page.evaluate(() => document.querySelector('.budget-month-data').getAnimations()
      .some(animation => animation.effect?.getKeyframes().some(frame => String(frame.transform).includes('translateX'))));
    assert.equal(animated, true, 'switching months plays the short transition');
    await page.keyboard.press('ArrowRight');
    await expect(label).toHaveText(monthLabel(current));
    await page.waitForTimeout(300); // let the 160ms transition of that switch finish
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('ArrowLeft');
    await expect(label).toHaveText(monthLabel(previous));
    assert.equal(await page.evaluate(() => document.querySelector('.budget-month-data').getAnimations().length), 0,
      'reduced motion switches without animation');
    await page.emulateMedia({ reducedMotion: null });
  });

  await check('a closed month reads as a result, and every month says how the one before ended', async () => {
    const card = page.locator('.bdash-card');
    await expect(page.locator('.bdash-closed')).toContainText('Đã đóng kỳ');
    await expect(card.locator('.bdash-row--head')).toContainText('Kết quả');
    await expect(card.locator('.bdash-row').filter({ hasText: 'Ăn uống' }).last()).toContainText(/Dư 20\.000\s*₫/);
    await expect(page.locator('button.bdash-row')).toHaveCount(0);
    await expect(page.locator('.bdash-chip')).toContainText('Dư 20%');
    await expect(page.locator('.bdash-hero__previous-text')).toContainText('chưa đặt hạn mức');
    await page.getByRole('button', { name: 'Về tháng này', exact: true }).click();
    await expect(page.locator('.bdash-hero__previous-text')).toContainText(`${monthLabel(previous).replace(/^./, c => c.toUpperCase())} còn dư 20.000`);
    await page.locator('.bdash-hero__previous-link').click();
    await expect(page.locator('.month-name-text')).toHaveText(monthLabel(previous));
  });

  await check('saving a limit refreshes later months that inherit it instead of showing a stale cache', async () => {
    await page.getByRole('button', { name: 'Về tháng này', exact: true }).click();
    await page.getByRole('button', { name: 'Xem tháng sau', exact: true }).click();
    await expect(page.locator('.bdash-hero__limit-value')).toContainText('500.000');
    await page.getByRole('button', { name: 'Về tháng này', exact: true }).click();
    await page.getByRole('button', { name: 'Sửa hạn mức', exact: true }).click();
    const limitInput = page.getByRole('textbox', { name: 'Hạn mức cho Ăn uống', exact: true });
    await limitInput.fill('600000');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.locator('.blimit-dialog')).toHaveCount(0);
    await expect(page.locator('.bdash-hero__limit-value')).toContainText('600.000');
    await page.getByRole('button', { name: 'Xem tháng sau', exact: true }).click();
    await expect(page.locator('.bdash-hero__limit-value')).toContainText('600.000');
  });

  assert.deepEqual(errors, []);
  console.log(`PASS ${passed} budget month scenarios; screenshots: ${evidenceDir}`);
  await context.close();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  await mongoose.disconnect();
  if (db) await db.stop();
});

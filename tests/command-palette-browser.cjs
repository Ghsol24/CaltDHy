'use strict';
// Command palette (Ctrl/Cmd + K, NAV-12) against the built app and the fixture API.
//   npm run build --prefix frontEnd-react && node tests/command-palette-browser.cjs
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { startUiFixtureServer } = require('./ui-fixture-server.cjs');

const FIXTURE_NOW = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 27, 10, 0, 0); })();
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

async function newPage(browser, server, { theme = 'light', width = 1440, lang = 'vi' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600,
    serviceWorkers: 'block', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce', acceptDownloads: true
  });
  await context.clock.setFixedTime(FIXTURE_NOW);
  await context.addInitScript(([themeValue, langValue]) => {
    localStorage.setItem('caltdhy_theme', themeValue);
    localStorage.setItem('caltdhy_lang', langValue);
  }, [theme, lang]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const open = async (route) => {
    await page.goto(server.url + route, { waitUntil: 'networkidle' });
    await page.locator('#main-content').waitFor();
  };
  return { context, page, errors, open };
}

const palette = (page) => page.getByRole('dialog', { name: 'Bảng lệnh' });
async function openPalette(page) {
  await page.keyboard.press(`${MOD}+k`);
  await expect(palette(page)).toBeVisible();
  return page.getByRole('combobox', { name: 'Bảng lệnh' });
}
const activeOption = (page) => page.locator('[role="option"][aria-selected="true"]');

const checks = [];
const check = (name, run) => checks.push({ name, run });

check('Ctrl/Cmd+K opens a combobox over grouped commands; arrows, Enter and Esc work', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server);
  await open('/spending/home');
  const input = await openPalette(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  const listbox = page.getByRole('listbox');
  for (const group of ['Ghi chép', 'Đi tới', 'Khác']) await expect(listbox.getByRole('group', { name: group })).toBeVisible();
  await expect(listbox.getByRole('group', { name: 'Đi tới' }).getByRole('option')).toHaveCount(13);
  // The first row is active and named by aria-activedescendant; arrows move and wrap.
  const first = await activeOption(page).getAttribute('id');
  assert.equal(await input.getAttribute('aria-activedescendant'), first);
  await page.keyboard.press('ArrowDown');
  await expect(activeOption(page)).toContainText('Thêm khoản thu');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(activeOption(page)).toContainText('Mở hướng dẫn');
  // Typing a page name puts that page first.
  await input.fill('ngân sách');
  await expect(activeOption(page)).toContainText('Ngân sách');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/spending/plan/budgets');
  await expect(palette(page)).toHaveCount(0);
  // Esc closes and gives focus back; a second Ctrl/Cmd+K toggles it closed too.
  await openPalette(page);
  await page.keyboard.press('Escape');
  await expect(palette(page)).toHaveCount(0);
  await openPalette(page);
  await page.keyboard.press(`${MOD}+k`);
  await expect(palette(page)).toHaveCount(0);
  assert.deepEqual(errors, []);
  await context.close();
});

check('"chi 50k cà phê" records an expense with the amount and note filled in', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server);
  await open('/spending/analytics/overview');
  const input = await openPalette(page);
  await input.fill('chi 50k cà phê');
  await expect(activeOption(page)).toContainText('Thêm khoản chi "cà phê"');
  await expect(activeOption(page)).toContainText('50.000');
  await expect(page.getByRole('group', { name: 'Tìm' })).toContainText('Giao dịch có "cà phê"');
  await page.keyboard.press('Enter');
  const dialog = page.locator('.txn-dialog, [role="dialog"]').filter({ has: page.locator('input[inputmode="decimal"], input[inputmode="numeric"]') }).first();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[inputmode="decimal"], input[inputmode="numeric"]').first()).toHaveValue('50.000');
  await expect(dialog.locator('input[value="cà phê"], textarea').first()).toHaveValue('cà phê');
  await expect(palette(page)).toHaveCount(0);
  assert.deepEqual(errors, []);
  await context.close();
});

check('N adds a transaction, but not while typing in a field', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server);
  await open('/spending/analytics/transactions');
  const search = page.locator('.transaction-history-search input');
  await search.click();
  await page.keyboard.press('n');
  await expect(search).toHaveValue('n');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
  await page.locator('#transaction-history-title').click();
  await page.keyboard.press('n');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  // Ctrl/Cmd+K does nothing over another dialog.
  await page.keyboard.press(`${MOD}+k`);
  await expect(palette(page)).toHaveCount(0);
  assert.deepEqual(errors, []);
  await context.close();
});

check('Search opens Lịch sử with the words, or with a category filter', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server);
  await open('/spending/home');
  let input = await openPalette(page);
  await input.fill('cơm');
  await expect(activeOption(page)).toContainText('Giao dịch có "cơm"');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/spending/analytics/transactions');
  await expect(page.locator('.transaction-history-search input')).toHaveValue('cơm');
  // Already on Lịch sử: a category search replaces the text search.
  input = await openPalette(page);
  await input.fill('coffee');
  const option = page.getByRole('option', { name: /danh mục/ }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('.transaction-history-search input')).toHaveValue('');
  await expect(page.locator('.txn-item').first()).toBeVisible();
  const rows = await page.locator('.txn-item').count();
  assert.equal(rows, 3, 'three Coffee transactions in the fixture');
  assert.deepEqual(errors, []);
  await context.close();
});

check('Commands open the transfer form, a jar deposit, the CSV export and switch theme', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server);
  await open('/spending/home');
  let input = await openPalette(page);
  await input.fill('chuyển tiền');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/spending/plan/wallets');
  await expect(page.locator('[aria-modal="true"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);

  input = await openPalette(page);
  await input.fill('nạp sức');
  await expect(activeOption(page)).toContainText('Nạp tiền vào hũ Sức khoẻ');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/spending/jars/list');
  await expect(page.locator('.jar-transaction-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.jar-transaction-dialog')).toHaveCount(0);

  input = await openPalette(page);
  await input.fill('xuất csv');
  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  assert.match((await download).suggestedFilename(), /\.csv$/);
  await page.waitForURL('**/spending/analytics/reports');

  // Kỳ: on Phân tích the palette moves the shared month.
  input = await openPalette(page);
  await input.fill('tháng trước');
  await page.keyboard.press('Enter');
  const expected = new RegExp(`tháng ${((FIXTURE_NOW.getMonth() + 11) % 12) + 1}\\b`, 'i');
  await expect(page.locator('.analytics-month-trigger').first()).toHaveText(expected);

  input = await openPalette(page);
  await input.fill('đổi theme');
  await expect(page.getByRole('group', { name: 'Khác' }).getByRole('option')).toHaveCount(4);
  await expect(activeOption(page)).toContainText('Theme');
  await page.getByRole('option', { name: /Tối/ }).click();
  await expect(page.locator('html')).toHaveClass(/dark-theme/);
  assert.deepEqual(errors, []);
  await context.close();
});

check('Phones and tablets below the sidebar breakpoint get no palette', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { width: 390 });
  await open('/spending/home');
  await page.keyboard.press(`${MOD}+k`);
  await page.keyboard.press('n');
  await page.waitForTimeout(300);
  await expect(palette(page)).toHaveCount(0);
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
  assert.deepEqual(errors, []);
  await context.close();
});

check('Labels follow the language', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { lang: 'en' });
  await open('/spending/home');
  await page.keyboard.press(`${MOD}+k`);
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Record' })).toContainText('Add an expense');
  await expect(dialog.getByRole('group', { name: 'Go to' })).toContainText('Budgets');
  assert.deepEqual(errors, []);
  await context.close();
});

module.exports = { check, checks, newPage };

if (require.main === module) {
  (async () => {
    const server = await startUiFixtureServer({ now: FIXTURE_NOW, distDir: process.env.DIST || undefined });
    const browser = await chromium.launch();
    let failed = 0;
    try {
      for (const { name, run } of checks) {
        try { await run({ browser, server }); console.log(`ok - ${name}`); }
        catch (error) { failed += 1; console.error(`not ok - ${name}\n${error.stack || error}`); }
      }
    } finally {
      await browser.close();
      await server.close();
    }
    if (failed) { console.error(`${failed} check(s) failed`); process.exitCode = 1; }
    else console.log(`PASS ${checks.length} command palette checks.`);
  })();
}

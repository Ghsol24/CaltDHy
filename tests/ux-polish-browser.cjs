'use strict';
// Behaviour checks for the UX polish pass, run against the built app with the
// in-memory fixture API (no MongoDB needed).
//   npm run build --prefix frontEnd-react && node tests/ux-polish-browser.cjs
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { startUiFixtureServer } = require('./ui-fixture-server.cjs');

async function newPage(browser, server, { theme = 'green', width = 1440 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 }, isMobile: width < 600, hasTouch: width < 600,
    serviceWorkers: 'block', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce'
  });
  await context.addInitScript((value) => {
    localStorage.setItem('caltdhy_theme', value);
    localStorage.setItem('caltdhy_lang', 'vi');
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors, open: (route) => page.goto(server.url + route, { waitUntil: 'networkidle' }) };
}

const checks = [];
const check = (name, run) => checks.push({ name, run });

check('jar deposit dialog uses the themed wallet dropdown', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server);
  await open('/spending/jars/list');
  await page.locator('button', { hasText: 'Nạp tiền' }).first().click();
  const dialog = page.locator('.jar-transaction-dialog');
  await expect(dialog).toBeVisible();
  assert.equal(await dialog.locator('select').count(), 0, 'no native <select> should remain in the dialog');
  const trigger = dialog.locator('.jar-transfer-wallet-box .custom-wallet-trigger');
  await expect(trigger).toContainText('ZaloPay');
  await expect(trigger).toContainText('Mặc định');
  // Moving from the empty amount field to the wallet picker must not show an amount error.
  await dialog.locator('input[inputmode="numeric"]').focus();
  await trigger.click();
  await expect(dialog.locator('.custom-wallet-menu')).toBeVisible();
  assert.equal(await dialog.locator('.jar-transfer-error').count(), 0, 'no error before the person types or confirms');
  await dialog.locator('.custom-wallet-item', { hasText: 'MBbank' }).click();
  await expect(trigger).toContainText('MBbank');
  await expect(dialog.locator('.custom-wallet-menu')).toHaveCount(0);
  // Keyboard: open with ArrowDown, move, choose with Enter.
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(dialog.locator('.custom-wallet-menu')).toBeVisible();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('ZaloPay');
  // Typing an amount enables the confirm button and updates its label.
  await dialog.locator('input[inputmode="numeric"]').fill('250000');
  await expect(dialog.locator('.jar-transfer-submit')).toBeEnabled();
  await expect(dialog.locator('.jar-transfer-submit')).toContainText('250.000');
  assert.deepEqual(errors, []);
  await context.close();
});

check('jar goal date uses the themed date picker (typing, calendar, keyboard, clear)', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'cream' });
  await open('/spending/jars/list');
  await page.getByRole('button', { name: /Tạo hũ mới/ }).first().click();
  const dialog = page.locator('.jar-management-dialog');
  await expect(dialog).toBeVisible();
  assert.equal(await dialog.locator('input[type="date"]').count(), 0, 'the native date input is gone');
  const input = dialog.locator('.calt-date-input');
  await input.fill('15/12/2026');
  await input.press('Tab');
  await expect(input).toHaveValue('15/12/2026');
  await input.fill('31/02/2026');
  await input.press('Tab');
  await expect(input).toHaveValue('15/12/2026'); // impossible dates fall back to the last valid one
  await dialog.locator('.calt-date-toggle').click();
  const popover = dialog.locator('.calt-date-popover');
  await expect(popover).toBeVisible();
  await expect(popover.locator('.calt-date-title')).toHaveText(/12.*2026/);
  await expect(popover.locator('[aria-selected="true"]')).toHaveText('15');
  await expect(popover.locator('[data-iso="2026-12-15"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(popover.locator('[data-iso="2026-12-16"]')).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(popover.locator('[data-iso="2027-01-16"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(popover).toHaveCount(0);
  await expect(input).toHaveValue('16/01/2027');
  await expect(input).toBeFocused();
  // Escape closes only the calendar, not the dialog.
  await input.click();
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(dialog).toBeVisible();
  // Clear from the calendar footer.
  await dialog.locator('.calt-date-toggle').click();
  await popover.getByRole('button', { name: 'Xoá' }).click();
  await expect(input).toHaveValue('');
  // Popover colours follow the cream theme tokens.
  await dialog.locator('.calt-date-toggle').click();
  const colours = await popover.evaluate((node) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--menu-bg)';
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { actual: getComputedStyle(node).backgroundColor, expected };
  });
  assert.equal(colours.actual, colours.expected, 'calendar uses the theme menu background');
  assert.deepEqual(errors, []);
  await context.close();
});

check('history custom date range uses linked themed pickers', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'dark' });
  await open('/spending/analytics/transactions');
  const period = page.locator('.transaction-filter-dropdown').nth(3);
  await period.locator('.transaction-filter-trigger').click();
  await period.getByRole('option', { name: 'Tùy chọn ngày' }).click();
  const range = page.locator('.transaction-filter-custom-dates');
  await expect(range.locator('.calt-date-input')).toHaveCount(2);
  assert.equal(await range.locator('input[type="date"]').count(), 0);
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const shown = (day) => `${String(day).padStart(2, '0')}/${ym.slice(5)}/${ym.slice(0, 4)}`;
  await page.getByLabel('Từ ngày').fill(shown(10));
  await page.getByLabel('Từ ngày').press('Tab');
  await range.locator('.calt-date-picker').nth(1).locator('.calt-date-toggle').click();
  const popover = range.locator('.calt-date-popover');
  await expect(popover).toBeVisible();
  // Days before the start date cannot be picked as the end date.
  await expect(popover.locator(`[data-iso="${ym}-09"]`)).toBeDisabled();
  await expect(popover.locator(`[data-iso="${ym}-11"]`)).toBeEnabled();
  await popover.locator(`[data-iso="${ym}-11"]`).click();
  await expect(page.getByLabel('Đến ngày')).toHaveValue(shown(11));
  assert.deepEqual(errors, []);
  await context.close();
});

async function pick(page, index, option) {
  const dropdown = page.locator('.transaction-filter-dropdown').nth(index);
  await dropdown.locator('.transaction-filter-trigger').click();
  await dropdown.getByRole('option', { name: option, exact: true }).click();
  return dropdown;
}

check('history shows each active filter as a removable chip', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'green' });
  await open('/spending/analytics/transactions');
  const chips = page.locator('.transaction-active-filters .transaction-filter-chip');
  await expect(chips).toHaveCount(0);
  const summary = page.locator('.transaction-history-summary strong');
  const total = Number((await summary.textContent()).match(/\d+/)[0]);
  const typeDropdown = await pick(page, 0, 'Chi tiêu');
  await pick(page, 2, 'ZaloPay');
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).toHaveText('Loại: Chi tiêu');
  await expect(chips.nth(1)).toHaveText('Ví: ZaloPay');
  await expect(typeDropdown).toHaveClass(/is-filtering/);
  await expect(summary).toHaveText(new RegExp(`^\\d+ / ${total} mục$`));
  // Wide screens already have "Xóa bộ lọc" in the bar, so the chip row does not repeat it.
  await expect(page.getByRole('button', { name: 'Xóa tất cả' })).toHaveCount(0);
  // Removing one chip keeps the other filter and moves focus to the remaining chip.
  await page.getByRole('button', { name: 'Bỏ bộ lọc Loại: Chi tiêu' }).click();
  await expect(chips).toHaveCount(1);
  await expect(chips.first()).toHaveText('Ví: ZaloPay');
  await expect(chips.first()).toBeFocused();
  await expect(typeDropdown).not.toHaveClass(/is-filtering/);
  await page.getByPlaceholder('Tìm mô tả hoặc danh mục').fill('cơm');
  await expect(chips).toHaveCount(2);
  await expect(chips.first()).toHaveText('Tìm: “cơm”');
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(chips).toHaveCount(0);
  await expect(page.getByPlaceholder('Tìm mô tả hoặc danh mục')).toHaveValue('');
  await expect(summary).toHaveText(`${total} mục`);
  // A custom range is summarised in one chip.
  await pick(page, 3, 'Tùy chọn ngày');
  await expect(chips).toHaveCount(0);
  await page.getByLabel('Từ ngày').fill('01/10/2026');
  await page.getByLabel('Từ ngày').press('Tab');
  await expect(chips.first()).toHaveText('Thời gian: Từ 01/10/2026');
  await page.getByLabel('Đến ngày').fill('15/10/2026');
  await page.getByLabel('Đến ngày').press('Tab');
  await expect(chips.first()).toHaveText('Thời gian: 01/10/2026 – 15/10/2026');
  assert.deepEqual(errors, []);
  await context.close();
});

check('on phones the filters fold behind a "Bộ lọc" toggle while chips stay visible', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'light', width: 390 });
  await open('/spending/analytics/transactions');
  const toggle = page.locator('.transaction-filter-toggle');
  const controls = page.locator('.transaction-filter-controls');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(controls).toBeHidden();
  await toggle.click();
  await expect(controls).toBeVisible();
  await pick(page, 3, 'Tháng này');
  await page.getByRole('checkbox', { name: 'Ẩn khoản định kỳ' }).check();
  await toggle.click();
  await expect(controls).toBeHidden();
  await expect(toggle.locator('.transaction-filter-count')).toHaveText('2');
  await expect(page.locator('.transaction-filter-chip', { hasText: 'Thời gian: Tháng này' })).toBeVisible();
  await expect(page.locator('.transaction-filter-chip', { hasText: 'Ẩn khoản định kỳ' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa tất cả' }).click();
  await expect(page.locator('.transaction-filter-chip')).toHaveCount(0);
  await expect(toggle.locator('.transaction-filter-count')).toHaveCount(0);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflows, false, 'no sideways scrolling on a phone');
  assert.deepEqual(errors, []);
  await context.close();
});

check('"Cần chú ý" turns into a red warning when something is overdue or over budget', async ({ browser, server }) => {
  for (const theme of ['green', 'dark']) {
    const { context, page, errors, open } = await newPage(browser, server, { theme });
    await open('/spending/plan/overview');
    const card = page.locator('.plan-top-alerts-card');
    await expect(card).toHaveClass(/is-critical/);
    await expect(card.locator('.top-alerts-count')).toHaveText('6');
    const look = await card.evaluate((node) => ({
      background: getComputedStyle(node).backgroundImage,
      bell: getComputedStyle(node.querySelector('.top-alerts-bell-box')).backgroundColor
    }));
    assert.match(look.background, /linear-gradient/, `${theme}: the card has a red gradient`);
    const [r, g, b] = look.bell.match(/\d+/g).map(Number);
    assert.ok(r > 180 && g < 90 && b < 110, `${theme}: the bell is solid red (${look.bell})`);
    // Most urgent items come first.
    await expect(card.locator('.top-alert-pill-item').first()).toHaveClass(/plan-alert--(danger|today)/);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

module.exports = { check, checks, newPage };

if (require.main === module) {
  (async () => {
    const server = await startUiFixtureServer();
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
    else console.log(`PASS ${checks.length} UX polish checks.`);
  })();
}

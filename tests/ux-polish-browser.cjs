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

check('history chips show the chosen value and a single clear button', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'green' });
  await open('/spending/analytics/transactions');
  const clear = page.locator('.transaction-history-clear');
  await expect(clear).toHaveCount(0);
  const summary = page.locator('.transaction-history-summary strong');
  const total = Number((await summary.textContent()).match(/\d+/)[0]);
  const typeDropdown = await pick(page, 0, 'Chi tiêu');
  const walletDropdown = await pick(page, 2, 'ZaloPay');
  // A chip names its filter while unused and shows the chosen value while filtering.
  await expect(typeDropdown.locator('.transaction-filter-value')).toHaveText('Chi tiêu');
  await expect(walletDropdown.locator('.transaction-filter-value')).toHaveText('ZaloPay');
  await expect(page.locator('.transaction-filter-dropdown').nth(1).locator('.transaction-filter-value')).toHaveText('Danh mục');
  await expect(typeDropdown).toHaveClass(/is-filtering/);
  await expect(summary).toHaveText(new RegExp(`^\\d+ / ${total} mục$`));
  // One clear button, first in the row, with the number of filters.
  await expect(clear).toHaveText('Xóa bộ lọc (2)');
  await expect(page.locator('.transaction-filter-controls > *').first()).toHaveClass(/transaction-history-clear/);
  await expect(page.getByRole('button', { name: 'Xóa tất cả' })).toHaveCount(0);
  await pick(page, 0, 'Mọi loại');
  await expect(typeDropdown).not.toHaveClass(/is-filtering/);
  await expect(clear).toHaveText('Xóa bộ lọc (1)');
  await page.getByPlaceholder('Tìm mô tả hoặc danh mục').fill('cơm');
  await clear.click();
  await expect(clear).toHaveCount(0);
  await expect(page.getByPlaceholder('Tìm mô tả hoặc danh mục')).toHaveValue('');
  await expect(summary).toHaveText(`${total} mục`);
  // A custom range is summarised on the period chip.
  const period = await pick(page, 3, 'Tùy chọn ngày');
  await page.getByLabel('Từ ngày').fill('01/10/2026');
  await page.getByLabel('Từ ngày').press('Tab');
  await expect(period.locator('.transaction-filter-value')).toHaveText('Từ 01/10/2026');
  await page.getByLabel('Đến ngày').fill('15/10/2026');
  await page.getByLabel('Đến ngày').press('Tab');
  await expect(period.locator('.transaction-filter-value')).toHaveText('01/10/2026 – 15/10/2026');
  assert.deepEqual(errors, []);
  await context.close();
});

check('wide-screen filter menus stay on screen whichever side of the row they open from', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'light', width: 700 });
  await open('/spending/analytics/transactions');
  for (let index = 0; index < 4; index += 1) {
    const dropdown = page.locator('.transaction-filter-dropdown').nth(index);
    await dropdown.locator('.transaction-filter-trigger').click();
    const box = await dropdown.locator('.transaction-filter-menu').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 700, `menu ${index} stays inside the viewport (${box.x}..${box.x + box.width})`);
    await page.keyboard.press('Escape');
  }
  assert.deepEqual(errors, []);
  await context.close();
});

check('on phones the filters are one chip row; menus and the full filter list open as sheets', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'light', width: 390 });
  await open('/spending/analytics/transactions');
  const chipNamed = (name) => page.locator('.transaction-filter-dropdown').filter({
    has: page.locator('.transaction-filter-label', { hasText: name })
  });
  // The wallet chip sits on the left; its options open in a sheet that fits the screen.
  await chipNamed('Ví').locator('.transaction-filter-trigger').click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const box = await listbox.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, 'wallet options stay on screen');
  await listbox.getByRole('option', { name: 'ZaloPay', exact: true }).click();
  await expect(listbox).toHaveCount(0);
  await expect(chipNamed('Ví').locator('.transaction-filter-value')).toHaveText('ZaloPay');
  // The full filter sheet edits the same filters and shows the live result count.
  const toggle = page.locator('.transaction-filter-toggle');
  await expect(toggle.locator('.transaction-filter-count')).toHaveText('1');
  await toggle.click();
  const sheet = page.getByTestId('history-filter-sheet');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Tháng này', exact: true }).click();
  await sheet.getByRole('switch', { name: 'Ẩn khoản định kỳ' }).check();
  await expect(sheet.locator('.transaction-sheet-apply')).toHaveText(/^Xem \d+ giao dịch$/);
  await sheet.locator('.transaction-sheet-apply').click();
  await expect(sheet).toHaveCount(0);
  await expect(toggle.locator('.transaction-filter-count')).toHaveText('3');
  // Active chips come first in the sideways row, right after the clear button.
  const firstChips = page.locator('.transaction-filter-controls > *');
  await expect(firstChips.nth(0)).toHaveText('Xóa bộ lọc (3)');
  await expect(firstChips.nth(1)).toContainText('ZaloPay');
  await page.getByRole('button', { name: /Xóa bộ lọc/ }).click();
  await expect(toggle.locator('.transaction-filter-count')).toHaveCount(0);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflows, false, 'no sideways scrolling on a phone');
  assert.deepEqual(errors, []);
  await context.close();
});

check('"Cần chú ý" grades each alert and puts the worst first', async ({ browser, server }) => {
  for (const theme of ['green', 'dark']) {
    const { context, page, errors, open } = await newPage(browser, server, { theme });
    await open('/spending/plan/overview');
    const card = page.getByTestId('plan-attention');
    await expect(card).toHaveClass(/is-critical/);
    await expect(card.locator('.plan-attention-count')).toHaveText('6');
    const bell = await card.locator('.plan-attention-bell').evaluate((node) => getComputedStyle(node).backgroundColor);
    const [r, g, b] = bell.match(/\d+/g).map(Number);
    assert.ok(r > 180 && g < 90 && b < 110, `${theme}: the bell is solid red (${bell})`);
    // The frame no longer floods red; severity lives on the cards.
    const frame = await card.evaluate((node) => getComputedStyle(node).backgroundImage);
    assert.equal(frame, 'none', `${theme}: no red gradient on the frame`);
    const cards = card.locator('.plan-alert-card');
    await expect(cards.first()).toHaveClass(/is-critical/);
    // Desktop shows one full row of cards; "show more" counts exactly the hidden ones.
    const shown = await cards.count();
    assert.ok(shown >= 2 && shown < 6, `${theme}: ${shown} cards fill one row`);
    const more = card.locator('.plan-attention-more');
    await expect(more).toHaveText(`Xem thêm ${6 - shown} việc`);
    await more.click();
    await expect(cards).toHaveCount(6);
    const tops = await cards.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    assert.equal(new Set(tops.slice(0, shown)).size, 1, `${theme}: the first row is one line`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

check('Goals page: savings calendar beside recent activity, no invented figures', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'green' });
  await open('/spending/jars/goals');
  await expect(page.locator('.jars-saving-trend-card, .jar-next-step-card')).toHaveCount(0);
  const calendar = page.locator('.jar-cal-card');
  const activity = page.locator('.jars-insights-grid--calendar .jar-activity-card');
  await expect(calendar).toBeVisible();
  await expect(activity).toBeVisible();
  await expect(activity).toHaveAttribute('id', 'jars-section-history');
  // Calendar and list sit side by side on desktop.
  const [a, b] = await Promise.all([calendar.boundingBox(), activity.boundingBox()]);
  assert.ok(b.x > a.x + a.width - 1 && Math.abs(a.y - b.y) < 2, 'activity sits to the right of the calendar');
  // Real numbers only: the fixture has no savings last month, so no percentage is shown.
  await expect(calendar.locator('.jar-cal-amount-total')).toHaveText('+2.000.000 ₫');
  await expect(calendar.locator('.jar-cal-compare')).toHaveText('Tháng trước chưa có khoản tiết kiệm để so sánh');
  await expect(page.locator('.jars-metric-trend').first()).toHaveText('+2.000.000 ₫ trong tháng này');
  assert.equal(await page.getByText('12% so với tháng trước').count(), 0, 'the hard-coded 12% is gone');
  // The next-milestone strip keeps the deposit shortcut.
  const strip = page.locator('.jar-next-strip');
  await expect(strip).toContainText('Sức khoẻ');
  await expect(strip.locator('.jar-next-strip-cta')).toHaveText('Nạp 250.000 ₫ vào hũ');
  await strip.locator('.jar-next-strip-cta').click();
  await expect(page.locator('.jar-transaction-dialog input[inputmode="numeric"]')).toHaveValue('250.000');
  await page.keyboard.press('Escape');
  // Picking a day filters the activity list; the chip clears it again.
  await expect(activity.locator('.jar-activity-row')).toHaveCount(6);
  const withdrawDay = calendar.locator('.jar-cal-cell.is-withdraw').first();
  await withdrawDay.click();
  await expect(withdrawDay).toHaveAttribute('aria-pressed', 'true');
  await expect(activity.locator('.jar-activity-row')).toHaveCount(3);
  await expect(activity.locator('.jar-activity-amount.is-deposit')).toHaveCount(0);
  await activity.locator('.jar-activity-day-chip').click();
  await expect(activity.locator('.jar-activity-row')).toHaveCount(6);
  // Keyboard: arrows move between days inside the grid.
  await calendar.locator('.jar-cal-cell[tabindex="0"]').focus();
  const before = await page.evaluate(() => document.activeElement?.dataset.day);
  await page.keyboard.press('ArrowLeft');
  const after = await page.evaluate(() => document.activeElement?.dataset.day);
  assert.notEqual(after, before, 'focus moved to another day');
  // Year view is remembered on this device.
  await calendar.locator('.jar-cal-view-switch button', { hasText: 'Năm' }).click();
  await expect(calendar.locator('.jar-cal-months, .jar-cal-year')).toBeVisible();
  await expect(calendar.locator('.jar-cal-title')).toHaveText('12 tháng qua bạn đã tiết kiệm');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.jar-cal-card .jar-cal-months, .jar-cal-card .jar-cal-year')).toBeVisible();
  assert.deepEqual(errors, []);
  await context.close();
});

check('Goals page on phones: compact list on Mục tiêu, full list on Lịch sử', async ({ browser, server }) => {
  const { context, page, errors, open } = await newPage(browser, server, { theme: 'light', width: 390 });
  await open('/spending/jars/goals');
  const calendar = page.locator('.jar-cal-card');
  await expect(calendar).toHaveClass(/is-narrow/);
  await expect(calendar.locator('.jar-cal-view-switch')).toHaveCount(0); // year view needs a wider screen
  await expect(page.locator('.jar-activity-card .jar-activity-row')).toHaveCount(3);
  await page.locator('.jar-activity-card .jar-activity-view-all').click();
  await page.waitForURL('**/spending/jars/history');
  await expect(page.locator('#jars-section-history .jar-activity-row')).toHaveCount(6);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflows, false, 'no sideways scrolling on a phone');
  assert.deepEqual(errors, []);
  await context.close();
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

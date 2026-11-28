'use strict';
// Đợt 13a: calendar and dropdown popovers inside form dialogs on desktop.
// They used to sit in the dialog's scroll area: a 300px calendar under a right-hand field
// overflowed it, the body scrolled sideways (labels lost their first letters) and lists were
// clipped by the card. Popovers are now fixed to the screen; these checks open each one and
// verify the form did not move and the popover is fully visible.
//   npm run build --prefix frontEnd-react && node tests/dialog-popover-browser.cjs
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { startUiFixtureServer } = require('./ui-fixture-server.cjs');

const FIXTURE_NOW = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 19, 10, 0, 0); })();
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }];

async function newPage(browser, server, viewport, theme = 'light') {
  const context = await browser.newContext({
    viewport, serviceWorkers: 'block', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce'
  });
  await context.clock.setFixedTime(FIXTURE_NOW);
  await context.addInitScript((value) => {
    localStorage.setItem('caltdhy_theme', value);
    localStorage.setItem('caltdhy_lang', 'vi');
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors, open: (route) => page.goto(server.url + route, { waitUntil: 'networkidle' }) };
}

// Where the dialog body and its labels are, so a sideways shift is caught exactly.
const formGeometry = (page) => page.evaluate(() => {
  const body = document.querySelector('[role="dialog"] .txn-modal-body');
  return {
    scrollLeft: body.scrollLeft,
    overflowX: body.scrollWidth - body.clientWidth,
    labels: [...body.querySelectorAll('label')].filter((l) => l.getClientRects().length)
      .map((l) => Math.round(l.getBoundingClientRect().left)),
  };
});

// The popover must be on screen (16px edge) and on top at its centre and near its corners.
async function assertPopoverVisible(page, selector, name) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const inset = 14;
    const points = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + inset, r.top + inset],
      [r.right - inset, r.top + inset], [r.left + inset, r.bottom - inset], [r.right - inset, r.bottom - inset]];
    return {
      rect: [r.left, r.top, r.right, r.bottom].map(Math.round),
      viewport: [window.innerWidth, window.innerHeight],
      covered: points.filter(([x, y]) => !document.elementFromPoint(x, y)?.closest(sel)).map((p) => p.map(Math.round)),
      position: getComputedStyle(el).position,
    };
  }, selector);
  const [left, top, right, bottom] = result.rect;
  const [vw, vh] = result.viewport;
  assert.equal(result.position, 'fixed', `${name}: popover is fixed to the screen`);
  assert.ok(left >= 16 && top >= 16 && right <= vw - 16 && bottom <= vh - 16, `${name}: on screen ${result.rect} in ${vw}×${vh}`);
  assert.deepEqual(result.covered, [], `${name}: nothing covers the popover`);
}

async function checkPopover(page, { trigger, popover, name }) {
  const before = await formGeometry(page);
  await page.locator(trigger).click();
  await expect(page.locator(popover)).toBeVisible();
  const after = await formGeometry(page);
  assert.equal(after.scrollLeft, 0, `${name}: dialog body did not scroll sideways`);
  assert.ok(after.overflowX <= 0, `${name}: nothing overflows the dialog body (${after.overflowX}px)`);
  assert.deepEqual(after.labels, before.labels, `${name}: labels kept their position`);
  await assertPopoverVisible(page, popover, name);
  await page.keyboard.press('Escape');
  await expect(page.locator(popover)).toHaveCount(0);
}

const checks = [];
const check = (name, run) => checks.push({ name, run });

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}×${viewport.height}`;

  check(`${size}: add transaction and add income keep their calendar and wallet list on screen`, async ({ browser, server }) => {
    const { context, page, errors, open } = await newPage(browser, server, viewport);
    await open('/spending/home');
    await page.locator('.topbar button', { hasText: 'Thêm giao dịch' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm giao dịch mới' });
    await expect(dialog).toBeVisible();
    await checkPopover(page, { trigger: '[role="dialog"] .calt-date-input', popover: '.calt-date-popover', name: 'expense calendar' });
    await checkPopover(page, { trigger: '[role="dialog"] .custom-wallet-trigger', popover: '.custom-wallet-menu', name: 'expense wallet list' });
    await dialog.locator('.txn-type-btn--income').click();
    await expect(page.getByRole('dialog', { name: 'Thêm thu nhập mới' })).toBeVisible();
    await checkPopover(page, { trigger: '[role="dialog"] .calt-date-input', popover: '.calt-date-popover', name: 'income calendar' });
    // Picking still works from the fixed list.
    await page.locator('[role="dialog"] .custom-wallet-trigger').click();
    await page.locator('.custom-wallet-item', { hasText: 'MBbank' }).click();
    await expect(page.locator('[role="dialog"] .custom-wallet-trigger')).toContainText('MBbank');
    assert.deepEqual(errors, []);
    await context.close();
  });

  check(`${size}: recurring dialog calendar and its three dropdowns stay on screen`, async ({ browser, server }) => {
    const { context, page, errors, open } = await newPage(browser, server, viewport);
    await open('/spending/plan/recurring');
    await page.locator('button', { hasText: 'Thêm khoản định kỳ' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Thêm khoản định kỳ' })).toBeVisible();
    await checkPopover(page, { trigger: '#rec-date', popover: '.calt-date-popover', name: 'recurring calendar' });
    for (const [index, name] of [[0, 'category'], [1, 'wallet'], [2, 'cycle']]) {
      const button = page.locator('[role="dialog"] .modal-custom-dropdown-btn').nth(index);
      const before = await formGeometry(page);
      await button.click();
      await expect(page.locator('.modal-custom-dropdown-menu')).toBeVisible();
      const after = await formGeometry(page);
      assert.equal(after.scrollLeft, 0, `${name} dropdown: no sideways scroll`);
      assert.deepEqual(after.labels, before.labels, `${name} dropdown: labels kept their position`);
      await assertPopoverVisible(page, '.modal-custom-dropdown-menu', `${name} dropdown`);
      await button.click();
      await expect(page.locator('.modal-custom-dropdown-menu')).toHaveCount(0);
    }
    await page.locator('[role="dialog"] .modal-custom-dropdown-btn').nth(1).click();
    await page.locator('.modal-custom-dropdown-menu .modal-dropdown-item', { hasText: 'Momo' }).click();
    await expect(page.locator('[role="dialog"] .modal-custom-dropdown-btn').nth(1)).toContainText('Momo');
    assert.deepEqual(errors, []);
    await context.close();
  });

  check(`${size}: create-jar and transfer calendars stay on screen`, async ({ browser, server }) => {
    const { context, page, errors, open } = await newPage(browser, server, viewport);
    await open('/spending/jars');
    await page.locator('button', { hasText: 'Tạo hũ mới' }).first().click();
    await expect(page.locator('[role="dialog"] .calt-date-input')).toBeVisible();
    await checkPopover(page, { trigger: '[role="dialog"] .calt-date-input', popover: '.calt-date-popover', name: 'jar goal calendar' });
    await page.locator('[role="dialog"] .txn-modal-close-btn').click();
    await open('/spending/plan/wallets');
    await page.locator('button', { hasText: 'Chuyển tiền' }).first().click();
    await expect(page.locator('[role="dialog"] .calt-date-input')).toBeVisible();
    await checkPopover(page, { trigger: '[role="dialog"] .calt-date-input', popover: '.calt-date-popover', name: 'transfer calendar' });
    assert.deepEqual(errors, []);
    await context.close();
  });
}

module.exports = { check, checks, newPage };

if (require.main === module) {
  (async () => {
    const server = await startUiFixtureServer({ now: FIXTURE_NOW });
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
    else console.log(`PASS ${checks.length} dialog popover checks.`);
  })();
}

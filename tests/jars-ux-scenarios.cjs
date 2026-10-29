'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');

// Reuses the mobile harness's authenticated browser and isolated database.
module.exports = async function runJarsUxScenarios({ page, check, backend, user, wallet, evidence, fit }) {
  const Jar = backend('./models/Jar');
  const Transaction = backend('./models/Transaction');
  const { getWalletBalance } = backend('./utils/walletBalance');
  const name = 'UX Sức khỏe';
  await Jar.deleteMany({ userId: user._id, name: /^UX / });
  const health = await Jar.create({ userId: user._id, name, current: 1500000, target: 7000000,
    targetDate: '2027-10-13', color: '#059669', history: Array.from({ length: 32 }, (_, index) => ({
      type: index % 3 === 0 ? 'withdraw' : 'deposit', amount: 10000 + index * 1000,
      reason: `UX lịch sử ${index}`, date: new Date(Date.UTC(2026, 9, 13 - Math.floor(index / 4), 5, index)),
    })) });
  await Jar.create({ userId: user._id, name: 'UX Mục tiêu có tên dài để kiểm tra hiển thị',
    current: 100000, target: 20000000, color: '#3B82F6', history: [
      { type: 'withdraw', amount: 20000, reason: 'UX chỉ có rút ngày này', date: new Date('2026-09-18T05:00:00Z') },
      { type: 'deposit', amount: 120000, reason: 'UX nạp riêng ngày khác', date: new Date('2026-09-17T05:00:00Z') },
    ] });
  const dialog = page.locator('.jar-dialog');
  const amountInput = () => dialog.locator('.jar-transfer-amount-box input');
  const noteInput = () => dialog.locator('.jar-transfer-note textarea');
  const card = () => page.locator('.jar-premium-card').filter({ has: page.locator('.jar-name-title', { hasText: name }) });
  const digits = value => Number(String(value).replace(/\D/g, '')) || 0;
  const layouts = [];

  async function configure(theme, locale, width, height) {
    await page.setViewportSize({ width, height });
    await page.evaluate(({ theme, locale }) => {
      localStorage.setItem('caltdhy_theme', theme);
      localStorage.setItem('caltdhy_lang', locale);
    }, { theme, locale });
  }
  async function open(kind) {
    const section = kind === 'history' ? 'history' : kind === 'create' ? 'goals' : 'list';
    await page.goto('/spending/jars/' + section);
    await expect(page.locator('.jars-page-root')).toBeVisible();
    let trigger;
    if (kind === 'create') trigger = page.locator('.jars-hero-cta-btn');
    else if (kind === 'history') trigger = page.locator('#jars-section-history .jar-activity-view-all');
    else {
      await expect(card()).toBeVisible();
      trigger = kind === 'edit' ? card().locator('.jar-btn-detail-icon')
        : kind === 'deposit' ? card().locator('.jar-btn-deposit')
        : kind === 'withdraw' ? card().locator('.jar-btn-withdraw') : card().locator('.jar-name-title');
    }
    await trigger.scrollIntoViewIfNeeded();
    const backgroundScroll = await page.evaluate(() => scrollY);
    await trigger.click();
    await expect(dialog).toBeVisible();
    return { trigger, backgroundScroll };
  }
  async function close(opened, verifyFocus = false) {
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    if (verifyFocus) await expect(opened.trigger).toBeFocused();
  }
  async function layout(label) {
    await fit(dialog, label);
    const result = await dialog.evaluate(element => {
      const box = element.getBoundingClientRect();
      const footer = element.querySelector('.jar-dialog-footer')?.getBoundingClientRect();
      const header = element.querySelector('.jar-dialog-header').getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom,
        width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
        headerTop: header.top, headerBottom: header.bottom,
        footerTop: footer?.top, footerBottom: footer?.bottom,
        portal: element.parentElement.parentElement === document.body,
        bodyLocked: getComputedStyle(document.body).overflow === 'hidden' };
    });
    assert.ok(result.portal && result.bodyLocked, label + ': portal dialog locks background scrolling');
    assert.ok(result.top >= 9 && result.bottom <= result.viewportHeight - 9, label + ': dialog clears viewport edges ' + JSON.stringify(result));
    assert.ok(Math.abs((result.top + result.bottom - result.viewportHeight) / 2) <= 2,
      label + ': dialog centers vertically ' + JSON.stringify(result));
    assert.ok(Math.abs((result.left + result.right - result.viewportWidth) / 2) <= 2, label + ': dialog centers horizontally');
    assert.ok(result.headerTop >= result.top && result.headerBottom <= result.bottom
      && result.footerTop >= result.headerBottom && result.footerBottom <= result.bottom + 1, label + ': header and actions stay visible');
    layouts.push({ label, ...result });
    return result;
  }
  async function verifyNote(label) {
    await expect(noteInput()).toBeVisible();
    await noteInput().scrollIntoViewIfNeeded();
    const readable = await noteInput().evaluate(element => {
      const box = element.getBoundingClientRect();
      const body = element.closest('.jar-dialog-body').getBoundingClientRect();
      return box.height >= 44 && box.top >= body.top - 1 && box.bottom <= body.bottom + 1;
    });
    assert.ok(readable, label + ': note textarea is directly available and can scroll into view');
    await layout(label + ' with note visible');
  }
  async function verifyHistory(label) {
    const filters = dialog.locator('.jm-history-type-button');
    await expect(filters).toHaveCount(3);
    const widths = await filters.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, label + ': type filters have equal width');
    for (let index = 0; index < 3; index++) {
      await filters.nth(index).click();
      await expect(filters.nth(index)).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.locator('.jm-history-type-button[aria-pressed="true"]')).toHaveCount(1);
      const emptyGroups = await dialog.locator('.jm-history-day').evaluateAll(groups => groups.filter(group => !group.querySelector('.jm-history-row')).length);
      assert.equal(emptyGroups, 0, label + ': filtered dates never have empty groups');
      if (index === 1) await expect(dialog.locator('.jm-history-row.is-withdraw')).toHaveCount(0);
      if (index === 2) await expect(dialog.locator('.jm-history-row.is-deposit')).toHaveCount(0);
    }
    await filters.first().click();
  }

  await check('jars UX transfers are confirmed once and create/edit preserve wallet and existing balances', async () => {
    await configure('green', 'vi', 1440, 1000);
    await page.goto('/spending/jars/goals');
    await expect(page.locator('.jar-next-strip')).toHaveAttribute('data-suggestion-amount', '250000');
    const beforeJar = await Jar.findById(health._id).lean();
    const beforeWallet = await getWalletBalance(user._id, wallet._id);
    await page.locator('.jar-next-strip-cta').click();
    await expect(dialog).toBeVisible();
    assert.equal(digits(await amountInput().inputValue()), 250000, 'Milestone CTA prefills its exact amount');
    assert.equal((await Jar.findById(health._id)).current, beforeJar.current, 'Opening a suggestion never moves money');
    await close({});

    let opened = await open('deposit');
    await expect(amountInput()).toHaveValue('');
    await amountInput().fill('50000');
    await noteInput().fill('UX giữ ghi chú khi lỗi');
    const depositUrl = `**/api/jars/${health._id}/deposit`;
    await page.route(depositUrl, route => route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Temporary jar test failure' }) }), { times: 1 });
    await dialog.locator('.jar-transfer-submit').click();
    await expect(dialog.locator('.jar-transfer-server-error[role="alert"]')).toBeVisible();
    assert.equal(digits(await amountInput().inputValue()), 50000);
    await expect(noteInput()).toHaveValue('UX giữ ghi chú khi lỗi');
    assert.equal((await Jar.findById(health._id)).current, beforeJar.current);

    let releaseRequest, requestStarted, requests = 0;
    const hold = new Promise(resolve => { releaseRequest = resolve; });
    const started = new Promise(resolve => { requestStarted = resolve; });
    const holdDeposit = async route => { requests++; requestStarted(); await hold; await route.continue(); };
    await page.route(depositUrl, holdDeposit);
    try {
      await dialog.locator('.jar-transfer-submit').click();
      await started;
      await expect(dialog).toHaveAttribute('aria-busy', 'true');
      await expect(dialog.locator('.jar-transfer-submit')).toBeDisabled();
      await expect(dialog.locator('.jar-dialog-close')).toBeDisabled();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      assert.equal(requests, 1, 'Pending confirmation cannot issue duplicate financial requests');
    } finally { releaseRequest(); }
    await expect(dialog).toHaveCount(0);
    await page.unroute(depositUrl, holdDeposit);
    assert.equal((await Jar.findById(health._id)).current, beforeJar.current + 50000);
    assert.equal(await getWalletBalance(user._id, wallet._id), beforeWallet - 50000);
    let transfers = await Transaction.find({ userId: user._id, jarId: health._id }).lean();
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0].type, 'transfer');
    assert.equal(String(transfers[0].walletId), String(wallet._id));

    opened = await open('withdraw');
    await expect(amountInput()).toHaveValue('');
    await amountInput().fill('999999999');
    await amountInput().blur();
    await expect(dialog.locator('.jar-transfer-submit')).toBeDisabled();
    await expect(dialog.locator('.jar-transfer-error[role="alert"]').first()).toBeVisible();
    await amountInput().fill('20000');
    await noteInput().fill('UX rút đã xác nhận');
    await dialog.locator('.jar-transfer-submit').click();
    await expect(dialog).toHaveCount(0);
    assert.equal((await Jar.findById(health._id)).current, beforeJar.current + 30000);
    assert.equal(await getWalletBalance(user._id, wallet._id), beforeWallet - 30000);
    transfers = await Transaction.find({ userId: user._id, jarId: health._id }).lean();
    assert.equal(transfers.length, 2);
    assert.ok(transfers.every(item => item.type === 'transfer'), 'Jar money movements never inflate income or expenses');
    assert.equal(transfers.filter(item => String(item.toWalletId) === String(wallet._id)).length, 1);

    opened = await open('edit');
    await expect(dialog.locator('input[id$="-initial"]')).toHaveCount(0);
    await expect(dialog.locator('.jm-balance-readonly')).toBeVisible();
    await dialog.locator('input[id$="-target"]').fill('7100000');
    await dialog.locator('.jar-dialog-footer button[type="submit"]').click();
    await expect(dialog).toHaveCount(0);
    const edited = await Jar.findById(health._id).lean();
    assert.equal(edited.target, 7100000);
    assert.equal(edited.current, beforeJar.current + 30000, 'Editing a goal preserves its current balance');
    assert.equal(await getWalletBalance(user._id, wallet._id), beforeWallet - 30000);

    opened = await open('create');
    await dialog.locator('input[id$="-name"]').fill('UX Hũ tạo qua giao diện');
    await dialog.locator('input[id$="-target"]').fill('1000000');
    await dialog.locator('input[id$="-initial"]').fill('123000');
    await expect(dialog.locator('.jm-field-hint')).toBeVisible();
    await dialog.locator('.jar-dialog-footer button[type="submit"]').click();
    await expect(dialog).toHaveCount(0);
    const created = await Jar.findOne({ userId: user._id, name: 'UX Hũ tạo qua giao diện' }).lean();
    assert.equal(created.current, 123000);
    assert.equal(await getWalletBalance(user._id, wallet._id), beforeWallet - 30000, 'Initial set-aside money does not debit a wallet');
    assert.equal(await Transaction.countDocuments({ userId: user._id, jarId: created._id }), 0);
  });

  await check('jars UX dialogs center and retain readable notes and actions in four themes', async () => {
    for (const [theme, viewports] of [
      ['dark', [[1440, 1000], [390, 844]]], ['light', [[1280, 720], [320, 568]]],
      ['cream', [[1440, 900], [390, 844]]], ['green', [[1280, 720], [320, 568]]],
    ]) {
      for (const [width, height] of viewports) {
        await configure(theme, 'vi', width, height);
        for (const kind of ['create', 'edit', 'deposit', 'withdraw', 'history', 'detail']) {
          const opened = await open(kind);
          const label = `${theme}/${width}x${height}/${kind}`;
          await layout(label);
          if (kind === 'deposit' || kind === 'withdraw') await verifyNote(label);
          if (kind === 'history') await verifyHistory(label);
          if (kind === 'deposit' || kind === 'history' || (theme === 'green' && kind === 'create')) {
            await page.screenshot({ path: path.join(evidence, `jars-${kind}-${theme}-${width}.png`) });
          }
          await close(opened, kind !== 'detail');
        }
      }
    }
  });

  await check('jars UX history filters and three languages fit phones landscape and enlarged text', async () => {
    const titles = {
      vi: ['Tạo hũ tiết kiệm', 'Nạp tiền vào hũ', 'Lịch sử hũ'],
      en: ['Create a savings jar', 'Add money to jar', 'Jar history'],
      'zh-CN': ['创建储蓄罐', '存入储蓄罐', '储蓄罐记录'],
    };
    for (const locale of ['vi', 'en', 'zh-CN']) {
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await configure('green', locale, width, height);
        for (const [index, kind] of ['create', 'deposit', 'history'].entries()) {
          const opened = await open(kind);
          await expect(dialog.locator('.jar-dialog-header h2')).toHaveText(titles[locale][index]);
          await layout(`${locale}/${width}/${kind}`);
          if (kind === 'deposit') await verifyNote(`${locale}/${width}`);
          if (kind === 'history') {
            await verifyHistory(`${locale}/${width}`);
            await dialog.locator('.jm-history-search input').fill('UX chỉ có rút ngày này');
            await expect(dialog.locator('.jm-history-row')).toHaveCount(1);
            await dialog.locator('.jm-history-type-button').nth(1).click();
            await expect(dialog.locator('.jm-history-day')).toHaveCount(0);
            await expect(dialog.locator('.jm-history-empty')).toBeVisible();
          }
          if (width === 390) await page.screenshot({ path: path.join(evidence, `jars-${kind}-${locale}-390.png`) });
          await close(opened);
        }
      }
    }
    await configure('green', 'vi', 844, 390);
    let opened = await open('deposit');
    await verifyNote('phone landscape');
    await close(opened);
    await configure('green', 'vi', 640, 360);
    opened = await open('history');
    // A viewport halved in both axes represents the CSS layout space at 200% zoom.
    await layout('1280x720 at 200% layout scale');
    await verifyHistory('200% layout scale');
    await close(opened);
    fs.writeFileSync(path.join(evidence, 'jars-dialog-layouts.json'), JSON.stringify(layouts, null, 2));
    await configure('green', 'vi', 390, 844);
    await page.goto('/spending/home');
  });
};

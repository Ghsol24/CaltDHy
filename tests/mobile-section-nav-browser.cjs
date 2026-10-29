'use strict';
// On phones the section tabs (Tổng quan, Ví & Tài khoản, Ngân sách, ...) scroll
// sideways. Choosing a tab must slide it toward the middle so its neighbours
// become visible without a manual swipe.
//   npm run build --prefix frontEnd-react && node tests/mobile-section-nav-browser.cjs
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { startUiFixtureServer } = require('./ui-fixture-server.cjs');

async function measure(page, activeLabel) {
  return page.evaluate((label) => {
    const scroller = document.querySelector('.mobile-section-nav__scroller');
    const items = [...scroller.querySelectorAll('.mobile-section-nav__item')];
    const index = items.findIndex((item) => item.textContent.trim() === label);
    const view = scroller.getBoundingClientRect();
    const visibleShare = (item) => {
      if (!item) return 1;
      const r = item.getBoundingClientRect();
      return Math.max(0, Math.min(r.right, view.right) - Math.max(r.left, view.left)) / r.width;
    };
    const active = items[index].getBoundingClientRect();
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    return {
      isActive: items[index].getAttribute('aria-current') === 'page',
      centerOffset: Math.abs((active.left + active.width / 2) - (view.left + view.width / 2)),
      atEdge: scroller.scrollLeft <= 1 || scroller.scrollLeft >= maxScroll - 1,
      previousVisible: visibleShare(items[index - 1]),
      nextVisible: visibleShare(items[index + 1]),
      overflow: maxScroll > 0
    };
  }, activeLabel);
}

(async () => {
  const server = await startUiFixtureServer();
  const browser = await chromium.launch();
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        serviceWorkers: 'block', locale: 'vi-VN', reducedMotion
      });
      await context.addInitScript(() => {
        localStorage.setItem('caltdhy_theme', 'light');
        localStorage.setItem('caltdhy_lang', 'vi');
      });
      const page = await context.newPage();
      const cases = [
        ['/spending/plan/overview', 'Ngân sách'],
        ['/spending/plan/overview', 'Ví & Tài khoản'],
        ['/spending/analytics/overview', 'Báo cáo'],
        ['/spending/analytics/overview', 'Dòng tiền']
      ];
      for (const [route, label] of cases) {
        await page.goto(server.url + route, { waitUntil: 'networkidle' });
        const tab = page.locator('.mobile-section-nav__item', { hasText: label }).first();
        await tab.click();
        await page.waitForTimeout(700);
        const m = await measure(page, label);
        assert.ok(m.overflow, `${route}: the tab bar should be wider than the phone screen for this check`);
        assert.ok(m.isActive, `${label} should become the active tab`);
        assert.ok(m.centerOffset < 4 || m.atEdge, `${label} should be centred unless the bar is at its end (offset ${m.centerOffset.toFixed(1)}px)`);
        assert.ok(m.nextVisible >= 0.45, `the tab after ${label} should be at least half visible (${Math.round(m.nextVisible * 100)}%) [${reducedMotion}]`);
        assert.ok(m.previousVisible >= 0.45, `the tab before ${label} should be at least half visible (${Math.round(m.previousVisible * 100)}%) [${reducedMotion}]`);
      }
      // Arriving directly on a later tab (deep link) also centres it.
      await page.goto(`${server.url}/spending/plan/budgets`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const direct = await measure(page, 'Ngân sách');
      assert.ok(direct.centerOffset < 4 || direct.atEdge, 'a deep-linked tab should start centred');
      assert.ok(direct.nextVisible >= 0.45, 'the tab after a deep-linked tab should be visible');
      await context.close();
    }
    console.log('PASS mobile section tabs slide the selected tab into the middle.');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

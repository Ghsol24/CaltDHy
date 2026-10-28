'use strict';
// Theme contrast regression check.
// Opens every app route and every dropdown/menu/popover in all four themes and
// measures text contrast against the background actually painted behind it.
//   - Text inside menus/popovers must reach 4.5:1 (WCAG AA for normal text).
//   - Any other visible text must reach 3:1, which catches "dark text on a dark
//     menu" style theme mismatches without flagging intentionally muted labels.
// Runs against frontEnd-react/dist with an in-memory fixture API (no MongoDB).
//   npm run build --prefix frontEnd-react && node tests/theme-contrast-browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { startUiFixtureServer } = require('./ui-fixture-server.cjs');

const THEMES = ['dark', 'light', 'cream', 'green'];
const PAGE_MIN = 3;
const MENU_MIN = 4.5;

const ROUTES = [
  '/spending/home',
  '/spending/plan/overview', '/spending/plan/wallets', '/spending/plan/budgets', '/spending/plan/recurring',
  '/spending/analytics/overview', '/spending/analytics/spending', '/spending/analytics/cash-flow',
  '/spending/analytics/reports', '/spending/analytics/transactions',
  '/spending/jars/goals', '/spending/jars/list', '/spending/jars/history'
];

// Each scenario opens one floating surface. `open` is clicked, then every text
// node inside `menu` is checked against MENU_MIN.
const MENUS = [
  { route: '/spending/plan/overview', open: ['.plan-btn-create-primary'], menu: '.plan-create-dropdown' },
  { route: '/spending/plan/wallets', open: ['.wallet-dots-btn'], menu: '.wallet-actions-popover' },
  { route: '/spending/plan/wallets', open: ['.donut-dist-dropdown-trigger'], menu: '.donut-dist-dropdown-menu' },
  { route: '/spending/plan/wallets', open: ['.wallet-custom-dropdown-trigger'], menu: '.wallet-custom-dropdown-menu' },
  { route: '/spending/plan/recurring', open: ['.recurring-sort-custom-btn'], menu: '.recurring-sort-custom-menu' },
  { route: '/spending/plan/recurring', open: ['.recurring-menu-wrapper button'], menu: '.recurring-actions-dropdown' },
  { route: '/spending/plan/recurring', open: ['button:has(.wallet-chip-name)'], menu: '.recurring-wallet-popover-menu' },
  { route: '/spending/analytics/transactions', open: ['.transaction-filter-dropdown >> nth=0 >> .transaction-filter-trigger'], menu: '.transaction-filter-menu' },
  { route: '/spending/analytics/transactions', open: ['.transaction-filter-dropdown >> nth=2 >> .transaction-filter-trigger'], menu: '.transaction-filter-menu' },
  { route: '/spending/jars/goals', open: ['#jars-section-goals ~ * .calt-custom-select-trigger, .jars-goals-activity-card .calt-custom-select-trigger, .jars-saving-trend-card .calt-custom-select-trigger'], menu: '.calt-custom-select-menu' },
  { route: '/spending/jars/list', open: ['.jars-toolbar-right .calt-custom-select-trigger'], menu: '.calt-custom-select-menu' },
  { route: '/spending/jars/list', open: ['.jar-card-menu-btn'], menu: '.jar-card-dropdown-menu' },
  { route: '/spending/jars/list', open: ['button:has-text("Nạp tiền")', '.jar-transfer-wallet-box .custom-wallet-trigger'], menu: '.custom-wallet-menu' },
  { route: '/spending/plan/recurring', open: ['.recurring-add-btn, button:has-text("Thêm khoản định kỳ")', '.modal-custom-dropdown-btn'], menu: '.modal-custom-dropdown-menu', optional: true }
];

function scanScript({ rootSelector, minimum }) {
  const parse = (value) => {
    const match = /rgba?\(([^)]+)\)/.exec(value || '');
    if (!match) return null;
    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const over = (top, bottom) => {
    const a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / a;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x, y) => { const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
  const describe = (el) => {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 4) {
      const cls = [...node.classList].filter((c) => !c.startsWith('is-')).slice(0, 2).join('.');
      parts.unshift(node.tagName.toLowerCase() + (cls ? `.${cls}` : ''));
      node = node.parentElement;
    }
    return parts.join(' > ');
  };
  const backgroundBehind = (el) => {
    const layers = [];
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== 'none' && /gradient|url\(/.test(style.backgroundImage)) {
        return { gradient: true };
      }
      const color = parse(style.backgroundColor);
      if (color && color.a > 0) {
        layers.push(color);
        if (color.a >= 0.99) break;
      }
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    const root = parse(getComputedStyle(document.body).backgroundColor);
    if (root && root.a > 0) result = over(root, result);
    for (let i = layers.length - 1; i >= 0; i -= 1) result = over(layers[i], result);
    return result;
  };
  const scope = rootSelector ? document.querySelector(rootSelector) : document.body;
  if (!scope) return { missing: true, failures: [], checked: 0 };
  const failures = [];
  let checked = 0;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    const el = walker.currentNode.parentElement;
    if (!text || !el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('svg, [aria-hidden="true"], .sr-only, .visually-hidden, script, style, noscript')) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') continue;
    if (style.clip === 'rect(0px, 0px, 0px, 0px)' || style.clipPath === 'inset(50%)') continue;
    let hidden = false;
    for (let node = el; node; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) < 0.35) { hidden = true; break; }
    }
    if (hidden || el.closest(':disabled, [aria-disabled="true"]')) continue;
    const bg = backgroundBehind(el);
    if (bg.gradient) continue;
    const fg = parse(style.color);
    if (!fg || fg.a === 0) continue;
    const value = ratio(over(fg, bg), bg);
    checked += 1;
    if (value < minimum) {
      failures.push({
        where: describe(el), text: text.slice(0, 48), ratio: Math.round(value * 100) / 100,
        color: style.color, background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
      });
    }
  }
  return { failures, checked };
}

async function openPage(browser, url, theme, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 }, serviceWorkers: 'block',
    locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce'
  });
  await context.addInitScript((value) => {
    localStorage.setItem('caltdhy_theme', value);
    localStorage.setItem('caltdhy_lang', 'vi');
  }, theme);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  return { context, page };
}

(async () => {
  const server = await startUiFixtureServer();
  const browser = await chromium.launch();
  const report = { pages: [], menus: [], skipped: [] };
  try {
    for (const theme of THEMES) {
      for (const [route, width] of [...ROUTES.map((r) => [r, 1440]), ['/spending/home', 390], ['/spending/jars/goals', 390], ['/spending/plan/budgets', 390]]) {
        const { context, page } = await openPage(browser, server.url + route, theme, width);
        const result = await page.evaluate(scanScript, { rootSelector: null, minimum: PAGE_MIN });
        report.pages.push({ theme, route, width, checked: result.checked, failures: result.failures });
        await context.close();
      }
      for (const scenario of MENUS) {
        const { context, page } = await openPage(browser, server.url + scenario.route, theme);
        let opened = true;
        for (const selector of scenario.open) {
          const target = page.locator(selector).first();
          if (!(await target.count())) { opened = false; break; }
          await target.scrollIntoViewIfNeeded().catch(() => {});
          await target.click({ timeout: 4000 }).catch(() => { opened = false; });
          await page.waitForTimeout(250);
        }
        const visible = opened && await page.locator(scenario.menu).first().isVisible().catch(() => false);
        if (!visible) {
          report.skipped.push({ theme, ...scenario });
          await context.close();
          continue;
        }
        const result = await page.evaluate(scanScript, { rootSelector: scenario.menu, minimum: MENU_MIN });
        report.menus.push({ theme, route: scenario.route, menu: scenario.menu, checked: result.checked, failures: result.failures });
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const out = path.join(os.tmpdir(), 'caltdhy-theme-contrast.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  const pageFailures = report.pages.flatMap((p) => p.failures.map((f) => ({ ...f, theme: p.theme, route: `${p.route}@${p.width}` })));
  const menuFailures = report.menus.flatMap((m) => m.failures.map((f) => ({ ...f, theme: m.theme, route: m.menu })));
  const requiredSkips = report.skipped.filter((s) => !s.optional);
  const line = (f) => `  [${f.theme}] ${f.route} | ${f.ratio}:1 | "${f.text}" | ${f.where} | ${f.color} on ${f.background}`;
  console.log(`Checked ${report.pages.reduce((n, p) => n + p.checked, 0)} page texts and ${report.menus.reduce((n, m) => n + m.checked, 0)} menu texts across ${THEMES.length} themes.`);
  if (menuFailures.length) console.log(`Menu text below ${MENU_MIN}:1 (${menuFailures.length}):\n${menuFailures.map(line).join('\n')}`);
  if (pageFailures.length) console.log(`Page text below ${PAGE_MIN}:1 (${pageFailures.length}):\n${pageFailures.map(line).join('\n')}`);
  if (report.skipped.length) console.log(`Menus not opened: ${report.skipped.map((s) => `[${s.theme}] ${s.menu}${s.optional ? ' (optional)' : ''}`).join(', ')}`);
  console.log(`Full report: ${out}`);
  assert.equal(requiredSkips.length, 0, 'Every required menu should open in every theme.');
  assert.equal(menuFailures.length, 0, 'Menu and popover text must reach 4.5:1 in every theme.');
  assert.equal(pageFailures.length, 0, 'Visible page text must reach 3:1 in every theme.');
  console.log('PASS theme contrast across dark, light, cream and green.');
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

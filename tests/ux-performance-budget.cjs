'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '../frontEnd-react/dist');
const htmlPath = path.join(distDir, 'index.html');
assert.ok(fs.existsSync(htmlPath), 'Cần build frontend trước khi kiểm tra UX budget.');

const html = fs.readFileSync(htmlPath, 'utf8');
const assetPaths = [...html.matchAll(/(?:src|href)="\/(assets\/[^"?]+)"/g)].map((match) => match[1]);
const entryMatch = html.match(/<script[^>]+src="\/(assets\/index-[^"]+\.js)"/);
assert.ok(entryMatch, 'Không tìm thấy JavaScript entry trong production build.');

const entryBytes = fs.statSync(path.join(distDir, entryMatch[1])).size;
const cssBytes = assetPaths
  .filter((asset) => asset.endsWith('.css'))
  .reduce((total, asset) => total + fs.statSync(path.join(distDir, asset)).size, 0);
const initialPreloads = [...html.matchAll(/rel="modulepreload"[^>]+href="\/([^"?]+)"/g)].map((match) => match[1]);
const initialJsBytes = [entryMatch[1], ...initialPreloads.filter((asset) => asset.endsWith('.js'))]
  .reduce((total, asset) => total + fs.statSync(path.join(distDir, asset)).size, 0);
const assetNames = fs.readdirSync(path.join(distDir, 'assets'));

assert.ok(initialJsBytes <= 350 * 1024, `JavaScript khởi đầu vượt budget 350 KiB: ${initialJsBytes} byte.`);
assert.ok(cssBytes <= 600 * 1024, `CSS khởi đầu vượt budget 600 KiB: ${cssBytes} byte.`);
assert.ok(!initialPreloads.some((asset) => /(AnalyticsView|chart)/i.test(asset)),
  'Analytics/Chart.js không được preload trên Landing/Auth/Home.');
assert.ok(assetNames.some((asset) => asset.startsWith('AnalyticsView-') && asset.endsWith('.js')),
  'Analytics phải được tách thành chunk tải theo nhu cầu.');
assert.ok(assetNames.some((asset) => asset.startsWith('JarsView-') && asset.endsWith('.js')),
  'Jars phải được tách thành chunk tải theo nhu cầu.');

console.log(JSON.stringify({
  entryBytes,
  initialJsBytes,
  cssBytes,
  initialPreloads,
  lazyFeatureChunks: assetNames.filter((asset) => /^(AnalyticsView|JarsView|PlanView|HomeView)-.*\.js$/.test(asset)).sort()
}, null, 2));
console.log('PASS UX production bundle budgets.');

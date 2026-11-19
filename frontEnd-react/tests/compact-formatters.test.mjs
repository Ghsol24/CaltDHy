import './helpers/vite-resolve.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

// 'change.times' is registered by the analytics screen's lazy translations, as in the app.
await import('../src/i18n/analyticsTranslations.js');
const { formatCompactCurrency, formatChangePercent } = await import('../src/utils/compactFormatters.js');

test('Vietnamese compact amounts use the shorthand people write: k, tr, tỷ', () => {
  const vi = (value) => formatCompactCurrency(value, { locale: 'vi', currency: 'VND' });
  assert.equal(vi(0), '0');
  assert.equal(vi(999), '999');
  assert.equal(vi(1_000), '1k');
  assert.equal(vi(600_000), '600k');
  assert.equal(vi(1_500_000), '1,5tr');
  assert.equal(vi(2_000_000_000), '2 tỷ');
  assert.equal(vi(-600_000), '−600k', 'a real minus sign, not a hyphen');
});

test('other locales and USD use Intl compact currency, converting only the label', () => {
  assert.equal(formatCompactCurrency(1_500_000, { locale: 'en', currency: 'VND' }), '₫1.5M');
  assert.equal(formatCompactCurrency(2_500_000, { locale: 'en', currency: 'USD', vndPerUsd: 25_000 }), '$100');
  assert.equal(formatCompactCurrency(2_500_000, { locale: 'vi', currency: 'USD', vndPerUsd: 25_000 }), '100\u00a0$');
  assert.equal(formatCompactCurrency(2_500_000, { locale: 'en', currency: 'USD' }), '₫2.5M',
    'without a usable rate the label stays in VND instead of inventing a conversion');
});

test('amounts that cannot be shown read as out of range', () => {
  assert.equal(formatCompactCurrency(Number.NaN, { locale: 'vi', currency: 'VND' }), 'Ngoài giới hạn hiển thị');
  assert.equal(formatCompactCurrency(Infinity, { locale: 'en', currency: 'USD', vndPerUsd: 25_000 }), 'Outside display range');
});

test('change percentages show direction, and very large rises read as a multiple', () => {
  const vi = (value) => formatChangePercent(value, { locale: 'vi' });
  assert.equal(vi(18.6), '↑ +18,6%');
  assert.equal(vi(-42), '↓ -42,0%');
  assert.equal(vi(0), '~ 0,0%');
  assert.equal(vi(299.9), '↑ +299,9%');
  assert.equal(vi(300), '↑ gấp 4 lần');
  assert.equal(vi(4_000), '↑ gấp 41 lần');
  assert.equal(formatChangePercent(4_000, { locale: 'en' }), '↑ 41× higher');
  assert.equal(formatChangePercent(12.345, { locale: 'en', fractionDigits: 2 }), '↑ +12.35%');
  for (const value of [Number.NaN, Infinity, undefined, 'abc']) assert.equal(vi(value), '—', String(value));
});

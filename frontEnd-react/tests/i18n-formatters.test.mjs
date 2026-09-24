import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  convertVndForDisplay,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  getDueStatus,
} from '../src/utils/formatters.js';
import { SUPPORTED_LOCALES, translations, translate } from '../src/i18n/translations.js';
import { translateLegacyText } from '../src/i18n/legacyTranslations.js';
import { calculateMonthlyStats, calculateWalletBalances } from '../src/utils/financeMath.js';
import { hasUsableUsdRate } from '../src/utils/exchangeRate.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../src');

test('all supported locales contain the same semantic translation keys', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['vi', 'en', 'zh-CN']);
  const baseKeys = Object.keys(translations.vi).sort();
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(Object.keys(translations[locale]).sort(), baseKeys, locale);
    assert.equal(translate(locale, 'settings.displayCurrency').length > 0, true);
  }
});

test('date, number and currency output follows each locale', () => {
  assert.equal(formatNumber(1234567, { locale: 'vi' }), '1.234.567');
  assert.equal(formatNumber(1234567, { locale: 'en' }), '1,234,567');
  assert.match(formatDate('2026-09-23', 'full', { locale: 'vi' }), /23.*9.*2026/);
  assert.match(formatDate('2026-09-23', 'full', { locale: 'en' }), /September 23, 2026/);
  assert.match(formatDate('2026-09-23', 'full', { locale: 'zh-CN' }), /2026年9月23日/);
  assert.equal(formatPercent(75, { locale: 'en' }), '75%');
  assert.equal(formatPercent(12.5, { locale: 'en', fractionDigits: 1 }), '12.5%');
  assert.equal(formatPercent(12.5, { locale: 'vi', fractionDigits: 1 }), '12,5%');
  assert.match(formatCurrency(2670000, { locale: 'vi', currency: 'VND' }), /2\.670\.000/);
  assert.match(formatCurrency(2670000, { locale: 'en', currency: 'VND' }), /2,670,000/);
});

test('USD conversion is display-only and requires an explicitly supplied rate', () => {
  assert.equal(hasUsableUsdRate({ vndPerUsd: 27000, source: 'Provider', asOf: '2026-09-23' }), true);
  assert.equal(hasUsableUsdRate({ vndPerUsd: 27000, source: '', asOf: '2026-09-23' }), false);
  assert.equal(hasUsableUsdRate({ vndPerUsd: 27000, source: 'Provider', asOf: '2026-02-30' }), false);
  assert.equal(convertVndForDisplay(27000, { currency: 'USD', vndPerUsd: 27000 }), 1);
  assert.equal(formatCurrency(27000, { locale: 'en', currency: 'USD', vndPerUsd: 27000 }), '$1.00');

  const transactions = [
    { type: 'income', walletId: 'cash', amount: 100000, date: '2026-09-01' },
    { type: 'expense', walletId: 'cash', amount: 25000, date: '2026-09-02', category: 'Food & Dining' },
  ];
  assert.equal(calculateMonthlyStats(transactions, '2026-09').net, 75000);
  assert.equal(calculateWalletBalances([{ id: 'cash', initialBalance: 0 }], transactions).balances.cash, 75000);
});

test('relative due text is localized without changing date arithmetic', () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const date = `${yyyy}-${mm}-${dd}`;
  assert.equal(getDueStatus(date, { locale: 'vi' }).diffDays, 0);
  assert.equal(getDueStatus(date, { locale: 'en' }).text, 'Due today');
  assert.equal(getDueStatus(date, { locale: 'zh-CN' }).text, '今天到期');
});

test('frontend source has no scattered vi-VN locale formatter calls or hard-coded FX rate', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.(?:js|jsx)$/.test(entry.name)) files.push(target);
    }
  };
  walk(src);
  const offenders = files.filter((file) => {
    if (file.endsWith('translations.js')) return false;
    const content = fs.readFileSync(file, 'utf8');
    return /toLocale(?:String|DateString|TimeString)\(['"]vi-VN/.test(content)
      || /1\s*USD\s*=\s*27[,.]000\s*VND/.test(content);
  });
  assert.deepEqual(offenders, []);
});

test('legacy rendered labels and interpolated financial messages pass through the locale catalog', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (/\.(?:js|jsx)$/.test(entry.name) && !target.includes(`${path.sep}i18n${path.sep}`)) files.push(target);
    }
  };
  walk(src);
  const candidates = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/>([^<{\n]*[À-ỹ][^<{\n]*)</g)) candidates.add(match[1].trim());
    for (const match of content.matchAll(/(?:aria-label|title|placeholder)=["']([^"'\n]*[À-ỹ][^"'\n]*)["']/g)) candidates.add(match[1].trim());
  }
  const sourceArtifacts = /\)\.length\}|^0 \? /;
  const missing = [...candidates].filter((value) => value && !sourceArtifacts.test(value)
    && (translateLegacyText('en', value) === value || translateLegacyText('zh-CN', value) === value));
  assert.deepEqual(missing, []);

  const dynamic = [
    'Vượt hạn mức +50.000 ₫',
    'Đã chuyển 1.000.000 ₫ từ Tiền mặt sang Ngân hàng.',
    'Đã tạo hũ "Quỹ khẩn cấp" với mục tiêu 30.000.000 ₫.',
    'Cảnh báo: Ăn uống vượt ngân sách',
    'Đã chi 150.000 ₫ / 100.000 ₫ (vượt +50.000 ₫) so với hạn mức bạn tự đặt cho danh mục này. Bạn vẫn còn 20.000 ₫ khả dụng nói chung, nhưng nên điều chỉnh hạn mức hoặc giảm chi ở đây.',
  ];
  for (const value of dynamic) {
    assert.notEqual(translateLegacyText('en', value), value);
    assert.notEqual(translateLegacyText('zh-CN', value), value);
  }
});

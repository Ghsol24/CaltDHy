import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCategorySlices, colorVarForRank, OTHER_SLICE_KEY } from '../src/features/analytics/analytics/categoryColors.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = fs.readFileSync(path.join(here, '../src/assets/css/tokens.css'), 'utf8');

const category = (name, amount) => ({ name, amount, percent: amount });
const ranked = (count) => Array.from({ length: count }, (_value, index) => category(`c${index + 1}`, 100 - index));

test('the six biggest categories get their own colour by rank; the rest are grey', () => {
  assert.deepEqual([0, 1, 5, 6, 12].map(colorVarForRank),
    ['--chart-cat-1', '--chart-cat-2', '--chart-cat-6', '--chart-cat-other', '--chart-cat-other']);
});

test('up to seven categories are all shown as themselves', () => {
  assert.equal(buildCategorySlices(ranked(3)).length, 3);
  const seven = buildCategorySlices(ranked(7));
  assert.equal(seven.length, 7);
  assert.equal(seven[6].colorVar, '--chart-cat-other');
  assert.equal(seven[6].members, null);
  assert.equal(seven[6].name, 'c7');
});

test('beyond seven categories the small ones fold into one grey group that keeps its members', () => {
  const slices = buildCategorySlices(ranked(9));
  assert.equal(slices.length, 7);
  const other = slices[6];
  assert.equal(other.key, OTHER_SLICE_KEY);
  assert.deepEqual(other.members.map((item) => item.name), ['c7', 'c8', 'c9']);
  assert.equal(other.amount, 94 + 93 + 92);
  assert.equal(slices.slice(0, 6).every((slice, index) => slice.colorVar === `--chart-cat-${index + 1}`), true);
});

// ── Palette contrast (WCAG 1.4.11: graphics need 3:1 against the card surface) ──
const block = (selector) => {
  const start = tokens.indexOf(`\n${selector} {`);
  assert.ok(start >= 0, `${selector} block exists`);
  return tokens.slice(start, tokens.indexOf('\n}', start));
};
const read = (css, name) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];
const channel = (value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const NAMES = ['--chart-cat-1', '--chart-cat-2', '--chart-cat-3', '--chart-cat-4', '--chart-cat-5', '--chart-cat-6', '--chart-cat-other'];

test('every category colour keeps 3:1 against the card surface in all four themes', () => {
  const light = block(':root');
  const palettes = {
    green: [light, block('html.green-theme')], light: [light, block('html.light-theme')],
    cream: [light, block('html.cream-theme')], dark: [block('html.dark-theme'), block('html.dark-theme')],
  };
  for (const [theme, [paletteCss, themeCss]] of Object.entries(palettes)) {
    const surface = read(themeCss, '--color-surface');
    assert.ok(surface, `${theme} defines a surface colour`);
    for (const name of NAMES) {
      const colour = read(paletteCss, name);
      assert.ok(colour, `${theme}: ${name} is defined`);
      assert.ok(contrast(colour, surface) >= 3, `${theme}: ${name} ${colour} on ${surface} is ${contrast(colour, surface).toFixed(2)}:1`);
    }
  }
});

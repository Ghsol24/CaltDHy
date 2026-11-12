import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THEME_OPTIONS } from '../src/utils/themes.js';

// The picker paints each theme with literal colours; they must match the real theme tokens.
test('theme picker previews use the colours each theme actually defines', () => {
  const css = fs.readFileSync(new URL('../src/assets/css/tokens.css', import.meta.url), 'utf8');
  const tokens = { canvas: '--color-canvas', surface: '--color-surface', border: '--color-border', text: '--color-text', muted: '--color-text-secondary' };
  assert.deepEqual(THEME_OPTIONS.map((option) => option.id), ['dark', 'light', 'cream', 'green']);
  for (const option of THEME_OPTIONS) {
    const start = css.indexOf(`html.${option.id}-theme {`);
    assert.notEqual(start, -1, option.id);
    const block = css.slice(start, css.indexOf('\n}', start));
    for (const [key, token] of Object.entries(tokens)) {
      const match = block.match(new RegExp(`\\n\\s*${token}:\\s*(#[0-9A-Fa-f]{6});`));
      assert.ok(match, `${option.id} ${token}`);
      assert.equal(option.preview[key].toUpperCase(), match[1].toUpperCase(), `${option.id} ${key}`);
    }
    assert.match(option.preview.accent, /^#[0-9A-F]{6}$/);
    assert.ok(option.swatch.includes(option.preview.accent), `${option.id} accent matches its swatch`);
  }
});

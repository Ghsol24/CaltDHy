import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Đợt 11, 7e (X-13): the app uses seven font sizes only — 12 / 14 / 16 / 18 / 20 / 24 / 32px.
// Body text is 14px; 12px is for secondary labels. Any other size has to say why with
// a "scale-exempt" comment on the same line.
const SCALE = new Set([12, 14, 16, 18, 20, 24, 32]);
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
// Marketing mock-up of a phone (miniature text) and the animated brand loader.
const EXEMPT_FILES = new Set(['pages/landing.css', 'components/ui/signature-loader.css']);

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (ext.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function fontTokens() {
  const css = fs.readFileSync(path.join(SRC, 'assets/css/tokens.css'), 'utf8');
  const tokens = new Map();
  for (const [, name, px] of css.matchAll(/--font-(xs|sm|base|md|lg|\dxl|xl):\s*(\d+)px/g)) tokens.set(name, Number(px));
  return tokens;
}

test('font-size tokens sit on the seven-step scale', () => {
  const tokens = fontTokens();
  assert.ok(tokens.size >= 7, 'tokens.css defines the font scale');
  for (const [name, px] of tokens) assert.ok(SCALE.has(px), `--font-${name} is ${px}px`);
  assert.equal(tokens.get('base'), 14, 'body text is 14px');
  assert.equal(tokens.get('xs'), 12, 'secondary labels are 12px');
});

test('every stylesheet font size uses a scale token or a scale value', () => {
  const tokens = fontTokens();
  const problems = [];
  for (const file of walk(SRC, ['.css'])) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (EXEMPT_FILES.has(rel)) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (line.includes('scale-exempt')) return;
      const where = `${rel}:${index + 1}`;
      for (const [, raw] of line.matchAll(/font-size:\s*([^;}]+)/g)) {
        const value = raw.replace(/!important/, '').trim();
        const token = value.match(/^var\(--font-([a-z0-9]+)\)$/);
        const px = value.match(/^(\d+(?:\.\d+)?)px$/);
        const ok = value === 'inherit' || (token && tokens.has(token[1])) || (px && SCALE.has(Number(px[1])));
        if (!ok) problems.push(`${where} font-size: ${value}`);
      }
      for (const [, size] of line.matchAll(/font:\s*(?:[a-z]+\s+)?(?:\d{3}\s+)?([^\s/;]+)/g)) {
        if (size.startsWith('var(--font-') || size === 'inherit') continue;
        const px = size.match(/^(\d+(?:\.\d+)?)px$/);
        if (!px || !SCALE.has(Number(px[1]))) problems.push(`${where} font: ${size}`);
      }
    });
  }
  assert.deepEqual(problems, [], `font sizes off the 12/14/16/18/20/24/32 scale:\n${problems.join('\n')}`);
});

test('chart and inline-style font sizes stay on the scale', () => {
  const problems = [];
  for (const file of walk(SRC, ['.js', '.jsx'])) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    const text = fs.readFileSync(file, 'utf8');
    for (const [, size] of text.matchAll(/[Ff]ont\s*:\s*\{[^}]*\bsize:\s*(\d+)/g)) if (!SCALE.has(Number(size))) problems.push(`${rel} chart font ${size}`);
    for (const [, size] of text.matchAll(/titleFont\s*:\s*\{[^}]*\bsize:\s*(\d+)|bodyFont\s*:\s*\{[^}]*\bsize:\s*(\d+)/g)) if (size && !SCALE.has(Number(size))) problems.push(`${rel} chart font ${size}`);
    for (const [, size] of text.matchAll(/fontSize:\s*['"]?(\d+)(?:px)?['"]?/g)) if (!SCALE.has(Number(size))) problems.push(`${rel} inline fontSize ${size}`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

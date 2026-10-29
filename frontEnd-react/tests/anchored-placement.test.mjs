import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAnchoredPlacement } from '../src/utils/anchoredPlacement.js';

const phone = { viewportWidth: 390, viewportHeight: 800 };
const rect = (left, width, top = 200, height = 40) => ({ left, right: left + width, top, bottom: top + height });

test('a right-aligned menu on a left-hand trigger flips to the left edge instead of leaving the screen', () => {
  // "Ví: Mọi ví" sits in the first column; its menu is wider than the space to its left.
  const placement = computeAnchoredPlacement({ ...phone, anchor: rect(28, 110), menuWidth: 300, prefer: 'right' });
  assert.equal(placement.offsetLeft, 0);
  assert.equal(placement.width, 300);
});

test('a right-hand trigger keeps the preferred right alignment when it fits', () => {
  const placement = computeAnchoredPlacement({ ...phone, anchor: rect(170, 190), menuWidth: 240, prefer: 'right' });
  assert.equal(placement.offsetLeft, 190 - 240);
});

test('a left-aligned menu near the right edge flips to the right side', () => {
  const placement = computeAnchoredPlacement({ ...phone, anchor: rect(250, 120), menuWidth: 220, prefer: 'left' });
  assert.equal(placement.offsetLeft, 120 - 220);
});

test('when neither side fits the menu is clamped inside the viewport edges', () => {
  const anchor = rect(150, 60);
  const placement = computeAnchoredPlacement({ ...phone, anchor, menuWidth: 340, prefer: 'right' });
  const screenLeft = anchor.left + placement.offsetLeft;
  assert.ok(screenLeft >= 16, `left edge ${screenLeft}`);
  assert.ok(screenLeft + placement.width <= 390 - 16, `right edge ${screenLeft + placement.width}`);
});

test('a menu wider than the viewport is narrowed to fit', () => {
  const placement = computeAnchoredPlacement({ ...phone, anchor: rect(20, 100), menuWidth: 600 });
  assert.equal(placement.width, 358);
  assert.equal(placement.maxWidth, 358);
  assert.equal(20 + placement.offsetLeft, 16);
});

test('opens above only when there is more room above than below', () => {
  const low = rect(20, 100, 700);
  assert.equal(computeAnchoredPlacement({ ...phone, anchor: low, menuWidth: 200, menuHeight: 280 }).above, true);
  const high = rect(20, 100, 100);
  assert.equal(computeAnchoredPlacement({ ...phone, anchor: high, menuWidth: 200, menuHeight: 280 }).above, false);
});

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

// Desktop dialog: 500px card centred in a 1440×900 window, 24px body padding, two 219px columns.
const desktop = { viewportWidth: 1440, viewportHeight: 900 };
const card = { left: 470, right: 970 };

test('a calendar under a right-hand dialog field opens leftwards so it stays inside the card', () => {
  const anchor = rect(card.left + 255, 219, 520, 42);
  const placement = computeAnchoredPlacement({ ...desktop, anchor, menuWidth: 300, menuHeight: 330, boundary: card });
  assert.equal(placement.left, anchor.right - 300);
  assert.ok(placement.left >= card.left && placement.left + 300 <= card.right);
});

test('a calendar under a left-hand dialog field keeps the left alignment', () => {
  const anchor = rect(card.left + 24, 219, 520, 42);
  const placement = computeAnchoredPlacement({ ...desktop, anchor, menuWidth: 300, menuHeight: 330, boundary: card });
  assert.equal(placement.left, anchor.left);
});

test('a menu wider than the dialog may leave the card but never the screen', () => {
  const narrowCard = { left: 600, right: 840 };
  const anchor = rect(620, 200, 300, 42);
  const placement = computeAnchoredPlacement({ ...desktop, anchor, menuWidth: 300, menuHeight: 200, boundary: narrowCard });
  assert.equal(placement.left, anchor.left);
  assert.ok(placement.left + placement.width <= 1440 - 16);
});

test('fixed placement opens below with the screen top right under the anchor', () => {
  const anchor = rect(700, 219, 300, 42);
  const placement = computeAnchoredPlacement({ ...desktop, anchor, menuWidth: 300, menuHeight: 330, boundary: card });
  assert.equal(placement.above, false);
  assert.equal(placement.top, anchor.bottom + 6);
  assert.equal(placement.maxHeight, null);
});

test('fixed placement opens above a low anchor and ends just above it', () => {
  const anchor = rect(700, 219, 700, 42);
  const placement = computeAnchoredPlacement({ ...desktop, anchor, menuWidth: 300, menuHeight: 330, boundary: card });
  assert.equal(placement.above, true);
  assert.equal(placement.top + 330, anchor.top - 6);
});

test('a tall menu on a short screen scrolls inside the room it has instead of leaving the screen', () => {
  const short = { viewportWidth: 1280, viewportHeight: 600 };
  const anchor = rect(600, 219, 380, 42);
  const placement = computeAnchoredPlacement({ ...short, anchor, menuWidth: 300, menuHeight: 400 });
  assert.equal(placement.above, true);
  assert.equal(placement.maxHeight, 380 - 6 - 16);
  assert.equal(placement.top, 16);
});

test('with almost no room on either side the menu keeps a usable height and stays on screen', () => {
  const tiny = { viewportWidth: 800, viewportHeight: 360 };
  const anchor = rect(300, 200, 150, 42);
  const placement = computeAnchoredPlacement({ ...tiny, anchor, menuWidth: 280, menuHeight: 340 });
  assert.equal(placement.maxHeight, 160);
  assert.ok(placement.top >= 16);
  assert.ok(placement.top + placement.maxHeight <= 360 - 16);
});

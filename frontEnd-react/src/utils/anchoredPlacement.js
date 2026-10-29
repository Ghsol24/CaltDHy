// Pure geometry for menus anchored to a trigger (kept free of React so it can be unit tested).
export const VIEWPORT_EDGE = 16;
export const ANCHOR_GAP = 6;

/**
 * Where a menu of the given size should sit next to its anchor so it stays on screen.
 * Returns `offsetLeft` (menu left edge relative to the anchor's left edge), the `width`
 * to pin (so moving the menu cannot reflow it), `maxWidth` and whether it opens above.
 *
 * The preferred side is tried first; if the menu would leave the viewport it flips, and
 * when neither side fits it is clamped between the viewport edges.
 */
export function computeAnchoredPlacement({
  anchor,
  menuWidth,
  menuHeight = 0,
  viewportWidth,
  viewportHeight,
  prefer = 'left',
  edge = VIEWPORT_EDGE,
  gap = ANCHOR_GAP,
}) {
  const maxWidth = Math.max(0, viewportWidth - edge * 2);
  const width = Math.min(menuWidth, maxWidth);
  const minLeft = edge;
  const maxLeft = viewportWidth - edge - width;

  const leftAligned = anchor.left;
  const rightAligned = anchor.right - width;
  const fits = (left) => left >= minLeft && left <= maxLeft;
  const [first, second] = prefer === 'right' ? [rightAligned, leftAligned] : [leftAligned, rightAligned];
  let left = fits(first) ? first : fits(second) ? second : first;
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

  const spaceBelow = viewportHeight - anchor.bottom - gap - edge;
  const spaceAbove = anchor.top - gap - edge;
  const above = menuHeight > spaceBelow && spaceAbove > spaceBelow;

  return { offsetLeft: Math.round(left - anchor.left), width, maxWidth, above };
}

// Pure geometry for menus anchored to a trigger (kept free of React so it can be unit tested).
const VIEWPORT_EDGE = 16;
export const ANCHOR_GAP = 6;
// Below this much room on either side a menu is moved over its anchor rather than squeezed.
const MIN_MENU_HEIGHT = 160;

/**
 * Where a menu of the given size should sit next to its anchor so it stays on screen.
 * Returns `offsetLeft` (menu left edge relative to the anchor's left edge), the `width`
 * to pin (so moving the menu cannot reflow it), `maxWidth` and whether it opens above.
 * For menus positioned against the viewport (`position: fixed`) it also returns the
 * screen `left` / `top` and a `maxHeight` when the menu has to scroll to fit.
 *
 * The preferred side is tried first; if the menu would leave the viewport it flips, and
 * when neither side fits it is clamped between the viewport edges. With a `boundary`
 * (the dialog the trigger sits in) a side that keeps the menu inside the dialog wins,
 * so a calendar under a right-hand field opens leftwards instead of hanging off the card.
 */
export function computeAnchoredPlacement({
  anchor,
  menuWidth,
  menuHeight = 0,
  viewportWidth,
  viewportHeight,
  prefer = 'left',
  boundary,
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
  const fitsBoundary = (left) => Boolean(boundary)
    && left >= Math.max(boundary.left, minLeft) && left + width <= Math.min(boundary.right, viewportWidth - edge);
  const [first, second] = prefer === 'right' ? [rightAligned, leftAligned] : [leftAligned, rightAligned];
  let left = fitsBoundary(first) ? first
    : fitsBoundary(second) ? second
      : fits(first) ? first : fits(second) ? second : first;
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

  const spaceBelow = viewportHeight - anchor.bottom - gap - edge;
  const spaceAbove = anchor.top - gap - edge;
  const above = menuHeight > spaceBelow && spaceAbove > spaceBelow;

  const fullHeight = Math.min(menuHeight, Math.max(0, viewportHeight - edge * 2));
  const room = above ? spaceAbove : spaceBelow;
  const height = Math.min(fullHeight, Math.max(room, MIN_MENU_HEIGHT));
  const preferredTop = above ? anchor.top - gap - height : anchor.bottom + gap;
  const top = Math.min(Math.max(preferredTop, edge), Math.max(edge, viewportHeight - edge - height));

  return {
    offsetLeft: Math.round(left - anchor.left),
    left: Math.round(left),
    top: Math.round(top),
    width,
    maxWidth,
    maxHeight: height < menuHeight ? Math.floor(height) : null,
    above,
  };
}

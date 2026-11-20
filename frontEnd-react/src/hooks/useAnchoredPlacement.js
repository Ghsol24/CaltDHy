import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ANCHOR_GAP, computeAnchoredPlacement } from '../utils/anchoredPlacement';

const SCROLLABLE = /(auto|scroll|overlay)/;

function scrollParentOf(node) {
  for (let el = node?.parentElement; el && el !== document.body; el = el.parentElement) {
    if (SCROLLABLE.test(getComputedStyle(el).overflowY)) return el;
  }
  return null;
}

/**
 * Keeps an anchored menu inside the viewport. Returns a style object for the menu.
 *
 * `strategy: 'absolute'` (default): the menu is rendered inside the anchor element (its
 * containing block) and only its side and above/below are adjusted.
 *
 * `strategy: 'fixed'`: the menu stays in the DOM where it is (so focus traps, aria-modal and
 * `contains()` checks keep working) but is placed with `position: fixed` in screen
 * coordinates, so the scroll area of a dialog can neither clip it nor scroll sideways to
 * show it. It prefers to stay inside the dialog the anchor sits in, follows the anchor while
 * anything scrolls or resizes, and calls `onAnchorHidden` once the anchor scrolls out of view.
 * `matchWidth` pins the menu to the anchor's width; `maxHeight` caps its natural height.
 */
export function useAnchoredPlacement(anchorRef, menuRef, isOpen, {
  prefer = 'left',
  strategy = 'absolute',
  matchWidth = false,
  maxHeight: maxHeightCap,
  onAnchorHidden,
} = {}) {
  const [style, setStyle] = useState(null);
  const hiddenRef = useRef(onAnchorHidden);
  hiddenRef.current = onAnchorHidden;
  const fixed = strategy === 'fixed';

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const anchorRect = anchor.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!fixed) {
      const { offsetLeft, width, maxWidth, above } = computeAnchoredPlacement({
        anchor: anchorRect,
        menuWidth: menu.offsetWidth,
        menuHeight: menu.offsetHeight,
        viewportWidth,
        viewportHeight,
        prefer,
      });
      setStyle({
        left: offsetLeft,
        right: 'auto',
        width,
        maxWidth,
        ...(above ? { top: 'auto', bottom: `calc(100% + ${ANCHOR_GAP}px)` } : {}),
      });
      return;
    }

    // Switch to fixed before measuring: offsetParent and the natural width depend on it.
    // No transitions: with reduced motion every element gets a tiny transition on `all`,
    // which would slide the menu in from where it sat before it was placed.
    if (menu.style.position !== 'fixed') {
      menu.style.position = 'fixed';
      menu.style.transitionProperty = 'none';
    }
    // Natural size: scrollHeight ignores any max-height applied by an earlier placement.
    const borders = menu.offsetHeight - menu.clientHeight;
    const naturalHeight = menu.scrollHeight + borders;
    const menuHeight = maxHeightCap ? Math.min(naturalHeight, maxHeightCap) : naturalHeight;
    const dialog = anchor.closest('[role="dialog"]');
    const placement = computeAnchoredPlacement({
      anchor: anchorRect,
      menuWidth: matchWidth ? anchorRect.width : menu.offsetWidth,
      menuHeight,
      viewportWidth,
      viewportHeight,
      prefer,
      boundary: dialog ? dialog.getBoundingClientRect() : undefined,
    });

    // A transformed or filtered ancestor becomes the containing block of a fixed element
    // (dialog backdrops use backdrop-filter); offsetParent names it, so convert to its box.
    let originX = 0;
    let originY = 0;
    const containingBlock = menu.offsetParent;
    if (containingBlock && containingBlock !== document.body && containingBlock !== document.documentElement) {
      const box = containingBlock.getBoundingClientRect();
      originX = box.left + containingBlock.clientLeft - containingBlock.scrollLeft;
      originY = box.top + containingBlock.clientTop - containingBlock.scrollTop;
    }

    const next = {
      position: 'fixed',
      transitionProperty: 'none',
      top: placement.top - originY,
      left: placement.left - originX,
      right: 'auto',
      bottom: 'auto',
      width: placement.width,
      maxWidth: placement.maxWidth,
      maxHeight: placement.maxHeight ?? maxHeightCap ?? 'none',
      ...(placement.maxHeight ? { overflowY: 'auto' } : {}),
    };
    setStyle((previous) => (
      previous && Object.keys(next).every((key) => previous[key] === next[key])
        && Object.keys(previous).length === Object.keys(next).length ? previous : next
    ));
  }, [anchorRef, menuRef, prefer, fixed, matchWidth, maxHeightCap]);

  // Measure before paint so the menu never flashes off screen.
  useLayoutEffect(() => {
    if (!isOpen) {
      setStyle(null);
      return undefined;
    }
    place();
    if (!fixed) {
      window.addEventListener('resize', place);
      return () => window.removeEventListener('resize', place);
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const anchor = anchorRef.current;
      if (anchor && hiddenRef.current) {
        const rect = anchor.getBoundingClientRect();
        const area = scrollParentOf(anchor)?.getBoundingClientRect()
          || { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
        if (rect.bottom <= area.top || rect.top >= area.bottom || rect.right <= area.left || rect.left >= area.right) {
          hiddenRef.current();
          return;
        }
      }
      place();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onScroll = (event) => {
      // Scrolling inside the menu itself does not move its anchor.
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      schedule();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (menuRef.current) observer?.observe(menuRef.current);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isOpen, place, fixed, anchorRef, menuRef]);

  return style;
}

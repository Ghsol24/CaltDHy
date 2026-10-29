import { useCallback, useLayoutEffect, useState } from 'react';
import { ANCHOR_GAP, computeAnchoredPlacement } from '../utils/anchoredPlacement';

/**
 * Keeps an absolutely positioned menu inside the viewport. The menu must be rendered
 * inside the anchor element (its containing block). Returns a style object for the menu.
 */
export function useAnchoredPlacement(anchorRef, menuRef, isOpen, { prefer = 'left' } = {}) {
  const [style, setStyle] = useState(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const { offsetLeft, width, maxWidth, above } = computeAnchoredPlacement({
      anchor: anchor.getBoundingClientRect(),
      menuWidth: menu.offsetWidth,
      menuHeight: menu.offsetHeight,
      viewportWidth: document.documentElement.clientWidth || window.innerWidth,
      viewportHeight: window.innerHeight,
      prefer,
    });
    setStyle({
      left: offsetLeft,
      right: 'auto',
      width,
      maxWidth,
      ...(above ? { top: 'auto', bottom: `calc(100% + ${ANCHOR_GAP}px)` } : {}),
    });
  }, [anchorRef, menuRef, prefer]);

  // Measure before paint so the menu never flashes off screen.
  useLayoutEffect(() => {
    if (!isOpen) {
      setStyle(null);
      return undefined;
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isOpen, place]);

  return style;
}

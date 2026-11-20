import React, { useRef } from 'react';
import { useAnchoredPlacement } from '../../hooks/useAnchoredPlacement';

/**
 * A dropdown menu fixed to the screen under (or above) `anchorRef`, as wide as the anchor.
 * It stays in the DOM where it is rendered, so outside-click checks and dialog focus traps
 * keep treating it as part of its field, but a scrolling dialog body cannot clip it.
 * Render it only while open; `onAnchorHidden` runs when the anchor scrolls out of view.
 */
export function AnchoredMenu({ anchorRef, onAnchorHidden, maxHeight = 240, className, children, ...rest }) {
  const menuRef = useRef(null);
  const style = useAnchoredPlacement(anchorRef, menuRef, true, {
    strategy: 'fixed',
    matchWidth: true,
    maxHeight,
    onAnchorHidden,
  });
  return (
    <div ref={menuRef} className={className} style={style || undefined} {...rest}>
      {children}
    </div>
  );
}

import { useCallback, useRef, useState } from 'react';

const INTERACTIVE = 'button, a, input, select, textarea, [role="button"]';

/**
 * Drag-down-to-dismiss for bottom sheets. Spread `handlers` on the grabber/header zone
 * (give it `touch-action: none`) and apply `offset` as a translateY on the sheet.
 */
export function useSheetDrag(onDismiss, { enabled = true, distance = 96 } = {}) {
  const [offset, setOffset] = useState(0);
  const startRef = useRef(null);
  const offsetRef = useRef(0);

  const onPointerDown = useCallback((event) => {
    if (!enabled || event.button > 0 || event.target.closest(INTERACTIVE)) return;
    startRef.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [enabled]);

  const onPointerMove = useCallback((event) => {
    if (startRef.current === null) return;
    offsetRef.current = Math.max(0, event.clientY - startRef.current);
    setOffset(offsetRef.current);
  }, []);

  const end = useCallback(() => {
    if (startRef.current === null) return;
    startRef.current = null;
    const shouldDismiss = offsetRef.current > distance;
    offsetRef.current = 0;
    setOffset(0);
    if (shouldDismiss) onDismiss();
  }, [distance, onDismiss]);

  return { offset, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end } };
}

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]';
const EDGE_GAP = 16;
const ANCHOR_GAP = 8;

/** Keep scrolling updates inside the floating menu, away from the financial panel. */
export function CashFlowPopover({ id, name, triggersRef, onClose, children }) {
  const isMobile = useIsMobile(599);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const schedulePositionRef = useRef(null);
  const [position, setPosition] = useState({ top: EDGE_GAP, left: EDGE_GAP });

  useBodyScrollLock(isMobile);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const content = contentRef.current;
    const trigger = triggersRef.current[name];
    if (isMobile || !panel || !content || !trigger) return undefined;

    let frame = 0;
    let naturalHeight = 0;
    let measureSize = true;

    const updatePosition = () => {
      frame = 0;
      if (measureSize) {
        const styles = getComputedStyle(panel);
        // Observe unclipped content: the menu's viewport cap must not feed back into placement.
        naturalHeight = content.getBoundingClientRect().height
          + ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
            .reduce((sum, property) => sum + (parseFloat(styles[property]) || 0), 0);
        measureSize = false;
      }
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(name === 'display' ? 344 : 304, window.innerWidth - EDGE_GAP * 2);
      const height = Math.min(naturalHeight, Math.max(0, window.innerHeight - EDGE_GAP * 2));
      const below = window.innerHeight - rect.bottom - EDGE_GAP - ANCHOR_GAP;
      const above = rect.top - EDGE_GAP - ANCHOR_GAP;
      const placeBelow = below >= height || (above < height && below >= above);
      const preferredTop = placeBelow ? rect.bottom + ANCHOR_GAP : rect.top - height - ANCHOR_GAP;
      const top = Math.max(EDGE_GAP, Math.min(preferredTop, window.innerHeight - height - EDGE_GAP));
      const left = Math.max(EDGE_GAP, Math.min(rect.right - width, window.innerWidth - width - EDGE_GAP));
      setPosition((previous) => previous.top === top && previous.left === left ? previous : { top, left });
    };
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(updatePosition);
    };
    const handleScroll = (event) => {
      // Scrolling the menu itself does not move its anchor.
      if (event.target instanceof Node && panel.contains(event.target)) return;
      schedulePosition();
    };
    const handleResize = () => {
      measureSize = true;
      schedulePosition();
    };
    const observer = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === content)) measureSize = true;
      schedulePosition();
    });
    observer.observe(content);
    observer.observe(trigger);
    schedulePositionRef.current = schedulePosition;
    updatePosition();
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      schedulePositionRef.current = null;
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isMobile, name, triggersRef]);

  // Preference or period changes may move the anchor even without changing its size.
  useLayoutEffect(() => { schedulePositionRef.current?.(); }, [children]);

  useEffect(() => {
    const panel = panelRef.current;
    const trigger = triggersRef.current[name];
    const first = panel?.querySelector('input[type="radio"]:checked')
      || panel?.querySelector('input[type="date"]') || panel?.querySelector(FOCUSABLE);
    first?.focus({ preventScroll: true });

    const handlePointer = (event) => {
      if (!panel?.contains(event.target) && !trigger?.contains(event.target)) onClose();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab' || !isMobile || !panel) return;
      const focusable = [...panel.querySelectorAll(FOCUSABLE)].filter((node) => (
        node.getClientRects().length > 0 && (node.type !== 'radio' || node.checked)
      ));
      const firstNode = focusable[0];
      const lastNode = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault(); lastNode?.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault(); firstNode?.focus();
      }
    };
    const handleFocus = (event) => {
      if (!isMobile && !panel?.contains(event.target) && !trigger?.contains(event.target)) onClose();
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('focusin', handleFocus);
      // Preserve focus on an outside control; dismissal returns to the opener.
      if (trigger?.isConnected && (document.activeElement === document.body || panel?.contains(document.activeElement))) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [isMobile, name, onClose, triggersRef]);

  return createPortal(
    <div className={`cashflow-overlay${isMobile ? ' cashflow-overlay--sheet' : ''}`}>
      <section ref={panelRef} id={id} className={`cashflow-popover cashflow-popover--${name}`}
        data-testid="cashflow-popover" data-popover={name} role="dialog" aria-modal={isMobile || undefined}
        aria-labelledby={`${id}-title`} style={isMobile ? undefined : {
          top: position.top, left: position.left, maxHeight: `calc(100dvh - ${EDGE_GAP * 2}px)`,
        }}>
        <div ref={contentRef}>{children}</div>
      </section>
    </div>, document.body,
  );
}

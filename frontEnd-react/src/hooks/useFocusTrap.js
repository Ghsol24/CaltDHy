import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open traps, newest last. Only the top one reacts to Tab and Escape, so a
// confirm dialog opened over a modal doesn't fight the modal for focus.
const openTraps = [];

const isVisible = (el) => el.getClientRects().length > 0;

/**
 * Keeps keyboard focus inside `containerRef` while `isOpen`.
 *
 * - focuses `initialFocusRef` (or the first focusable, or the container) on open
 * - Tab / Shift+Tab wrap inside; focus that escaped is pulled back in
 * - Escape calls `onEscape` unless an inner control already handled it
 * - restores focus to the opener on close; when the opener is gone (e.g. a
 *   menu item whose menu closed), to `returnFocusRef` instead
 */
export function useFocusTrap(containerRef, isOpen, { onEscape, initialFocusRef, returnFocusRef, restoreFocus = true } = {}) {
  // Latest callback without re-running the effect (which would move focus again).
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const container = containerRef.current;
    if (!isOpen || !container) return undefined;

    const trap = {};
    openTraps.push(trap);
    const previousFocus = document.activeElement;
    const focusables = () => [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(isVisible);
    const focus = (el) => el?.focus({ preventScroll: true });

    if (!container.contains(document.activeElement)) {
      focus(initialFocusRef?.current || focusables()[0] || container);
    }

    const handleKeyDown = (event) => {
      if (openTraps[openTraps.length - 1] !== trap || event.defaultPrevented) return;
      if (event.key === 'Escape' && escapeRef.current) {
        event.preventDefault();
        escapeRef.current(event);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        focus(container);
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const atEdge = event.shiftKey ? active === first || active === container : active === last;
      if (!container.contains(active) || atEdge) {
        event.preventDefault();
        focus(event.shiftKey ? last : first);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openTraps.splice(openTraps.indexOf(trap), 1);
      if (!restoreFocus) return;
      const opener = previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : returnFocusRef?.current;
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, [isOpen, containerRef, initialFocusRef, returnFocusRef, restoreFocus]);
}

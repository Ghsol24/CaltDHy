import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

/**
 * Modal shell shared by the app's dialogs. It owns the behaviour every modal
 * needs — backdrop, role/aria, focus trap, Escape, backdrop click, page
 * scroll lock, optional portal — and nothing visual: each dialog passes its
 * own classes, so moving a dialog onto this keeps its look.
 *
 * While `busy` (e.g. saving), Escape and backdrop clicks are ignored.
 * `autoFocus="container"` focuses the panel itself so a screen reader reads
 * the title first; the default focuses the first control.
 */
export function Dialog({
  isOpen,
  onClose,
  busy = false,
  labelledBy,
  describedBy,
  label,
  className,
  overlayClassName,
  panelRef,
  overlayRef,
  initialFocusRef,
  returnFocusRef,
  autoFocus = 'first',
  closeOnBackdrop = true,
  closeOnEscape = true,
  portal = true,
  as: Panel = 'div',
  panelProps,
  children,
}) {
  const ownRef = useRef(null);
  const ref = panelRef || ownRef;
  const close = () => {
    if (!busy) onClose?.();
  };

  useFocusTrap(ref, isOpen, {
    onEscape: closeOnEscape ? close : undefined,
    initialFocusRef: initialFocusRef || (autoFocus === 'container' ? ref : undefined),
    returnFocusRef,
  });
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const dialog = (
    <div
      className={overlayClassName}
      ref={overlayRef}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) close();
      }}
    >
      <Panel
        ref={ref}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={label}
        aria-busy={busy || undefined}
        tabIndex={-1}
        {...panelProps}
      >
        {children}
      </Panel>
    </div>
  );

  return portal ? createPortal(dialog, document.body) : dialog;
}

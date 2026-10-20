import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useTranslation } from '../../i18n/useTranslation';
import { CloseOutlineIcon } from '../../components/ui/AppIcons';
import './jar-dialog.css';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Render outside the animated page so the viewport and topbar cannot clip dialogs. */
export function JarDialog({ isOpen, onClose, title, subtitle, children, footer, className = '', busy = false, initialFocusRef }) {
  const { t } = useTranslation();
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const stateRef = useRef({ onClose, busy });
  stateRef.current = { onClose, busy };
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const viewport = window.visualViewport;
    const fitViewport = () => {
      const overlay = overlayRef.current;
      if (!overlay || !viewport) return;
      overlay.style.setProperty('--jar-viewport-height', `${viewport.height}px`);
      overlay.style.setProperty('--jar-viewport-top', `${viewport.offsetTop}px`);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    const frame = requestAnimationFrame(() => {
      (initialFocusRef?.current || dialogRef.current)?.focus({ preventScroll: true });
    });
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!stateRef.current.busy) stateRef.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])]
        .filter(node => node.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialogRef.current?.focus({ preventScroll: true }); return; }
      if (!items.includes(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;
  return createPortal(
    <div className="jar-dialog-backdrop" ref={overlayRef} onClick={event => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className={`jar-dialog ${className}`} ref={dialogRef} tabIndex={-1} role="dialog"
        aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? subtitleId : undefined} aria-busy={busy}>
        <header className="jar-dialog-header">
          <div><h2 id={titleId}>{title}</h2>{subtitle && <p id={subtitleId}>{subtitle}</p>}</div>
          <button className="jar-dialog-close" type="button" aria-label={t('common.close')} disabled={busy} onClick={onClose}>
            <CloseOutlineIcon size={20} />
          </button>
        </header>
        <div className="jar-dialog-body">{children}</div>
        {footer && <footer className="jar-dialog-footer">{footer}</footer>}
      </section>
    </div>, document.body
  );
}

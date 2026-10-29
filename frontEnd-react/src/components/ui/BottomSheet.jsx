import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useTranslation } from '../../i18n/useTranslation';
import './bottom-sheet.css';

/**
 * Mobile bottom sheet: slides up over a dimmed page instead of pushing content down.
 * Escape, the backdrop and the close button all call `onClose`; focus is trapped while
 * open and returns to the opener afterwards.
 */
export function BottomSheet({ open, onClose, title, children, footer, className = '', testId }) {
  const { t } = useTranslation();
  const titleId = useId();
  const sheetRef = useRef(null);
  useFocusTrap(sheetRef, open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="calt-sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={sheetRef} className={`calt-sheet ${className}`.trim()} role="dialog" aria-modal="true"
        aria-labelledby={titleId} data-testid={testId}>
        <span className="calt-sheet-handle" aria-hidden="true" />
        <header className="calt-sheet-header">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="calt-sheet-close" onClick={onClose} aria-label={t('common.close')}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="calt-sheet-body">{children}</div>
        {footer && <footer className="calt-sheet-footer">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}

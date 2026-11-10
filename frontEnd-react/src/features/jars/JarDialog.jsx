import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { CloseOutlineIcon } from '../../components/ui/AppIcons';
import { Dialog } from '../../components/ui/Dialog';
import { IconButton } from '../../components/ui/Button';
import './jar-dialog.css';

/**
 * Titled dialog for the jar flows. Behaviour (portal, focus trap, Escape,
 * backdrop, scroll lock) comes from the shared <Dialog>; this adds the jar
 * header/footer layout and keeps the dialog inside the visual viewport while
 * the on-screen keyboard is open.
 */
export function JarDialog({ isOpen, onClose, title, subtitle, children, footer, className = '', busy = false, initialFocusRef }) {
  const { t } = useTranslation();
  const titleId = useId();
  const subtitleId = useId();
  const overlayRef = useRef(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!isOpen || !viewport) return undefined;
    const fitViewport = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.style.setProperty('--jar-viewport-height', `${viewport.height}px`);
      overlay.style.setProperty('--jar-viewport-top', `${viewport.offsetTop}px`);
    };
    fitViewport();
    viewport.addEventListener('resize', fitViewport);
    viewport.addEventListener('scroll', fitViewport);
    return () => {
      viewport.removeEventListener('resize', fitViewport);
      viewport.removeEventListener('scroll', fitViewport);
    };
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      busy={busy}
      as="section"
      overlayClassName="jar-dialog-backdrop"
      overlayRef={overlayRef}
      className={`jar-dialog ${className}`}
      labelledBy={titleId}
      describedBy={subtitle ? subtitleId : undefined}
      initialFocusRef={initialFocusRef}
      autoFocus="container"
    >
      <header className="jar-dialog-header">
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p id={subtitleId}>{subtitle}</p>}</div>
        <IconButton className="jar-dialog-close" label={t('common.close')} disabled={busy} onClick={onClose}>
          <CloseOutlineIcon size={20} />
        </IconButton>
      </header>
      <div className="jar-dialog-body">{children}</div>
      {footer && <footer className="jar-dialog-footer">{footer}</footer>}
    </Dialog>
  );
}

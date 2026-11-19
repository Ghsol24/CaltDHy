import React, { useId } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './AppIcons';
import { useTranslation } from '../../i18n/useTranslation';
import { BREAKPOINTS, useMediaQuery } from '../../hooks/useMediaQuery';
import { useSheetDrag } from '../../hooks/useSheetDrag';

// Matches the CSS breakpoint where the dialog becomes a bottom sheet (form-dialog-shell.css).
const PHONE_QUERY = `(max-width: ${BREAKPOINTS.phone}px)`;

const cx = (...names) => names.filter(Boolean).join(' ');

/**
 * The one look shared by the app's form dialogs (audit 7d, X-12 / FORM-03):
 * a header with the title, an optional one-line subtitle and a single ✕,
 * a scrolling body and a footer with [Cancel] [Primary action].
 * Desktop: a 500px card. Phones: a bottom sheet with a grabber that can be
 * dragged down to dismiss. Always portalled to <body>, so the topbar and the
 * bottom navigation never sit on top of it.
 *
 * Behaviour (focus trap, Escape, backdrop click, scroll lock) comes from
 * <Dialog>. Children are the body and footer, usually inside a <form>:
 *   <FormDialog title=… onClose=…>
 *     <form><DialogBody>…</DialogBody><DialogFooter>…</DialogFooter></form>
 *   </FormDialog>
 *
 * The shell keeps the `txn-modal-*` class names it grew out of (the transaction
 * form); tests and the phone sheet rules hook onto them.
 */
export function FormDialog({
  isOpen = true,
  onClose,
  onEscape,
  onCloseButton,
  busy = false,
  closeDisabled = false,
  title,
  subtitle,
  titleId,
  className,
  panelRef,
  overlayRef,
  returnFocusRef,
  initialFocusRef,
  autoFocus,
  swipeToClose = true,
  headerInert = false,
  panelProps,
  children,
}) {
  const { t } = useTranslation();
  const ownTitleId = useId();
  const subtitleId = useId();
  const headingId = titleId || ownTitleId;
  const isPhone = useMediaQuery(PHONE_QUERY);
  const dismiss = () => {
    if (!busy) onClose?.();
  };
  const sheetDrag = useSheetDrag(dismiss, { enabled: isPhone && swipeToClose && !busy });
  const dragStyle = sheetDrag.offset ? { '--sheet-drag-offset': `${sheetDrag.offset}px` } : undefined;
  const mergedPanelProps = dragStyle
    ? { ...panelProps, style: { ...panelProps?.style, ...dragStyle } }
    : panelProps;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      onEscape={onEscape}
      busy={busy}
      panelRef={panelRef}
      overlayRef={overlayRef}
      returnFocusRef={returnFocusRef}
      initialFocusRef={initialFocusRef}
      autoFocus={autoFocus}
      overlayClassName="txn-modal-backdrop"
      className={cx('txn-modal-card', className, sheetDrag.offset ? 'is-dragging' : '')}
      labelledBy={headingId}
      describedBy={subtitle ? subtitleId : undefined}
      panelProps={mergedPanelProps}
    >
      <div className="txn-modal-handle-zone" inert={headerInert ? true : undefined} {...(isPhone && swipeToClose ? sheetDrag.handlers : {})}>
        <span className="txn-modal-grabber" aria-hidden="true" />
        <div className={cx('txn-modal-header', subtitle ? 'txn-modal-header--subtitle' : '')}>
          <div className="txn-modal-heading">
            <h2 id={headingId} className="txn-modal-title">{title}</h2>
            {subtitle && <p id={subtitleId} className="txn-modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={onCloseButton || onClose}
            disabled={busy || closeDisabled}
            aria-label={t('common.closeWindow')}
          >
            <Icon name="close" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </div>
      </div>
      {children}
    </Dialog>
  );
}

export function DialogBody({ className, children, ...rest }) {
  return <div className={cx('txn-modal-body', className)} {...rest}>{children}</div>;
}

/** [Cancel] [Primary action], no icons; a Delete button (when editing) goes first and sits apart on the left. */
export function DialogFooter({ className, children, ...rest }) {
  return <div className={cx('txn-modal-footer', className)} {...rest}>{children}</div>;
}

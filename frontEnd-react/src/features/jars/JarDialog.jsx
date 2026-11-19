import React from 'react';
import { FormDialog, DialogBody, DialogFooter } from '../../components/ui/FormDialog';
import './jar-dialog.css';

/**
 * Titled dialog for the jar flows (create / edit, details, deposit / withdraw).
 * Since audit 7d it is the shared <FormDialog> shell — same header, ✕, 500px
 * card and phone bottom sheet as every other form — with the jar hooks kept
 * as extra classes (jar-dialog, jar-dialog-body, jar-dialog-footer).
 * The footer sits outside the body; submit buttons point at the form with
 * `form={formId}`.
 */
export function JarDialog({ isOpen, onClose, title, subtitle, children, footer, className = '', busy = false, initialFocusRef, returnFocusRef }) {
  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      busy={busy}
      title={title}
      subtitle={subtitle}
      className={`jar-dialog ${className}`.trim()}
      initialFocusRef={initialFocusRef}
      returnFocusRef={returnFocusRef}
      autoFocus="container"
    >
      <DialogBody className="jar-dialog-body">{children}</DialogBody>
      {footer && <DialogFooter className="jar-dialog-footer">{footer}</DialogFooter>}
    </FormDialog>
  );
}

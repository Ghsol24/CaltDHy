import React, { useId } from 'react';
import { Icon } from './AppIcons';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * One field of a form dialog: label, control, then a hint or an error right
 * under the control (audit 7d, FORM-03).
 *
 * - `htmlFor` makes the label a <label>; without it (a group of buttons, a
 *   colour row) the label is a <div> whose id (`labelId`) the group can name
 *   itself with via aria-labelledby.
 * - `optional` adds a muted "Tùy chọn" at the right end of the label row;
 *   required fields say nothing.
 * - `error` replaces the hint, is announced (role="alert") and should be
 *   paired with aria-invalid on the control. Pass a function as children to
 *   get `{ describedBy, invalid }` for the control's ARIA attributes.
 */
export function FormField({ label, htmlFor, labelId, optional = false, hint, error, id, className, children }) {
  const { t } = useTranslation();
  const autoId = useId();
  const base = id || autoId;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const Label = htmlFor ? 'label' : 'div';

  return (
    <div className={className ? `txn-field-group ${className}` : 'txn-field-group'}>
      {label && (
        <Label className="txn-label" htmlFor={htmlFor} id={labelId}>
          <span>{label}</span>
          {optional && <span className="txn-label-optional">{t('transaction.optional')}</span>}
        </Label>
      )}
      {typeof children === 'function' ? children({ describedBy, invalid: Boolean(error) }) : children}
      {error ? (
        <p id={errorId} className="form-field-error" role="alert">
          <Icon name="alertCircle" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="txn-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

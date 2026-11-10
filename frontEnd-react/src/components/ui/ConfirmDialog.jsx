import { getUserErrorMessage } from '../../utils/userErrors.js';
import React, { useRef, useEffect, useCallback } from 'react';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useTranslation } from '../../i18n/useTranslation';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

import { Icon } from './AppIcons';
import { Button } from './Button';
export function ConfirmDialog() {
  const { t } = useTranslation();
  const {
    isOpen,
    isConfirming,
    error,
    title,
    message,
    confirmText,
    cancelText,
    confirmVariant,
    handleConfirm,
    handleCancel,
  } = useConfirmStore();

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);
  useBodyScrollLock(isOpen);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        if (!isConfirming) handleCancel();
      }
    },
    [isOpen, isConfirming, handleCancel]
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConfirming) {
          handleCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="confirm-dialog-header">
          <div
            className={`confirm-dialog-icon confirm-dialog-icon--${confirmVariant || 'danger'}`}
            aria-hidden="true"
          >
            {confirmVariant === 'danger' ? (
              <Icon name="alertTriangle" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <Icon name="info" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </div>
          <h3 id="confirm-dialog-title" className="confirm-dialog-title">
            {title || t('dialog.defaultTitle')}
          </h3>
        </div>

        {message && (
          <p id="confirm-dialog-desc" className="confirm-dialog-message">
            {message}
          </p>
        )}

        {error && <p className="confirm-dialog-error" role="alert">{getUserErrorMessage(error, 'dialog.actionFailed')}</p>}

        <div className="confirm-dialog-actions">
          <Button variant="secondary" className="confirm-dialog-btn" onClick={handleCancel} disabled={isConfirming}>
            {cancelText || t('common.cancel')}
          </Button>
          <Button
            variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
            className="confirm-dialog-btn"
            onClick={handleConfirm}
            loading={isConfirming}
          >
            {isConfirming ? t('common.processing') : (confirmText || t('common.confirm'))}
          </Button>
        </div>
      </div>
    </div>
  );
}

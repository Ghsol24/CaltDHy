import { getUserErrorMessage } from '../../utils/userErrors.js';
import React from 'react';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useTranslation } from '../../i18n/useTranslation';
import { Dialog } from './Dialog';

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

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleCancel}
      busy={isConfirming}
      portal={false}
      overlayClassName="confirm-dialog-backdrop"
      className="confirm-dialog-card"
      labelledBy="confirm-dialog-title"
      describedBy={message ? 'confirm-dialog-desc' : undefined}
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
    </Dialog>
  );
}

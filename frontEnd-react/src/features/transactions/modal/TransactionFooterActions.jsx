import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

export function TransactionFooterActions({ canDelete, close, draftAmount, handleDelete, isEditing, isPhone, isSubmitting, type }) {
  const { t } = useTranslation();
  return (
    <div className={`txn-modal-footer${canDelete ? ' txn-modal-footer--with-delete' : ''}`}>
      {canDelete && (
        <button
          type="button"
          className="txn-btn-delete"
          onClick={handleDelete}
          disabled={isSubmitting}
          aria-label={t('transaction.deleteAria')}
          title={t('transaction.deleteAria')}
        >
          <Icon name="trash" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <span className="txn-btn-delete__label">{t('common.delete')}</span>
        </button>
      )}
      <button
        type="button"
        className="txn-btn-cancel"
        onClick={close}
        disabled={isSubmitting}
      >
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        className={`txn-btn-submit ${type === 'income' ? 'txn-btn-submit--income' : ''}`}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span className="spinner spinner--box" aria-hidden="true" />
            <span>{t('common.saving')}</span>
          </>
        ) : isEditing ? (
          t('transaction.update')
        ) : isPhone && draftAmount > 0 && Number.isSafeInteger(draftAmount) ? (
          t('transaction.saveWithAmount', { amount: formatCurrency(draftAmount) })
        ) : (
          t('transaction.save')
        )}
      </button>
    </div>
  );
}

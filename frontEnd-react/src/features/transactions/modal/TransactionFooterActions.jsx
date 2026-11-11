import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

export function TransactionFooterActions({ canDelete, close, draftAmount, handleDelete, isEditing, isPhone, isSubmitting, type }) {
  const { t } = useTranslation();
  return (
    <div className={`txn-modal-footer${canDelete ? ' txn-modal-footer--with-delete' : ''}`}>
      {canDelete && (
        <Button
          variant="danger-outline"
          size="lg"
          className="txn-btn-delete"
          onClick={handleDelete}
          disabled={isSubmitting}
          aria-label={t('transaction.deleteAria')}
          title={t('transaction.deleteAria')}
        >
          <Icon name="trash" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <span className="txn-btn-delete__label">{t('common.delete')}</span>
        </Button>
      )}
      <Button variant="secondary" size="lg" className="txn-btn-cancel" onClick={close} disabled={isSubmitting}>
        {t('common.cancel')}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className={`txn-btn-submit${type === 'income' ? ' btn--income' : ''}`}
        loading={isSubmitting}
      >
        {isSubmitting
          ? t('common.saving')
          : isEditing
            ? t('transaction.update')
            : isPhone && draftAmount > 0 && Number.isSafeInteger(draftAmount)
              ? t('transaction.saveWithAmount', { amount: formatCurrency(draftAmount) })
              : t('transaction.save')}
      </Button>
    </div>
  );
}

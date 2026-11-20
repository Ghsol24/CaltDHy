import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { Button } from '../../../components/ui/Button';
import { DialogFooter } from '../../../components/ui/FormDialog';
import { formatCurrency } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';
import { getTransactionFormCopy } from './transactionFormCopy';

export function TransactionFooterActions({ canDelete, close, draftAmount, handleDelete, isEditing, isPhone, isSubmitting, type }) {
  const { t, lang } = useTranslation();
  if (!isPhone) {
    // Máy tính, "Phương án 3": thêm mới chỉ có một nút chính rộng hết (đóng bằng X / Esc);
    // sửa thì "Xóa" dạng chữ đỏ bên trái và "Lưu thay đổi".
    const copy = getTransactionFormCopy(lang);
    return (
      <DialogFooter className={`txn-modal-footer--p3${canDelete ? ' txn-modal-footer--with-delete' : ''}`}>
        {canDelete && (
          <button
            type="button"
            className="txn-btn-delete txn-btn-delete--text"
            onClick={handleDelete}
            disabled={isSubmitting}
            aria-label={t('transaction.deleteAria')}
            title={t('transaction.deleteAria')}
          >
            <Icon name="trash" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <span className="txn-btn-delete__label">{t('common.delete')}</span>
          </button>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className={`txn-btn-submit txn-btn-submit--wide${type === 'income' ? ' btn--income' : ''}`}
          loading={isSubmitting}
        >
          {isSubmitting
            ? t('common.saving')
            : isEditing ? copy.saveChanges : type === 'income' ? copy.saveIncome : t('transaction.save')}
        </Button>
      </DialogFooter>
    );
  }
  return (
    <DialogFooter className={canDelete ? 'txn-modal-footer--with-delete' : undefined}>
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
    </DialogFooter>
  );
}

import React from 'react';
import { FormField } from '../../../components/ui/FormField';
import { useTranslation } from '../../../i18n/useTranslation';

export function TransactionAmountField({ amount, amountError, amountInputRef, handleAmountChange, type = 'expense' }) {
  const { t } = useTranslation();
  return (
    <FormField label={t('transaction.amount')} htmlFor="txn-amount-input" error={amountError || undefined}>
      {({ describedBy, invalid }) => (
        <div className={`txn-amount-box ${invalid ? 'has-error' : ''}${type === 'income' ? ' txn-amount-box--income' : ''}`}>
          {type === 'income' && <span className="txn-amount-sign" aria-hidden="true">+</span>}
          <input
            id="txn-amount-input"
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            className="txn-amount-input"
            placeholder="0"
            value={amount}
            onChange={handleAmountChange}
            required
            aria-required="true"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
          />
          <span className="txn-amount-suffix" aria-hidden="true">
            ₫
          </span>
        </div>
      )}
    </FormField>
  );
}

import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { useTranslation } from '../../../i18n/useTranslation';

export function TransactionAmountField({ amount, amountError, amountInputRef, handleAmountChange, type = 'expense' }) {
  const { t } = useTranslation();
  return (
    <div className="txn-field-group">
      <label htmlFor="txn-amount-input" className="txn-label">
        <span>{t('transaction.amount')}</span>
      </label>
      <div className={`txn-amount-box ${amountError ? 'has-error' : ''}${type === 'income' ? ' txn-amount-box--income' : ''}`}>
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
        />
        <span className="txn-amount-suffix" aria-hidden="true">
          VNĐ
        </span>
      </div>
      {amountError && (
        <div className="txn-amount-error-inline" role="alert">
          <Icon name="alertCircle" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <span>{amountError}</span>
        </div>
      )}
    </div>
  );
}

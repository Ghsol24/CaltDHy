import React from 'react';
import { MobileDateField } from '../TransactionMobileFields';
import { CustomDatePicker } from '../../../components/ui/CustomDatePicker';
import { useTranslation } from '../../../i18n/useTranslation';

export function TransactionDateField({ date, isPhone, maxDate, setDate, setPicker }) {
  const { t } = useTranslation();
  return (
    <div className="txn-field-group">
      <label htmlFor="txn-date-input" id="txn-date-label" className="txn-label">
        <span>{t('transaction.date')}</span>
      </label>
      {isPhone ? (
        <MobileDateField
          id="txn-date-input"
          labelId="txn-date-label"
          value={date}
          todayIso={maxDate}
          onOpen={() => setPicker('date')}
        />
      ) : (
        <CustomDatePicker
          id="txn-date-input"
          inputClassName="txn-input"
          value={date}
          onChange={setDate}
          max={maxDate}
          required
        />
      )}
    </div>
  );
}

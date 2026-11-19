import React from 'react';
import { MobileDateField } from '../TransactionMobileFields';
import { CustomDatePicker } from '../../../components/ui/CustomDatePicker';
import { useTranslation } from '../../../i18n/useTranslation';
import { FormField } from '../../../components/ui/FormField';

export function TransactionDateField({ error, date, isPhone, maxDate, setDate, setPicker }) {
  const { t } = useTranslation();
  return (
    <FormField label={t('transaction.date')} htmlFor="txn-date-input" labelId="txn-date-label" error={error}>
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
    </FormField>
  );
}

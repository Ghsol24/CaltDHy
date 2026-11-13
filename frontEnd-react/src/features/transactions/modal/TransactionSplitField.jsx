import React from 'react';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { Icon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatInputNumber } from '../../../utils/formatters';
import { useTranslation } from '../../../i18n/useTranslation';

export const splitAmount = (value) => Number(String(value || '').replace(/\D/g, '')) || 0;

/** Why the split cannot be saved yet, or '' when it can. */
export function splitProblem({ parts, total, category, copy }) {
  if (parts.some((part) => !part.category || splitAmount(part.amount) <= 0)) return copy.splitIncomplete;
  const names = [category, ...parts.map((part) => part.category)];
  if (new Set(names).size !== names.length) return copy.splitDuplicate;
  if (total - parts.reduce((sum, part) => sum + splitAmount(part.amount), 0) <= 0) return copy.splitOver;
  return '';
}

/**
 * Splits the bill total across categories. The category chosen above keeps whatever
 * is not given to the extra parts, so the parts always add up to the total.
 */
export function TransactionSplitField({ copy, enabled, setEnabled, parts, setParts, total, category, categories }) {
  const { label } = useTranslation();
  const used = parts.reduce((sum, part) => sum + splitAmount(part.amount), 0);
  const remainder = total - used;
  const options = categories.filter((item) => item.name !== category)
    .map((item) => ({ value: item.name, label: label(item.name) }));
  const update = (index, patch) => setParts(parts.map((part, itemIndex) => (itemIndex === index ? { ...part, ...patch } : part)));
  const toggle = (checked) => {
    setEnabled(checked);
    if (checked && parts.length === 0) setParts([{ category: '', amount: '' }]);
  };

  return <div className={`txn-split${enabled ? ' is-on' : ''}`}>
    <label className="txn-split-toggle">
      <input type="checkbox" checked={enabled} onChange={(event) => toggle(event.target.checked)} />
      <span>{copy.split}</span>
    </label>
    {enabled && <div className="txn-split-body">
      <p className="txn-field-hint">{copy.splitHint}</p>
      {parts.map((part, index) => <div className="txn-split-row" key={index}>
        <div className="txn-split-category">
          <CustomSelect id={`txn-split-category-${index}`} value={part.category} options={options}
            placeholder={copy.splitCategory} ariaLabel={`${copy.splitPart(index + 2)}: ${copy.splitCategory}`}
            onChange={(value) => update(index, { category: value })} />
        </div>
        <input type="text" inputMode="numeric" className="txn-input txn-split-amount" value={part.amount}
          placeholder={copy.splitAmount} aria-label={`${copy.splitPart(index + 2)}: ${copy.splitAmount}`}
          onChange={(event) => {
            const amount = splitAmount(event.target.value);
            update(index, { amount: amount ? formatInputNumber(amount) : '' });
          }} />
        <button type="button" className="txn-split-remove" aria-label={copy.splitRemove}
          onClick={() => (parts.length > 1 ? setParts(parts.filter((_, itemIndex) => itemIndex !== index)) : toggle(false))}>
          <Icon name="trash" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </button>
      </div>)}
      {parts.length < 9 && options.length > parts.length && <button type="button" className="txn-split-add"
        onClick={() => setParts([...parts, { category: '', amount: '' }])}>
        <Icon name="plus" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        {copy.splitAdd}
      </button>}
      {category && total > 0 && <p className={`txn-split-remainder${remainder <= 0 ? ' is-over' : ''}`} aria-live="polite">
        {remainder > 0 ? copy.splitRemainder(label(category), formatCurrency(remainder)) : copy.splitOver}
      </p>}
    </div>}
  </div>;
}

import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/AppIcons';
import { formatInputNumber } from '../../utils/formatters';
import './transaction-extras.css';

const digits = (value) => Number(String(value || '').replace(/\D/g, '')) || 0;
const shown = (value) => (value ? formatInputNumber(value) : '');

/** Two amount inputs shared by the desktop popover and the phone filter sheet. */
export function AmountRangeInputs({ copy, min, max, onChange, className = 'history-sheet-amount' }) {
  return <div className={className}>
    <label>{copy.minAmount}
      <input type="text" inputMode="numeric" value={shown(min)} placeholder="0"
        onChange={(event) => onChange(digits(event.target.value) || null, max)} />
    </label>
    <label>{copy.maxAmount}
      <input type="text" inputMode="numeric" value={shown(max)} placeholder="∞"
        onChange={(event) => onChange(min, digits(event.target.value) || null)} />
    </label>
  </div>;
}

/** Saved filters, inline in the filter sheet: apply one, delete one, or save what is currently filtering. */
export function SavedFiltersBody({ copy, filters, canSave, onApply, onSave, onDelete }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setBusy(true); setError('');
    try { await action(); return true; }
    catch { setError(copy.savedFailed); return false; }
    finally { setBusy(false); }
  };
  const save = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (await run(() => onSave(name.trim()))) { setNaming(false); setName(''); }
  };
  const startNaming = () => {
    if (!canSave) return setError(copy.nothingToSave);
    if (filters.length >= 12) return setError(copy.savedLimit);
    setError('');
    return setNaming(true);
  };

  return <div className="history-saved-body">
    {filters.length === 0
      ? <p className="history-saved-empty">{copy.noSaved}</p>
      : <ul className="history-saved-list">
        {filters.map((filter) => <li key={filter.id}>
          <button type="button" className="history-saved-apply" onClick={() => onApply(filter)}>{filter.name}</button>
          <button type="button" className="history-saved-delete" disabled={busy} aria-label={copy.deleteFilter(filter.name)}
            onClick={() => run(() => onDelete(filter.id))}>
            <Icon name="trash" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </button>
        </li>)}
      </ul>}
    {naming
      ? <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
        <label>{copy.filterName}
          <input type="text" value={name} maxLength={40} autoFocus placeholder={copy.filterNamePlaceholder}
            onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="history-popover-actions">
          <Button size="sm" onClick={() => setNaming(false)}>{copy.cancel}</Button>
          <Button size="sm" variant="primary" type="submit" loading={busy} disabled={!name.trim()}>{copy.save}</Button>
        </div>
      </form>
      : <Button size="sm" variant="primary" onClick={startNaming}>{copy.saveCurrent}</Button>}
    {error && <p className="history-popover-error" role="alert">{error}</p>}
  </div>;
}

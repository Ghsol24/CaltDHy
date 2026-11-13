import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/AppIcons';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formatCurrency, formatInputNumber } from '../../utils/formatters';
import './transaction-extras.css';

const digits = (value) => Number(String(value || '').replace(/\D/g, '')) || 0;
const shown = (value) => (value ? formatInputNumber(value) : '');

/**
 * Closes the popover on an outside press or Escape. On phones (`sheet`) the content opens in a bottom
 * sheet instead: the chip row scrolls sideways there and would clip an anchored panel. The sheet has its
 * own backdrop and Escape handling.
 */
function usePopover(sheet = false) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || sheet) return undefined;
    const outside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, sheet]);
  return { ref, open, setOpen };
}

/** Two amount inputs shared by the desktop popover and the phone filter sheet. */
export function AmountRangeInputs({ copy, min, max, onChange, className = 'history-amount-grid' }) {
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

/** Chip that filters by an amount range. */
export function AmountRangeFilter({ copy, min, max, onChange, sheet = false }) {
  const { ref, open, setOpen } = usePopover(sheet);
  const active = Boolean(min || max);
  const invalid = Boolean(min && max && min > max);
  return <div className="history-popover" ref={ref}>
    <button type="button" className={`history-chip-button${active ? ' is-active' : ''}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen((value) => !value)}>
      {active ? copy.amountChip(min ? formatCurrency(min) : '', max ? formatCurrency(max) : '') : copy.amountRange}
      <Icon name="chevronDownAlt" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
    </button>
    {open && (() => {
      const body = <>
        <AmountRangeInputs copy={copy} min={min} max={max} onChange={onChange} className={sheet ? 'history-sheet-amount' : 'history-amount-grid'} />
        {invalid && <p className="history-popover-error" role="alert">{copy.amountInvalid}</p>}
        <div className="history-popover-actions">
          {active && <Button size={sheet ? 'lg' : 'sm'} onClick={() => onChange(null, null)}>{copy.clearAmount}</Button>}
          <Button size={sheet ? 'lg' : 'sm'} variant="primary" onClick={() => setOpen(false)}>{copy.apply}</Button>
        </div>
      </>;
      return sheet
        ? <BottomSheet open onClose={() => setOpen(false)} title={copy.amountRange}><div className="history-sheet-body">{body}</div></BottomSheet>
        : <div className="history-popover-panel" role="dialog" aria-label={copy.amountRange}>{body}</div>;
    })()}
  </div>;
}

/** Saved filter list: apply one, delete one, or save what is currently filtering. */
export function SavedFiltersMenu({ copy, filters, canSave, onApply, onSave, onDelete, align = 'start', sheet = false }) {
  const { ref, open, setOpen } = usePopover(sheet);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!open) { setNaming(false); setName(''); setError(''); } }, [open]);

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

  return <div className="history-popover" ref={ref}>
    <button type="button" className="history-chip-button" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen((value) => !value)}>
      <Icon name="flag" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
      {copy.savedFilters}{filters.length > 0 && ` (${filters.length})`}
    </button>
    {open && (() => {
      const body = <>
      {filters.length === 0
        ? <p className="history-saved-empty">{copy.noSaved}</p>
        : <ul className="history-saved-list">
          {filters.map((filter) => <li key={filter.id}>
            <button type="button" className="history-saved-apply" onClick={() => { onApply(filter); setOpen(false); }}>{filter.name}</button>
            <button type="button" className="history-saved-delete" disabled={busy} aria-label={copy.deleteFilter(filter.name)}
              onClick={() => run(() => onDelete(filter.id))}>
              <Icon name="trash" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </li>)}
        </ul>}
      <div className="history-saved-divider" />
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
      </>;
      return sheet
        ? <BottomSheet open onClose={() => setOpen(false)} title={copy.savedFilters}><div className="history-sheet-body">{body}</div></BottomSheet>
        : <div className={`history-popover-panel${align === 'end' ? ' is-end' : ''}`} role="dialog" aria-label={copy.savedFilters}>{body}</div>;
    })()}
  </div>;
}

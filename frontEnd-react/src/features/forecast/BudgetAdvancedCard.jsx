import React, { useEffect, useState } from 'react';
import { useFinanceSettingsStore } from '../../stores/useFinanceSettingsStore';
import { useToastStore } from '../../stores/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatInputNumber } from '../../utils/formatters';
import { currentWeekRange, expenseBetween } from '../../utils/forecast';
import { Button } from '../../components/ui/Button';
import { getForecastCopy } from './forecastCopy';
import '../../components/ui/form-dialog.css';
import './forecast.css';

const digits = (value) => Number(String(value || '').replace(/\D/g, '')) || 0;

function Meter({ copy, label, spent, limit, note }) {
  if (!limit) return <div className="budget-adv-item"><span>{label}</span><strong>{copy.advNotSet}</strong></div>;
  const percent = Math.min(100, Math.round((spent * 100) / limit));
  const over = spent > limit;
  return <div className={`budget-adv-item${over ? ' is-over' : percent >= 80 ? ' is-warn' : ''}`}>
    <span>{label}</span>
    <strong>{copy.advSpentOf(formatCurrency(spent), formatCurrency(limit))}</strong>
    <div className="budget-adv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
      <span style={{ width: `${percent}%` }} />
    </div>
    <small>{over ? copy.advOver(formatCurrency(spent - limit)) : copy.advLeft(formatCurrency(limit - spent))}{note && ` · ${note}`}</small>
  </div>;
}

/**
 * Overall monthly limit, weekly limit and the rollover switch.
 * `monthExpense` is the shown month's total spending; `carried` is what rollover added to its category limits.
 */
export function BudgetAdvancedCard({ transactions, monthExpense, carried, isCurrentMonth, canEdit }) {
  const { lang } = useTranslation();
  const copy = getForecastCopy(lang);
  const budget = useFinanceSettingsStore((state) => state.budget);
  const loaded = useFinanceSettingsStore((state) => state.loaded);
  const load = useFinanceSettingsStore((state) => state.load);
  const saveBudget = useFinanceSettingsStore((state) => state.saveBudget);
  const addToast = useToastStore((state) => state.addToast);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ totalLimit: '', weeklyLimit: '', rollover: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { void load(); }, [load]);

  const openEditor = () => {
    setDraft({ totalLimit: budget.totalLimit ? formatInputNumber(budget.totalLimit) : '',
      weeklyLimit: budget.weeklyLimit ? formatInputNumber(budget.weeklyLimit) : '', rollover: budget.rollover });
    setEditing(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveBudget({ totalLimit: digits(draft.totalLimit), weeklyLimit: digits(draft.weeklyLimit), rollover: draft.rollover });
      setEditing(false);
      addToast({ type: 'success', message: copy.saved });
    } catch { addToast({ type: 'error', message: copy.failed }); }
    finally { setBusy(false); }
  };
  const amountField = (key, label) => <div className="form-dialog-field">
    <label htmlFor={`budget-adv-${key}`}>{label}</label>
    <input id={`budget-adv-${key}`} className="form-dialog-input" inputMode="numeric" placeholder="0" value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: digits(event.target.value) ? formatInputNumber(digits(event.target.value)) : '' })} />
  </div>;

  const week = currentWeekRange();
  const unused = !budget.totalLimit && !budget.weeklyLimit && !budget.rollover;
  if (!loaded) return null;
  return <section className="budget-adv-card" aria-labelledby="budget-adv-title">
    <div className="budget-adv-head">
      <h2 id="budget-adv-title">{copy.advTitle}</h2>
      {canEdit && !editing && <Button size="sm" onClick={openEditor}>{copy.advEdit}</Button>}
    </div>
    {unused && !editing ? <p className="budget-adv-empty">{copy.advEmpty}</p> : <div className="budget-adv-grid">
      <Meter copy={copy} label={copy.advTotal} spent={monthExpense} limit={budget.totalLimit} />
      {isCurrentMonth && <Meter copy={copy} label={copy.advWeekly} spent={expenseBetween(transactions, week.from, week.to)} limit={budget.weeklyLimit} />}
      <div className="budget-adv-item">
        <span>{copy.advRollover}</span>
        <strong>{budget.rollover ? copy.advRolloverOn : copy.advRolloverOff}</strong>
        {budget.rollover && <small>{carried > 0 ? copy.advCarried(formatCurrency(carried)) : copy.advNoCarry}</small>}
      </div>
    </div>}
    {editing && <form className="budget-adv-form" onSubmit={submit}>
      <div className="form-dialog-row">
        {amountField('totalLimit', copy.advTotalLabel)}
        {amountField('weeklyLimit', copy.advWeeklyLabel)}
      </div>
      <p className="budget-adv-hint">{copy.advZeroHint}</p>
      <label className="budget-adv-switch">
        <input type="checkbox" checked={draft.rollover} onChange={(event) => setDraft({ ...draft, rollover: event.target.checked })} />
        <span>{copy.advRollover}<small>{copy.advRolloverHint}</small></span>
      </label>
      <div className="form-dialog-actions">
        <Button onClick={() => setEditing(false)} disabled={busy}>{copy.cancel}</Button>
        <Button variant="primary" type="submit" loading={busy}>{copy.save}</Button>
      </div>
    </form>}
  </section>;
}

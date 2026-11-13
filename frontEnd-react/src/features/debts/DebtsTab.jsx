import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { debtService } from '../../services/extrasService';
import { useTranslation } from '../../i18n/useTranslation';
import { useToastStore } from '../../stores/useToastStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { formatCurrency, formatDate, formatInputNumber, getLocalDateString } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { CustomDatePicker } from '../../components/ui/CustomDatePicker';
import { PageTitleIcon, NavIcon } from '../../components/ui/NavIcons';
import { Icon } from '../../components/ui/AppIcons';
import { getDebtsCopy } from './debtsCopy';
import '../../components/ui/form-dialog.css';
import './debts.css';

const digits = (value) => Number(String(value || '').replace(/\D/g, '')) || 0;
const dayDiff = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);

function DebtFormDialog({ copy, debt, onClose, onSaved }) {
  const [direction, setDirection] = useState(debt?.direction || 'lent');
  const [person, setPerson] = useState(debt?.person || '');
  const [amount, setAmount] = useState(debt ? formatInputNumber(debt.amount) : '');
  const [startDate, setStartDate] = useState(debt?.startDate || getLocalDateString());
  const [dueDate, setDueDate] = useState(debt?.dueDate || '');
  const [note, setNote] = useState(debt?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!person.trim() || digits(amount) <= 0 || !startDate) return setError(copy.invalid);
    if (dueDate && dueDate < startDate) return setError(copy.dueBeforeStart);
    setBusy(true); setError('');
    const body = { person: person.trim(), amount: digits(amount), startDate, dueDate: dueDate || null, note: note.trim() };
    try {
      const response = debt ? await debtService.update(debt.id, body) : await debtService.create({ ...body, direction });
      onSaved(response.data);
    } catch (cause) { setError(cause?.status === 400 || cause?.status === 409 ? cause.message : copy.failed); }
    finally { setBusy(false); }
    return undefined;
  };

  return <Dialog isOpen onClose={onClose} busy={busy} overlayClassName="form-dialog-overlay" className="form-dialog"
    labelledBy="debt-form-title" as="form" panelProps={{ onSubmit: submit, noValidate: true }}>
    <h2 id="debt-form-title">{debt ? copy.formEdit : copy.formAdd}</h2>
    <div className="form-dialog-fields">
      {!debt && <div className="form-dialog-field">
        <span className="form-dialog-label">{copy.direction}</span>
        <div className="form-dialog-segment" role="group" aria-label={copy.direction}>
          {['lent', 'borrowed'].map((value) => <button key={value} type="button" aria-pressed={direction === value}
            onClick={() => setDirection(value)}>{copy[value]}</button>)}
        </div>
      </div>}
      <div className="form-dialog-field">
        <label htmlFor="debt-person">{copy.person}</label>
        <input id="debt-person" className="form-dialog-input" value={person} maxLength={60} placeholder={copy.personPlaceholder}
          onChange={(event) => setPerson(event.target.value)} />
      </div>
      <div className="form-dialog-field">
        <label htmlFor="debt-amount">{copy.amount}</label>
        <input id="debt-amount" className="form-dialog-input" inputMode="numeric" value={amount} placeholder="0"
          onChange={(event) => setAmount(digits(event.target.value) ? formatInputNumber(digits(event.target.value)) : '')} />
      </div>
      <div className="form-dialog-row">
        <div className="form-dialog-field">
          <label htmlFor="debt-start">{copy.startDate}</label>
          <CustomDatePicker id="debt-start" inputClassName="form-dialog-input" value={startDate} onChange={setStartDate} />
        </div>
        <div className="form-dialog-field">
          <label htmlFor="debt-due">{copy.dueDate}</label>
          <CustomDatePicker id="debt-due" inputClassName="form-dialog-input" value={dueDate} min={startDate || undefined} onChange={setDueDate} />
        </div>
      </div>
      <div className="form-dialog-field">
        <label htmlFor="debt-note">{copy.note}</label>
        <textarea id="debt-note" className="form-dialog-input" value={note} maxLength={500} placeholder={copy.notePlaceholder}
          onChange={(event) => setNote(event.target.value)} />
      </div>
    </div>
    {error && <p className="form-dialog-error" role="alert">{error}</p>}
    <div className="form-dialog-actions">
      <Button size="lg" onClick={onClose} disabled={busy}>{copy.cancel}</Button>
      <Button size="lg" variant="primary" type="submit" loading={busy}>{busy ? copy.saving : copy.save}</Button>
    </div>
  </Dialog>;
}

function PaymentDialog({ copy, debt, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const value = digits(amount);
    if (value <= 0 || value > debt.remaining || !date) return setError(copy.paymentInvalid);
    setBusy(true); setError('');
    try { onSaved((await debtService.addPayment(debt.id, { amount: value, date, note: note.trim() })).data); }
    catch (cause) { setError(cause?.status === 400 || cause?.status === 409 ? cause.message : copy.failed); }
    finally { setBusy(false); }
    return undefined;
  };
  return <Dialog isOpen onClose={onClose} busy={busy} overlayClassName="form-dialog-overlay" className="form-dialog"
    labelledBy="debt-payment-title" as="form" panelProps={{ onSubmit: submit, noValidate: true }}>
    <h2 id="debt-payment-title">{copy.paymentTitle(debt.person)}</h2>
    <p>{copy.paymentHint(formatCurrency(debt.remaining))}</p>
    <div className="form-dialog-fields">
      <div className="form-dialog-field">
        <label htmlFor="debt-pay-amount">{copy.paymentAmount}</label>
        <div className="debts-pay-amount">
          <input id="debt-pay-amount" className="form-dialog-input" inputMode="numeric" value={amount} placeholder="0"
            onChange={(event) => setAmount(digits(event.target.value) ? formatInputNumber(digits(event.target.value)) : '')} />
          <Button onClick={() => setAmount(formatInputNumber(debt.remaining))}>{copy.payAll}</Button>
        </div>
      </div>
      <div className="form-dialog-field">
        <label htmlFor="debt-pay-date">{copy.paymentDate}</label>
        <CustomDatePicker id="debt-pay-date" inputClassName="form-dialog-input" value={date} max={getLocalDateString()} onChange={setDate} />
      </div>
      <div className="form-dialog-field">
        <label htmlFor="debt-pay-note">{copy.note}</label>
        <input id="debt-pay-note" className="form-dialog-input" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
      </div>
    </div>
    {error && <p className="form-dialog-error" role="alert">{error}</p>}
    <div className="form-dialog-actions">
      <Button size="lg" onClick={onClose} disabled={busy}>{copy.cancel}</Button>
      <Button size="lg" variant="primary" type="submit" loading={busy}>{busy ? copy.saving : copy.save}</Button>
    </div>
  </Dialog>;
}

export function DebtsTab() {
  const { lang } = useTranslation();
  const copy = getDebtsCopy(lang);
  const addToast = useToastStore((state) => state.addToast);
  const confirm = useConfirmStore((state) => state.confirm);
  const [debts, setDebts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [tab, setTab] = useState('open');
  const [form, setForm] = useState(null); // { debt? }
  const [paying, setPaying] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const today = getLocalDateString();

  const load = useCallback(() => {
    setStatus('loading');
    debtService.list().then((response) => { setDebts(response.data || []); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upsert = (debt) => setDebts((items) => (items.some((item) => item.id === debt.id)
    ? items.map((item) => (item.id === debt.id ? debt : item)) : [debt, ...items]));
  const isLate = useCallback((debt) => !debt.settled && debt.dueDate && debt.dueDate < today, [today]);
  const totals = useMemo(() => ({
    lent: debts.filter((debt) => debt.direction === 'lent').reduce((sum, debt) => sum + debt.remaining, 0),
    borrowed: debts.filter((debt) => debt.direction === 'borrowed').reduce((sum, debt) => sum + debt.remaining, 0),
    late: debts.filter(isLate).length
  }), [debts, isLate]);
  const visible = useMemo(() => debts
    .filter((debt) => tab === 'all' || (tab === 'settled') === debt.settled)
    // Open debts: the nearest due date first; debts without a date go last.
    .sort((a, b) => Number(a.settled) - Number(b.settled) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999')),
  [debts, tab]);

  const remove = (debt) => confirm({
    title: copy.confirmDelete, message: copy.confirmDeleteBody(debt.person), confirmText: copy.delete, cancelText: copy.cancel,
    onConfirm: async () => {
      await debtService.remove(debt.id);
      setDebts((items) => items.filter((item) => item.id !== debt.id));
      addToast({ type: 'success', message: copy.deleted });
    }
  });
  const removePayment = async (debt, paymentId) => {
    try { upsert((await debtService.removePayment(debt.id, paymentId)).data); }
    catch { addToast({ type: 'error', message: copy.failed }); }
  };
  const showDate = (iso) => formatDate(iso, 'short', { locale: lang });

  return <section className="debts-view" aria-labelledby="debts-title">
    <header className="debts-header">
      <div className="page-title-lead">
        <PageTitleIcon name="debts" />
        <h1 id="debts-title" className="debts-route-heading">{copy.lent} & {copy.borrowed.toLocaleLowerCase()}</h1>
      </div>
      <Button variant="primary" size="lg" onClick={() => setForm({})}>
        <Icon name="plus" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        {copy.add}
      </Button>
    </header>
    <p className="debts-intro">{copy.intro}</p>

    <div className="debts-summary">
      <div className="debts-summary-card is-lent"><span>{copy.lentTotal}</span><strong>{formatCurrency(totals.lent)}</strong></div>
      <div className="debts-summary-card is-borrowed"><span>{copy.borrowedTotal}</span><strong>{formatCurrency(totals.borrowed)}</strong></div>
      <div className={`debts-summary-card${totals.late ? ' is-late' : ''}`}><span>{copy.overdue}</span>
        <strong>{totals.late ? copy.overdueCount(totals.late) : copy.none}</strong></div>
    </div>

    <div className="debts-tabs" role="group" aria-label={copy.tabAll}>
      {[['open', copy.tabOpen], ['settled', copy.tabSettled], ['all', copy.tabAll]].map(([value, text]) =>
        <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{text}</button>)}
    </div>

    {status === 'loading' && <p className="debts-status" role="status">{copy.loading}</p>}
    {status === 'error' && <div className="debts-status" role="alert">{copy.loadFailed} <Button size="sm" onClick={load}>{copy.retry}</Button></div>}
    {status === 'ready' && debts.length === 0 && <EmptyState icon={<NavIcon name="debts" size={36} />} title={copy.emptyTitle}
      description={copy.emptyBody} actionLabel={copy.add} onAction={() => setForm({})} />}
    {status === 'ready' && debts.length > 0 && visible.length === 0 && <p className="debts-status">{copy.emptyFiltered}</p>}

    <ul className="debts-list">
      {visible.map((debt) => {
        const late = isLate(debt);
        const percent = Math.min(100, Math.round((debt.paid * 100) / debt.amount));
        const dueText = debt.settled ? copy.settled : !debt.dueDate ? copy.noDue
          : late ? copy.lateBy(dayDiff(debt.dueDate, today)) : copy.dueIn(dayDiff(today, debt.dueDate));
        return <li key={debt.id} className={`debts-card is-${debt.direction}${debt.settled ? ' is-settled' : ''}${late ? ' is-late' : ''}`}>
          <div className="debts-card-top">
            <div className="debts-card-who">
              <span className="debts-badge">{copy[debt.direction]}</span>
              <strong>{debt.direction === 'lent' ? copy.lentTo(debt.person) : copy.borrowedFrom(debt.person)}</strong>
              <small>{copy.since(showDate(debt.startDate))}{debt.dueDate && ` · ${copy.due(showDate(debt.dueDate))}`}</small>
            </div>
            <div className="debts-card-amount">
              <small>{copy.remaining}</small>
              <strong>{formatCurrency(debt.remaining)}</strong>
              <span className="debts-due">{dueText}</span>
            </div>
          </div>
          <div className="debts-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
            aria-label={copy.paidOf(formatCurrency(debt.paid), formatCurrency(debt.amount))}><span style={{ width: `${percent}%` }} /></div>
          <p className="debts-paid">{copy.paidOf(formatCurrency(debt.paid), formatCurrency(debt.amount))}</p>
          {debt.note && <p className="debts-note">{debt.note}</p>}
          <div className="debts-actions">
            {!debt.settled && <Button size="sm" variant="primary" onClick={() => setPaying(debt)}>{copy.recordPayment}</Button>}
            {debt.payments.length > 0 && <Button size="sm" aria-expanded={expanded === debt.id}
              onClick={() => setExpanded(expanded === debt.id ? null : debt.id)}>{copy.payments(debt.payments.length)}</Button>}
            <Button size="sm" onClick={() => setForm({ debt })}>{copy.edit}</Button>
            <Button size="sm" variant="danger-outline" onClick={() => remove(debt)}>{copy.delete}</Button>
          </div>
          {expanded === debt.id && <ul className="debts-payments">
            {debt.payments.map((payment) => <li key={payment.id}>
              <time dateTime={payment.date}>{showDate(payment.date)}</time>
              <span>{payment.note}</span>
              <strong>{formatCurrency(payment.amount)}</strong>
              <button type="button" aria-label={copy.removePayment} onClick={() => removePayment(debt, payment.id)}>
                <Icon name="trash" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </button>
            </li>)}
          </ul>}
        </li>;
      })}
    </ul>

    {form && <DebtFormDialog copy={copy} debt={form.debt} onClose={() => setForm(null)}
      onSaved={(debt) => { upsert(debt); setForm(null); addToast({ type: 'success', message: copy.saved }); }} />}
    {paying && <PaymentDialog copy={copy} debt={paying} onClose={() => setPaying(null)}
      onSaved={(debt) => { upsert(debt); setPaying(null); addToast({ type: 'success', message: copy.paymentSaved }); }} />}
  </section>;
}

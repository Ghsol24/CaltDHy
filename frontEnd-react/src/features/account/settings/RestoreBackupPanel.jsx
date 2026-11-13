import React, { useRef, useState } from 'react';
import { extrasService } from '../../../services/extrasService';
import { useTransactionStore } from '../../../stores/useTransactionStore';
import { useWalletStore } from '../../../stores/useWalletStore';
import { useJarStore } from '../../../stores/useJarStore';
import { useFinanceSettingsStore } from '../../../stores/useFinanceSettingsStore';
import { useToastStore } from '../../../stores/useToastStore';
import { useTranslation } from '../../../i18n/useTranslation';
import { formatDate, getLocalMonthString } from '../../../utils/formatters';
import { getUserErrorMessage } from '../../../utils/userErrors';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { getSecurityCopy } from './securityCopy';
import '../../../components/ui/form-dialog.css';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const count = (value) => (Array.isArray(value) ? value.length : 0);

/** Replace the account's financial data with a file exported by "Xuất JSON". */
export function RestoreBackupPanel({ onRestored }) {
  const { lang } = useTranslation();
  const copy = getSecurityCopy(lang);
  const fileRef = useRef(null);
  const [picked, setPicked] = useState(null); // { name, backup }
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addToast = useToastStore((state) => state.addToast);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (file.size > MAX_FILE_BYTES) return setError(copy.restoreTooLarge);
    try {
      const parsed = JSON.parse(await file.text());
      // Accept both the downloaded file and a raw API response that still has its envelope.
      const backup = parsed?.version === 1 ? parsed : parsed?.data;
      if (!backup || backup.version !== 1 || !Array.isArray(backup.wallets) || !Array.isArray(backup.transactions)) throw new Error('backup');
      setConfirmText('');
      setPicked({ name: file.name, backup });
    } catch { setError(copy.restoreInvalid); }
    return undefined;
  };
  const restore = async (event) => {
    event.preventDefault();
    if (confirmText.trim() !== 'RESTORE') return;
    setBusy(true); setError('');
    try {
      await extrasService.restoreBackup(picked.backup);
      // Every screen reads from these stores, so reload them all from the restored data.
      useTransactionStore.setState((state) => ({ budgets: {}, budgetMonth: null, budgetsByMonth: {}, budgetCategoryBase: null,
        financialResetVersion: state.financialResetVersion + 1 }));
      await Promise.allSettled([
        useTransactionStore.getState().fetchTransactions(), useWalletStore.getState().fetchWallets(),
        useJarStore.getState().fetchData(), useTransactionStore.getState().fetchBudgets(getLocalMonthString()),
        useFinanceSettingsStore.getState().load({ force: true })
      ]);
      setPicked(null);
      addToast({ type: 'success', message: copy.restoreDone, duration: 6000 });
      onRestored?.();
    } catch (cause) { setError(cause?.status === 400 ? getUserErrorMessage(cause) : copy.failed); }
    finally { setBusy(false); }
  };

  return <div className="account-card-panel">
    <div className="account-card-panel-row">
      <div>
        <div className="account-panel-label">{copy.restoreTitle}</div>
        <div className="account-card-panel-row__div--text">{copy.restoreDesc}</div>
      </div>
      <button type="button" className="btn-avatar-action btn-avatar-preset" onClick={() => fileRef.current?.click()}>{copy.restoreChoose}</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pick} />
    </div>
    {error && !picked && <div className="account-feedback-msg error" role="alert">{error}</div>}

    {picked && <Dialog isOpen onClose={() => setPicked(null)} busy={busy} closeOnBackdrop={false} portal={false}
      overlayClassName="form-dialog-overlay is-nested" className="form-dialog" labelledBy="restore-title" as="form"
      panelProps={{ role: 'alertdialog', onSubmit: restore }}>
      <h3 id="restore-title">{copy.restoreDialogTitle}</h3>
      <p><strong>{copy.restoreSummary(picked.name)}</strong>
        {picked.backup.exportedAt && <><br />{copy.restoreExported(formatDate(picked.backup.exportedAt, 'short', { locale: lang }))}</>}
        <br />{copy.restoreCounts({ wallets: count(picked.backup.wallets), transactions: count(picked.backup.transactions),
          jars: count(picked.backup.jars), installments: count(picked.backup.installments), debts: count(picked.backup.debts) })}</p>
      <p className="form-dialog-error">{copy.restoreWarning}</p>
      <div className="form-dialog-field">
        <label htmlFor="restore-confirm">{copy.restoreType}</label>
        <input id="restore-confirm" className="form-dialog-input" value={confirmText} placeholder="RESTORE" autoComplete="off"
          onChange={(event) => setConfirmText(event.target.value)} />
      </div>
      {error && <p className="form-dialog-error" role="alert">{error}</p>}
      <div className="form-dialog-actions">
        <Button size="lg" onClick={() => setPicked(null)} disabled={busy}>{copy.cancel}</Button>
        <Button size="lg" variant="danger" type="submit" loading={busy} disabled={confirmText.trim() !== 'RESTORE'}>
          {busy ? copy.restoring : copy.restoreConfirm}</Button>
      </div>
    </Dialog>}
  </div>;
}

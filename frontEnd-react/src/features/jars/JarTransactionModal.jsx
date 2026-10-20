import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useToastStore } from '../../stores/useToastStore';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatInputNumber } from '../../utils/formatters';
import { getUserErrorMessage } from '../../utils/userErrors.js';
import { JarOutlineIcon } from '../../components/ui/AppIcons';
import { JarDialog } from './JarDialog';
import { getJarTransactionCopy } from './jarTransactionCopy';
import '../../assets/css/jar-transaction.css';

const QUICK_AMOUNTS = [50000, 100000, 250000, 500000];
const amountNumber = (value) => Number(String(value).replace(/\D/g, ''));

export function JarTransactionModal({ isOpen, onClose, jar, initialAction = 'deposit', initialAmount = 0 }) {
  const { updateJarBalance } = useJarStore();
  const { wallets } = useWalletStore();
  const { addToast } = useToastStore();
  const navigateTo = useSpendingStore((state) => state.navigateTo);
  const { lang } = useTranslation();
  const copy = getJarTransactionCopy(lang);
  const formId = useId();
  const amountId = `${formId}-amount`;
  const walletId = `${formId}-wallet`;
  const noteId = `${formId}-note`;
  const [action, setAction] = useState(initialAction === 'withdraw' ? 'withdraw' : 'deposit');
  const [amount, setAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [reason, setReason] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [walletTouched, setWalletTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const amountInputRef = useRef(null);
  const walletInputRef = useRef(null);
  const submittingRef = useRef(false);
  const openTargetRef = useRef(null);
  const activeWallets = useMemo(() => wallets.filter((wallet) => wallet.id && !wallet.archived), [wallets]);

  useEffect(() => {
    if (!isOpen) {
      openTargetRef.current = null;
      return;
    }
    const target = `${jar?.id || ''}:${initialAction}`;
    // A wallet refresh must never erase the amount or note after a failed save.
    if (openTargetRef.current === target) return;
    openTargetRef.current = target;
    setAction(initialAction === 'withdraw' ? 'withdraw' : 'deposit');
    setAmount(Number.isSafeInteger(initialAmount) && initialAmount > 0 ? formatInputNumber(initialAmount) : '');
    setReason('');
    setAmountTouched(false);
    setWalletTouched(false);
    setErrorMsg('');
    const defaultWallet = activeWallets.find((wallet) => wallet.isDefault) || activeWallets[0];
    setSelectedWalletId(defaultWallet?.id || '');
  }, [isOpen, jar?.id, initialAction, initialAmount, activeWallets]);

  if (!isOpen || !jar) return null;

  const isDeposit = action === 'deposit';
  const currentBalance = Number(jar.current || 0);
  const remaining = Math.max(0, Number(jar.target || 0) - currentBalance);
  const enteredAmount = amountNumber(amount);
  const validAmount = Number.isSafeInteger(enteredAmount) && enteredAmount > 0;
  const selectedWallet = activeWallets.find((wallet) => wallet.id === selectedWalletId);
  const walletBalance = Number(selectedWallet?.currentBalance ?? selectedWallet?.initialBalance ?? 0);
  const walletMinimum = selectedWallet?.type === 'credit' ? -Number(selectedWallet.creditLimit || 0) : 0;
  const previewAmount = validAmount ? enteredAmount : 0;
  const walletAfter = walletBalance + (isDeposit ? -previewAmount : previewAmount);
  const jarAfter = currentBalance + (isDeposit ? previewAmount : -previewAmount);
  const safePreview = Number.isSafeInteger(walletAfter) && Number.isSafeInteger(jarAfter);
  const money = (value) => formatCurrency(value, { locale: lang });
  const presetMoney = (value) => formatCurrency(value, { locale: lang, currency: 'VND' });
  let amountError = '';
  if (!validAmount) amountError = copy.amountPositive;
  else if (!safePreview) amountError = copy.amountRange;
  else if (!isDeposit && enteredAmount > currentBalance) amountError = copy.withdrawTooMuch(money(currentBalance));
  else if (isDeposit && selectedWallet && walletAfter < walletMinimum) amountError = copy.walletInsufficient;
  const walletError = selectedWallet ? '' : copy.chooseWallet;
  const showAmountError = amountTouched || amount.length > 0;
  const showWalletError = walletTouched || Boolean(selectedWalletId && !selectedWallet);
  const canSubmit = !isSubmitting && !amountError && !walletError;

  const setEnteredAmount = (value) => {
    if (submittingRef.current) return;
    setAmount(formatInputNumber(value));
    setAmountTouched(true);
    setErrorMsg('');
  };
  const requestClose = () => {
    if (!submittingRef.current) onClose();
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setAmountTouched(true);
    setWalletTouched(true);
    setErrorMsg('');
    if (amountError) {
      amountInputRef.current?.focus();
      return;
    }
    if (walletError) {
      walletInputRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await updateJarBalance(jar.id, action, enteredAmount, reason.trim(), selectedWallet.id);
      if (!result?.success) throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
      onClose();
      addToast({ type: 'success', message: isDeposit
        ? copy.depositSuccess(money(enteredAmount), jar.name)
        : copy.withdrawSuccess(money(enteredAmount), jar.name), duration: 4000 });
    } catch (error) {
      setErrorMsg(getUserErrorMessage(error, 'error.save', lang));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };
  const openWallets = () => {
    if (submittingRef.current) return;
    onClose();
    navigateTo('plan', 'wallets');
  };

  return (
    <JarDialog isOpen={isOpen} onClose={requestClose}
      title={isDeposit ? copy.depositTitle : copy.withdrawTitle} subtitle={jar.name}
      className="jar-transaction-dialog" busy={isSubmitting} initialFocusRef={amountInputRef}
      footer={<>
        <button type="button" className="jar-transfer-cancel" onClick={requestClose} disabled={isSubmitting}>{copy.cancel}</button>
        <button type="submit" form={formId} className="jar-transfer-submit" disabled={!canSubmit}>
          {isSubmitting ? copy.processing : validAmount
            ? (isDeposit ? copy.depositAmount(money(enteredAmount)) : copy.withdrawAmount(money(enteredAmount)))
            : (isDeposit ? copy.depositTitle : copy.withdrawTitle)}
        </button>
      </>}
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="jar-transfer-form" aria-busy={isSubmitting}>
        <div className="jar-transfer-route" aria-label={isDeposit ? copy.depositRoute : copy.withdrawRoute}>
          <span>{isDeposit ? copy.wallet : copy.jar}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
          <span>{isDeposit ? copy.jar : copy.wallet}</span>
          <small>{copy.internalTransfer}</small>
        </div>

        <div className="jar-transfer-field">
          <label htmlFor={amountId}>{isDeposit ? copy.depositAmountLabel : copy.withdrawAmountLabel}</label>
          <div className={`jar-transfer-amount-box${showAmountError && amountError ? ' is-invalid' : ''}`}>
            <input id={amountId} ref={amountInputRef} type="text" inputMode="numeric" autoComplete="off"
              value={amount} placeholder="0" required disabled={isSubmitting}
              aria-invalid={Boolean(showAmountError && amountError)}
              aria-describedby={showAmountError && amountError ? `${amountId}-error` : undefined}
              onBlur={() => setAmountTouched(true)}
              onChange={(event) => { setAmount(formatInputNumber(event.target.value)); setErrorMsg(''); }} />
            <span>VND</span>
          </div>
          <div className="jar-transfer-presets" role="group" aria-label={copy.quickAmounts}>
            {QUICK_AMOUNTS.map((value) => <button key={value} type="button"
              className={enteredAmount === value ? 'is-selected' : ''} disabled={isSubmitting}
              onClick={() => setEnteredAmount(value)}>{presetMoney(value)}</button>)}
            {(isDeposit ? remaining > 0 : currentBalance > 0) && <button type="button"
              className="jar-transfer-preset-goal" disabled={isSubmitting}
              onClick={() => setEnteredAmount(isDeposit ? remaining : currentBalance)}>
              {isDeposit ? copy.fillGoal : copy.withdrawAll}
            </button>}
          </div>
          {showAmountError && amountError && <p id={`${amountId}-error`} className="jar-transfer-error" role="alert">{amountError}</p>}
        </div>

        <div className={`jar-transfer-wallet-box${showWalletError && walletError ? ' is-invalid' : ''}`}>
          <label htmlFor={walletId}>{isDeposit ? copy.sourceWallet : copy.destinationWallet} <span>{copy.required}</span></label>
          {activeWallets.length > 0 ? <>
            <div className="jar-transfer-select-wrap">
              <select id={walletId} ref={walletInputRef} value={selectedWallet ? selectedWalletId : ''}
                required disabled={isSubmitting} aria-invalid={Boolean(showWalletError && walletError)}
                aria-describedby={`${walletId}-hint${showWalletError && walletError ? ` ${walletId}-error` : ''}`}
                onChange={(event) => { setSelectedWalletId(event.target.value); setWalletTouched(true); setErrorMsg(''); }}>
                <option value="" disabled>{copy.chooseWallet}</option>
                {activeWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>
                  {wallet.name}{wallet.isDefault ? ` · ${copy.defaultWallet}` : ''} · {money(wallet.currentBalance ?? wallet.initialBalance ?? 0)}
                </option>)}
              </select>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </div>
            <p id={`${walletId}-hint`}>{isDeposit ? copy.depositHint : copy.withdrawHint}</p>
            {showWalletError && walletError && <p id={`${walletId}-error`} className="jar-transfer-error" role="alert">{walletError}</p>}
          </> : <div className="jar-transfer-no-wallet" role="status">
            <p>{copy.noWallet}</p>
            <button type="button" onClick={openWallets}>{copy.openWallets} <span aria-hidden="true">→</span></button>
          </div>}
        </div>

        <section className="jar-transfer-preview" aria-labelledby={`${formId}-preview`}>
          <h3 id={`${formId}-preview`}>{copy.afterConfirmation}</h3>
          <div className="jar-transfer-preview-grid">
            <div>
              <span>{selectedWallet?.name || copy.selectedWallet}</span>
              <strong className={isDeposit && selectedWallet && walletAfter < walletMinimum ? 'is-invalid' : ''}>
                {selectedWallet && safePreview ? money(walletAfter) : '—'}
              </strong>
              <small>{copy.currently} {selectedWallet ? money(walletBalance) : '—'}</small>
            </div>
            <div>
              <span><JarOutlineIcon size={14} aria-hidden="true" />{jar.name}</span>
              <strong className={jarAfter < 0 ? 'is-invalid' : ''}>{safePreview ? money(jarAfter) : '—'}</strong>
              <small>{copy.currently} {money(currentBalance)}</small>
            </div>
          </div>
        </section>

        <div className="jar-transfer-field jar-transfer-note">
          <label htmlFor={noteId}>{copy.note} <span>{copy.optional}</span></label>
          <textarea id={noteId} rows={2} maxLength={200} value={reason} disabled={isSubmitting}
            placeholder={isDeposit ? copy.depositNotePlaceholder : copy.withdrawNotePlaceholder}
            onChange={(event) => { setReason(event.target.value); setErrorMsg(''); }} />
        </div>
        {errorMsg && <div className="jar-transfer-server-error" role="alert">{errorMsg}</div>}
      </form>
    </JarDialog>
  );
}

import { getUserErrorMessage } from '../../utils/userErrors.js';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { spendingService } from '../../services/spendingService';
import { TransactionRevisionHistory } from './TransactionRevisionHistory';
import { isLockedTransaction, useDeleteTransaction } from './useDeleteTransaction';
import { previewCategoryBudgets, requiresHistoricalConfirmation, transactionMonth } from '../../utils/transactionEditing';
import { historicalImpactMessage } from '../../utils/transactionMessages';
import { useToastStore } from '../../stores/useToastStore';
import { Dialog } from '../../components/ui/Dialog';
import { DEFAULT_INCOME_CATEGORIES } from '../../utils/categories';
import { ArrowUpRightOutlineIcon, ArrowDownLeftOutlineIcon } from '../../utils/categoryIcons';
import { formatCurrency, formatInputNumber, formatDate, getLocalDateString, getLocalMonthString } from '../../utils/formatters';
import { CustomWalletDropdown } from '../../components/ui/CustomWalletDropdown';
import { useTranslation } from '../../i18n/useTranslation';
import { BREAKPOINTS, useMediaQuery } from '../../hooks/useMediaQuery';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import { CategoryPickerList, DateSheetContent, TransactionSheet } from './TransactionMobileFields';

import { Icon } from '../../components/ui/AppIcons';
import { describeBudgetMetrics, recentCategoryName } from './modal/transactionModalHelpers';
import { TransactionFooterActions } from './modal/TransactionFooterActions';
import { TransactionDateField } from './modal/TransactionDateField';
import { TransactionCategoryField } from './modal/TransactionCategoryField';
import { TransactionAmountField } from './modal/TransactionAmountField';
const EMPTY_EXPENSE_CATS = [];
// Matches the CSS breakpoint where the dialog becomes a bottom sheet.
const PHONE_QUERY = `(max-width: ${BREAKPOINTS.phone}px)`;
// Touch screens, whose on-screen keyboard would cover the form if a field took focus.
const TOUCH_QUERY = '(pointer: coarse)';

export function TransactionModal() {
  const { t, label, lang, intlLocale } = useTranslation();
  const isAddTxnOpen = useSpendingStore((s) => s.isAddTxnOpen);
  const addTxnInitialState = useSpendingStore((s) => s.addTxnInitialState);
  const closeAddTxnModal = useSpendingStore((s) => s.closeAddTxnModal);
  const navigateTo = useSpendingStore((s) => s.navigateTo);

  const addTransaction = useTransactionStore((s) => s.addTransaction);
  const updateTransaction = useTransactionStore((s) => s.updateTransaction);
  const undoAddTransaction = useTransactionStore((s) => s.undoAddTransaction);
  const editingTransaction = useTransactionStore((s) => s.editingTransaction);
  const closeEditTransaction = useTransactionStore((s) => s.closeEditTransaction);
  const expenseCategories = useTransactionStore((s) => s.expenseCategories);
  const incomeCategories = useTransactionStore((s) => s.incomeCategories);
  const budgets = useTransactionStore((s) => s.budgets);
  const budgetMonth = useTransactionStore((s) => s.budgetMonth);
  const transactions = useTransactionStore((s) => s.transactions);

  const wallets = useWalletStore((s) => s.wallets);
  const archivedWallets = useWalletStore((s) => s.archivedWallets);
  const fetchWallets = useWalletStore((s) => s.fetchWallets);
  const confirm = useConfirmStore((s) => s.confirm);
  const confirmationOpen = useConfirmStore((s) => s.isOpen);
  const addToast = useToastStore((s) => s.addToast);

  const isOpen = Boolean(isAddTxnOpen || editingTransaction);
  const isEditing = Boolean(editingTransaction);
  const requestDelete = useDeleteTransaction();
  const canDelete = isEditing && !isLockedTransaction(editingTransaction);

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(() => getLocalDateString());
  const maxDate = getLocalDateString();
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [amountError, setAmountError] = useState('');
  const [periodBudgets, setPeriodBudgets] = useState({ month: '', data: {}, error: false });
  const [budgetRetry, setBudgetRetry] = useState(0);
  const [picker, setPicker] = useState(null); // phones: 'category' | 'date' | null
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isTouch = useMediaQuery(TOUCH_QUERY);
  const activePicker = isOpen && isPhone ? picker : null;

  const modalRef = useRef(null);
  const amountInputRef = useRef(null);
  const prevOpenRef = useRef(false);
  const prevEditIdRef = useRef(null);


  // Fetch wallets if list is empty
  useEffect(() => {
    if (isOpen && wallets.length === 0) {
      fetchWallets();
    }
  }, [isOpen, wallets.length, fetchWallets]);

  // Categories list based on selected transaction type
  const activeExpenseCats = useMemo(() => {
    const list = expenseCategories || EMPTY_EXPENSE_CATS;
    if (editingTransaction?.type !== 'expense' || !editingTransaction.category ||
        list.some((cat) => cat.name === editingTransaction.category)) return list;
    return [...list, { name: editingTransaction.category }];
  }, [expenseCategories, editingTransaction]);
  const activeIncomeCats = incomeCategories && incomeCategories.length > 0
    ? incomeCategories
    : DEFAULT_INCOME_CATEGORIES;

  const categories = type === 'expense' ? activeExpenseCats : activeIncomeCats;

  const selectedPeriod = transactionMonth({ date });
  const originalPeriod = transactionMonth(editingTransaction);
  const historicalPeriod = [originalPeriod, selectedPeriod].filter((month) => month && month < getLocalMonthString());
  const budgetReady = selectedPeriod && (budgetMonth === selectedPeriod || periodBudgets.month === selectedPeriod);
  const applicableBudgets = budgetMonth === selectedPeriod ? budgets : periodBudgets.data;
  const budgetError = budgetMonth !== selectedPeriod && periodBudgets.error && periodBudgets.month === selectedPeriod;

  // The modal owns its period data so editing a past entry never changes the dashboard month.
  useEffect(() => {
    if (!isOpen || type !== 'expense' || !selectedPeriod || budgetMonth === selectedPeriod) return undefined;
    let active = true;
    setPeriodBudgets({ month: '', data: {}, error: false });
    spendingService.getBudgets(selectedPeriod).then((response) => {
      if (!response.success) throw new Error('budget');
      if (active) setPeriodBudgets({ month: selectedPeriod, data: response.data || {}, error: false });
    }).catch(() => {
      if (active) setPeriodBudgets({ month: selectedPeriod, data: {}, error: true });
    });
    return () => { active = false; };
  }, [isOpen, type, selectedPeriod, budgetMonth, budgetRetry]);

  const draftAmount = Number(String(amount).replace(/\D/g, ''));
  // Thu nhập mới: cho thấy trước số dư ví sau khi nhận, để người dùng kiểm tra đúng ví và đúng số.
  const incomeWallet = type === 'income' && !editingTransaction
    ? wallets.find((wallet) => String(wallet.id) === String(walletId)) : null;
  const incomeBalanceAfter = incomeWallet && draftAmount > 0 && Number.isSafeInteger(draftAmount)
    ? (incomeWallet.currentBalance ?? incomeWallet.initialBalance ?? 0) + draftAmount : null;
  const categoryMetrics = useMemo(() => {
    if (type !== 'expense' || !budgetReady || budgetError) return {};
    const metrics = previewCategoryBudgets({ transactions, budgets: applicableBudgets,
      categories: activeExpenseCats, month: selectedPeriod, editingId: editingTransaction?.id,
      draft: { type, amount: draftAmount, category, date, fee: editingTransaction?.fee || 0 } });
    return describeBudgetMetrics(metrics, t);
  }, [type, draftAmount, category, date, selectedPeriod, transactions, applicableBudgets,
      activeExpenseCats, editingTransaction, budgetReady, budgetError, t]);

  // Phones compare "left now" with "left after saving", so they also need the budgets without the draft.
  const baselineMetrics = useMemo(() => {
    if (!isPhone || type !== 'expense' || !budgetReady || budgetError) return {};
    const metrics = previewCategoryBudgets({ transactions, budgets: applicableBudgets,
      categories: activeExpenseCats, month: selectedPeriod, editingId: editingTransaction?.id, draft: null });
    return describeBudgetMetrics(metrics, t);
  }, [isPhone, type, selectedPeriod, transactions, applicableBudgets, activeExpenseCats,
      editingTransaction, budgetReady, budgetError, t]);

  // Sắp xếp danh mục: Ưu tiên có hạn mức trước, sau đó là chưa đặt hạn mức (giữ nguyên trật tự cấu hình)
  const sortedCategories = useMemo(() => {
    if (type !== 'expense') return categories;
    return [...categories].sort((a, b) => {
      const mA = categoryMetrics[a.name];
      const mB = categoryMetrics[b.name];
      if (mA?.hasLimit && !mB?.hasLimit) return -1;
      if (!mA?.hasLimit && mB?.hasLimit) return 1;
      return 0;
    });
  }, [type, categories, categoryMetrics]);

  // Initialize or reset form values only when modal is opened or target editing transaction changes
  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      prevEditIdRef.current = null;
      return;
    }

    const isFirstOpen = !prevOpenRef.current && isOpen;
    const isEditTargetChanged = prevEditIdRef.current !== (editingTransaction?.id || null);

    if (isFirstOpen || isEditTargetChanged) {
      prevOpenRef.current = true;
      prevEditIdRef.current = editingTransaction?.id || null;

      if (editingTransaction) {
        setType(editingTransaction.type || 'expense');
        setAmount(
          editingTransaction.amount
            ? formatInputNumber(editingTransaction.amount)
            : ''
        );
        setCategory(editingTransaction.category || '');
        setWalletId(editingTransaction.walletId || '');
        setDate(
          editingTransaction.date
            ? typeof editingTransaction.date === 'string'
              ? editingTransaction.date.slice(0, 10)
              : getLocalDateString(editingTransaction.date)
            : getLocalDateString()
        );
        setDesc(editingTransaction.desc || '');
        setErrorMsg('');
        setAmountError('');
      } else {
        // New transaction default state
        const targetType = addTxnInitialState?.type === 'income' ? 'income' : 'expense';
        setType(targetType);
        setAmount(
          addTxnInitialState?.amount
            ? formatInputNumber(addTxnInitialState.amount)
            : ''
        );
        const initialCats =
          targetType === 'income'
            ? activeIncomeCats
            : (sortedCategories.length > 0 ? sortedCategories : activeExpenseCats);
        // Phones show only the chosen category, so start from the one used last instead of the first in the list.
        const recentCat = isPhone ? recentCategoryName(transactions, targetType, initialCats) : '';
        const defaultCat = addTxnInitialState?.category || recentCat || initialCats[0]?.name || '';
        setCategory(defaultCat);
        setPicker(null);
        setDate(getLocalDateString());
        setDesc(addTxnInitialState?.desc || '');
        setErrorMsg('');
        setAmountError('');

        // Preselect wallet: prioritize addTxnInitialState.walletId, then default wallet, then first wallet
        const targetWalletId = addTxnInitialState?.walletId;
        const targetWallet = targetWalletId ? wallets.find((w) => w.id === targetWalletId) : null;
        const defWallet = targetWallet || wallets.find((w) => w.isDefault) || wallets[0];
        if (defWallet) {
          setWalletId(defWallet.id);
        }
      }
    }
  }, [isOpen, editingTransaction, categories, wallets, sortedCategories, addTxnInitialState, activeIncomeCats, activeExpenseCats, isPhone, transactions]);

  // Preselect category if empty when categories load
  useEffect(() => {
    if (isOpen && !isEditing && !category) {
      const list = type === 'expense' ? sortedCategories : activeIncomeCats;
      if (list.length > 0) {
        setCategory((isPhone && recentCategoryName(transactions, type, list)) || list[0]?.name || '');
      }
    }
  }, [isOpen, isEditing, category, type, sortedCategories, activeIncomeCats, isPhone, transactions]);

  // Preselect wallet if walletId is empty when wallets load
  useEffect(() => {
    if (isOpen && !isEditing && !walletId && wallets.length > 0) {
      const targetWalletId = addTxnInitialState?.walletId;
      const targetWallet = targetWalletId ? wallets.find((w) => w.id === targetWalletId) : null;
      const defWallet = targetWallet || wallets.find((w) => w.isDefault) || wallets[0];
      if (defWallet) {
        setWalletId(defWallet.id);
      }
    }
  }, [isOpen, isEditing, walletId, wallets, addTxnInitialState]);

  // The on-screen keyboard never opens by itself: on touch screens neither adding
  // nor editing focuses a field, so the form stays visible until a field is tapped.
  // With a mouse and keyboard (no on-screen keyboard), adding still starts in the
  // amount field. The focus trap moves focus into the dialog in every case.
  useEffect(() => {
    if (isOpen && !isEditing && !isTouch && amountInputRef.current) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isEditing, isTouch]);

  const close = useCallback(() => {
    closeAddTxnModal();
    closeEditTransaction();
    setPicker(null);
    setErrorMsg('');
    setAmountError('');
  }, [closeAddTxnModal, closeEditTransaction]);
  const closePicker = useCallback(() => setPicker(null), []);
  // Deletes the saved entry (not the draft); the modal closes only once it is gone.
  const handleDelete = () => {
    if (!canDelete || isSubmitting || confirmationOpen) return;
    void requestDelete(editingTransaction, { onDeleted: close });
  };
  const requestDismiss = useCallback(() => {
    if (!isSubmitting && !confirmationOpen) close();
  }, [close, isSubmitting, confirmationOpen]);
  const sheetDrag = useSheetDrag(requestDismiss, { enabled: isPhone && !activePicker });

  // Escape closes an open phone sheet first, then the modal.
  const handleEscape = () => {
    if (activePicker) setPicker(null);
    else close();
  };

  // Switch type (expense <-> income) & preserve or reset category
  const handleTypeChange = (newType) => {
    if (type === newType) return;
    setType(newType);
    const newCategories = newType === 'expense' ? activeExpenseCats : activeIncomeCats;
    const exists = newCategories.some((c) => c.name.toLowerCase() === category.toLowerCase());
    if (!exists) {
      setCategory((isPhone && recentCategoryName(transactions, newType, newCategories)) || newCategories[0]?.name || '');
    }
  };

  // Realtime thousand group formatting (e.g. 50000 -> 50.000)
  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmount(num ? formatInputNumber(num) : '');
    if (num > 0) {
      setAmountError('');
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || confirmationOpen) return;
    setErrorMsg('');
    setAmountError('');

    const cleanAmountStr = String(amount).replace(/\D/g, '');
    const numAmount = parseInt(cleanAmountStr, 10);

    if (!numAmount || numAmount <= 0) {
      setAmountError(t('transaction.amountPositive'));
      amountInputRef.current?.focus();
      return;
    }

    if (!Number.isSafeInteger(numAmount)) {
      setAmountError(t('transaction.amountRange'));
      return;
    }
    if (!selectedPeriod || !date) {
      setErrorMsg(t('transaction.dateRequired'));
      return;
    }
    if (date > maxDate && date !== editingTransaction?.date?.slice?.(0, 10)) {
      setErrorMsg(t('transaction.dateFuture'));
      return;
    }

    if (!category) {
      setErrorMsg(t('transaction.chooseCategory'));
      return;
    }

    // Fallback wallet if none selected
    let targetWalletId = walletId;
    if (!isEditing && !targetWalletId && wallets.length > 0) {
      const defWallet = wallets.find((w) => w.isDefault) || wallets[0];
      targetWalletId = defWallet ? defWallet.id : null;
    }

    const transactionData = {
      type, amount: numAmount, category, walletId: targetWalletId || null, date, desc: desc.trim()
    };
    // Legacy entries can have no wallet. A note edit must not silently assign a default wallet.
    if (isEditing && (walletId || null) === (editingTransaction.walletId || null)) {
      delete transactionData.walletId;
    }
    const persist = async () => {
      if (isEditing) {
        const res = await updateTransaction(editingTransaction.id, transactionData);
        if (res?.success) {
          close();
          addToast({
            type: 'success',
            message: t('transaction.updated', { category: label(category), amount: formatCurrency(numAmount) }),
            duration: 4000
          });
        }
      } else {
        const res = await addTransaction(transactionData);
        if (res?.success) {
          const createdTxn = res.data;
          close();
          addToast({
            type: 'success',
            message: t('transaction.saved', { type: t(`type.${type}`).toLocaleLowerCase(intlLocale), amount: formatCurrency(numAmount), category: label(category) }),
            action: createdTxn?.id
              ? {
                  label: t('transaction.undo'),
                  onClick: () => {
                    undoAddTransaction(createdTxn.id);
                  }
                }
              : null,
            duration: 5000
          });
        }
      }
    };
    setIsSubmitting(true);
    try {
      const preview = { ...editingTransaction, ...transactionData };
      if (preview.type !== 'transfer') preview.toWalletId = null;
      if (requiresHistoricalConfirmation(editingTransaction, preview, getLocalMonthString())) {
        await confirm({
          title: t('transaction.confirmHistorical'),
          message: historicalImpactMessage(editingTransaction, preview,
            { t, wallets: [...wallets, ...archivedWallets], locale: lang }),
          confirmText: t('transaction.confirmSave'), cancelText: t('common.cancel'),
          confirmVariant: 'primary', onConfirm: persist
        });
      } else {
        await persist();
      }
    } catch (err) {
      setErrorMsg(getUserErrorMessage(err, 'error.save'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen
      onClose={requestDismiss}
      onEscape={handleEscape}
      busy={isSubmitting}
      portal={false}
      panelRef={modalRef}
      overlayClassName="txn-modal-backdrop"
      className={`txn-modal-card${sheetDrag.offset ? ' is-dragging' : ''}`}
      labelledBy="txn-modal-title"
      panelProps={sheetDrag.offset ? { style: { '--sheet-drag-offset': `${sheetDrag.offset}px` } } : undefined}
    >
        {/* Header (phones: grabber + drag down to dismiss) */}
        <div className="txn-modal-handle-zone" inert={activePicker ? true : undefined} {...(isPhone ? sheetDrag.handlers : {})}>
          <span className="txn-modal-grabber" aria-hidden="true" />
          <div className="txn-modal-header">
            <h2 id="txn-modal-title" className="txn-modal-title">
              {isEditing
                ? t('transaction.edit')
                : addTxnInitialState?.title && type === addTxnInitialState?.type
                  ? addTxnInitialState.title
                  : type === 'income'
                    ? t('transaction.addIncome')
                    : t('transaction.add')}
            </h2>
            <button
              type="button"
              className="txn-modal-close-btn"
              onClick={close}
              disabled={isSubmitting || confirmationOpen}
              aria-label={t('common.closeWindow')}
            >
              <Icon name="close" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate inert={activePicker ? true : undefined}>
          <div className="txn-modal-body txn-modal-body--transaction">
            {historicalPeriod.length > 0 && <div className="txn-period-notice" role="status">
              <strong>{t('transaction.historicalPeriod', { month: formatDate(`${historicalPeriod[0]}-01`, 'month', { locale: lang }) })}</strong>
              <span>{t('transaction.historicalHint')}</span>
            </div>}
            {/* 1. Type toggle */}
            <div className="txn-type-toggle" role="group" aria-label={t('transaction.type')}>
              <button
                type="button"
                className={`txn-type-btn txn-type-btn--expense ${type === 'expense' ? 'active' : ''}`}
                onClick={() => handleTypeChange('expense')}
                aria-pressed={type === 'expense'}
              >
                <ArrowUpRightOutlineIcon size={16} />
                <span>{t('type.expense')}</span>
              </button>
              <button
                type="button"
                className={`txn-type-btn txn-type-btn--income ${type === 'income' ? 'active' : ''}`}
                onClick={() => handleTypeChange('income')}
                aria-pressed={type === 'income'}
              >
                <ArrowDownLeftOutlineIcon size={16} />
                <span>{t('type.income')}</span>
              </button>
            </div>

            {/* 2. Amount field */}
            <TransactionAmountField type={type} amount={amount} amountError={amountError} amountInputRef={amountInputRef} handleAmountChange={handleAmountChange} />

            {/* 3. Smart Category Selection Grid */}
            <TransactionCategoryField baselineMetrics={baselineMetrics} budgetError={budgetError} budgetReady={budgetReady} category={category} categoryMetrics={categoryMetrics} close={close} draftAmount={draftAmount} isPhone={isPhone} navigateTo={navigateTo} selectedPeriod={selectedPeriod} setBudgetRetry={setBudgetRetry} setCategory={setCategory} setPicker={setPicker} sortedCategories={sortedCategories} type={type} />

            {/* 4. Wallet Selection (Chi từ / Nhận vào) */}
            <div className="txn-field-group">
              <label htmlFor="txn-wallet-select" className="txn-label">
                <span>{t(type === 'expense' ? 'transaction.expenseWallet' : 'transaction.incomeWallet')}</span>
              </label>
              <CustomWalletDropdown
                wallets={wallets}
                value={walletId}
                onChange={setWalletId}
                placeholder={t('transaction.chooseWallet')}
              />
              {incomeBalanceAfter !== null && (
                <p className="txn-field-hint txn-field-hint--income" aria-live="polite">
                  {t('transaction.balanceAfterIncome', { amount: formatCurrency(incomeBalanceAfter) })}
                </p>
              )}
            </div>

            {/* 5. Date Field */}
            <TransactionDateField date={date} isPhone={isPhone} maxDate={maxDate} setDate={setDate} setPicker={setPicker} />

            {/* 6. Description Note */}
            <div className="txn-field-group">
              <label htmlFor="txn-desc-input" className="txn-label">
                <span>{t('transaction.note')}</span>
                <span className="txn-label-optional">{t('transaction.optional')}</span>
              </label>
              <input
                id="txn-desc-input"
                type="text"
                className="txn-input"
                placeholder={t('transaction.notePlaceholder')}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={100}
              />
            </div>

            {isEditing && <TransactionRevisionHistory key={editingTransaction.id}
              transactionId={editingTransaction.id} wallets={[...wallets, ...archivedWallets]} />}

            {/* Error Message */}
            {errorMsg && (
              <div className="txn-error-banner" role="alert">
                <Icon name="alertCircle" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* 7. Footer CTA Actions */}
          <TransactionFooterActions canDelete={canDelete} close={close} draftAmount={draftAmount} handleDelete={handleDelete} isEditing={isEditing} isPhone={isPhone} isSubmitting={isSubmitting} type={type} />
        </form>

        {activePicker === 'category' && (
          <TransactionSheet title={t('transaction.chooseCategory')} onClose={closePicker}>
            <CategoryPickerList
              type={type}
              categories={sortedCategories}
              selected={category}
              metrics={baselineMetrics}
              onPick={(name) => { setCategory(name); closePicker(); }}
            />
          </TransactionSheet>
        )}
        {activePicker === 'date' && (
          <TransactionSheet title={t('transaction.pickDate')} onClose={closePicker}>
            <DateSheetContent
              value={date}
              todayIso={maxDate}
              onPick={(iso) => { setDate(iso); closePicker(); }}
              onEscape={closePicker}
            />
          </TransactionSheet>
        )}
    </Dialog>
  );
}

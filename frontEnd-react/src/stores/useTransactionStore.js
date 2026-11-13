import { getUserErrorMessage } from '../utils/userErrors.js';
import { sessionEpoch, scopedSet, scopedGet } from '../services/sessionRuntime';
import { create } from 'zustand';
import { spendingService } from '../services/spendingService';
import { useSpendingStore } from './useSpendingStore';
import { useWalletStore } from './useWalletStore';
import { useToastStore } from './useToastStore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { getLocalDateString, getLocalMonthString } from '../utils/formatters';
import { moneyInteger, MAX_MONEY } from '../utils/moneyPrecision';
import { isMonthString, withBudgetEdit } from '../utils/budgetPeriod';


const getStoredTxns = () => [];

const saveStoredTxns = () => undefined;

const getStoredExpenseCategories = () => DEFAULT_EXPENSE_CATEGORIES;

const getStoredIncomeCategories = () => DEFAULT_INCOME_CATEGORIES;

const saveStoredExpenseCategories = () => undefined;

const _saveStoredIncomeCategories = () => undefined;

// Limits are cached per month for the session (logout resets the store), so the
// budget page can switch months without waiting. A month is refetched in the
// background once it is older than this.
const BUDGET_FRESH_MS = 60_000;
// One request per month while it is in flight, shared by page loads and prefetches.
const budgetRequests = new Map();
// Bumped by every limit save: a read that started before a save must not overwrite it.
let budgetMutationSeq = 0;

// Server categories, plus any category the month has a limit for, else the defaults.
function mergeExpenseCategories(baseNames, current, budgetMap) {
  const serverCats = baseNames?.length
    ? baseNames.map((name) => ({ name, icon: getCategoryIcon(name, 'expense') }))
    : current?.length ? current : DEFAULT_EXPENSE_CATEGORIES;
  const known = new Set(serverCats.map((c) => c.name.toLowerCase()));
  const merged = [...serverCats];
  Object.keys(budgetMap || {}).forEach((name) => {
    if (!known.has(name.toLowerCase())) {
      known.add(name.toLowerCase());
      merged.push({ name, icon: getCategoryIcon(name, 'expense') });
    }
  });
  return merged.length ? merged : DEFAULT_EXPENSE_CATEGORIES.map(({ name, icon }) => ({ name, icon }));
}

const normalizeTxn = (t) => ({
  id: t._id || t.id,
  type: t.type,
  desc: t.desc || '',
  amount: Number(t.amount),
  category: t.category,
  date: t.date
    ? typeof t.date === 'string'
      ? t.date.slice(0, 10)
      : getLocalDateString(t.date)
    : '',
  walletId: t.walletId?._id || t.walletId || null,
  toWalletId: t.toWalletId?._id || t.toWalletId || null,
  fee: Number(t.fee) || 0,
  jarId: t.jarId || null,
  installmentId: t.installmentId || null,
  systemGenerated: Boolean(t.systemGenerated),
  tags: Array.isArray(t.tags) ? t.tags : [],
  note: t.note || '',
  splitGroupId: t.splitGroupId || null
});

export const useTransactionStore = create((storeSet, storeGet) => {
const set = storeSet;
const get = storeGet;
return ({
  transactions: getStoredTxns(),
  budgets: {},
  budgetMonth: null,
  // { 'YYYY-MM': { data, fetchedAt } }; `budgets` above stays the selected month's.
  budgetsByMonth: {},
  budgetCategoryBase: null, // { names, fetchedAt } from the server category list
  expenseCategories: getStoredExpenseCategories(),
  incomeCategories: getStoredIncomeCategories(),
  categories: [],
  isLoading: false,
  hasLoadedTransactions: false,
  financialResetVersion: 0,
  error: null,
  editingTransaction: null,

  setExpenseCategories: async (cats) => {
    const epoch = sessionEpoch();
    await spendingService.updateCategories(cats.map(c => c.name));
    scopedSet(epoch, storeSet)({ expenseCategories: cats,
      budgetCategoryBase: { names: cats.map((c) => c.name), fetchedAt: Date.now() } });
  },

  openEditTransaction: (transaction) => set({ editingTransaction: transaction }),
  closeEditTransaction: () => set({ editingTransaction: null }),

  updateSpendingMetrics: (txnsList) => {
    const list = txnsList || get().transactions;
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curPrefix = `${curYear}-${curMonth}`;

    let totalNet = 0n;
    let monthInc = 0n;
    let monthExp = 0n;

    list.forEach((t) => {
      const amt = moneyInteger(t.amount);
      const fee = moneyInteger(t.fee ?? 0);
      if (t.type === 'income') {
        totalNet += amt;
        if (t.date && t.date.startsWith(curPrefix)) {
          monthInc += amt;
        }
      } else if (t.type === 'expense') {
        totalNet -= (amt + fee);
        if (t.date && t.date.startsWith(curPrefix)) {
          monthExp += (amt + fee);
        }
      }
    });

    const displayValue = value => value > MAX_MONEY || value < -MAX_MONEY ? value : Number(value);
    useSpendingStore.getState().setMetrics({
      balance: displayValue(totalNet),
      income: displayValue(monthInc),
      expense: displayValue(monthExp)
    });
  },

  fetchTransactions: async () => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true, error: null });
    try {
      const res = await spendingService.getTransactions();
      if (res.success && Array.isArray(res.data)) {
        const txns = res.data.map(normalizeTxn);
        saveStoredTxns(txns);
        set({ transactions: txns, isLoading: false, hasLoadedTransactions: true });
        get().updateSpendingMetrics(txns);

        // Đồng bộ số dư ví
        const walletStore = useWalletStore.getState();
        if (walletStore?.syncWalletBalances) {
          walletStore.syncWalletBalances();
        }
        return { success: true, data: txns };
      } else {
        throw new Error(getUserErrorMessage(res, 'error.generic'));
      }
    } catch (error) { set({ isLoading: false, hasLoadedTransactions: true, error: getUserErrorMessage(error, 'error.generic') }); return { success: false, error: getUserErrorMessage(error, 'error.generic') }; }
  },

  /** Fills the month cache only; never changes what other screens show. */
  loadBudgetMonth: async (month, { force = false } = {}) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    if (!isMonthString(month)) return { success: false };
    const cached = get().budgetsByMonth[month];
    if (!force && cached && Date.now() - cached.fetchedAt < BUDGET_FRESH_MS) {
      return { success: true, data: cached.data };
    }
    const key = `${epoch}:${month}`;
    if (budgetRequests.has(key)) return budgetRequests.get(key);
    const request = (async () => {
      const seq = budgetMutationSeq;
      try {
        const base = get().budgetCategoryBase;
        const refreshCategories = !base || Date.now() - base.fetchedAt >= BUDGET_FRESH_MS;
        const [budgetRes, catRes] = await Promise.all([
          spendingService.getBudgets(month),
          refreshCategories ? spendingService.getCategories().catch(() => null) : null
        ]);
        if (!budgetRes?.success || !budgetRes.data) return { success: false };
        const update = {};
        if (catRes?.success && Array.isArray(catRes.data)) {
          update.budgetCategoryBase = { names: catRes.data, fetchedAt: Date.now() };
        }
        // A save during this read already put the newer limits in the cache.
        if (seq === budgetMutationSeq) {
          update.budgetsByMonth = { ...get().budgetsByMonth, [month]: { data: budgetRes.data, fetchedAt: Date.now() } };
        }
        set(update);
        return { success: true, data: get().budgetsByMonth[month]?.data || budgetRes.data };
      } catch (error) {
        return { success: false, error: getUserErrorMessage(error, 'error.generic') };
      } finally {
        budgetRequests.delete(key);
      }
    })();
    budgetRequests.set(key, request);
    return request;
  },

  /** Warm the cache for months the person is likely to open next. */
  prefetchBudgetMonths: (months) => {
    for (const month of months) void storeGet().loadBudgetMonth(month);
  },

  /**
   * Make `month` the shared `budgets` (when it is the selected month): instantly
   * from the cache when possible, then again once the network confirms it.
   */
  fetchBudgets: async (month = null) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    const targetMonth = (typeof month === 'string' && month.trim())
      ? month.trim()
      : (useSpendingStore.getState().selectedMonth || getLocalMonthString());
    const isSelected = () => targetMonth === useSpendingStore.getState().selectedMonth;
    const apply = () => {
      const entry = get().budgetsByMonth[targetMonth];
      if (!entry || !isSelected()) return;
      if (get().budgetMonth === targetMonth && get().budgets === entry.data) return;
      const merged = mergeExpenseCategories(get().budgetCategoryBase?.names, get().expenseCategories, entry.data);
      saveStoredExpenseCategories(merged);
      set({ budgets: entry.data, budgetMonth: targetMonth, expenseCategories: merged });
    };

    try {
      apply();
      const result = await get().loadBudgetMonth(targetMonth);
      if (result.success) apply();
      else if (isSelected()) set({ isLoading: false, error: result.error || getUserErrorMessage(null, 'error.generic') });
      return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getUserErrorMessage(error, 'error.generic') };
    }
  },

  updateBudgets: async (budgetsObj, month = null) => {
    budgetMutationSeq += 1;
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const targetMonth = (typeof month === 'string' && month.trim())
      ? month.trim()
      : (useSpendingStore.getState().selectedMonth || getLocalMonthString());
    set({ isLoading: true });
    try {
      const res = await spendingService.updateBudgets(budgetsObj, targetMonth);
      if (res.success) {
        budgetMutationSeq += 1;
        set((state) => ({ budgets: budgetsObj, budgetMonth: targetMonth, isLoading: false,
          budgetsByMonth: withBudgetEdit(state.budgetsByMonth, targetMonth, budgetsObj) }));
        return { success: true, data: budgetsObj };
      } else {
        throw new Error(getUserErrorMessage(res, 'error.generic'));
      }
    } catch (error) { set({ isLoading: false, error: getUserErrorMessage(error, 'error.generic') }); throw error; }
  },

  updateBudgetsAndCategories: async (budgetsObj, expenseCats, month = null) => {
    budgetMutationSeq += 1;
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const targetMonth = (typeof month === 'string' && month.trim())
      ? month.trim()
      : (useSpendingStore.getState().selectedMonth || getLocalMonthString());
    set({ isLoading: true });
    if (expenseCats) {
      saveStoredExpenseCategories(expenseCats);
    }
    try {
      await spendingService.updateBudgets(budgetsObj, targetMonth, expenseCats?.map(c => c.name));
      budgetMutationSeq += 1;
      set((state) => ({
        budgets: budgetsObj,
        budgetMonth: targetMonth,
        budgetsByMonth: withBudgetEdit(state.budgetsByMonth, targetMonth, budgetsObj),
        ...(expenseCats ? {
          expenseCategories: expenseCats,
          budgetCategoryBase: { names: expenseCats.map((c) => c.name), fetchedAt: Date.now() }
        } : {}),
        isLoading: false
      }));
      return { success: true, data: budgetsObj };
    } catch (error) { set({ isLoading: false, error: getUserErrorMessage(error, 'error.generic') }); throw error; }
  },

  addTransaction: async (data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await spendingService.createTransaction(data);
      if (res.success && res.data) {
        const newTxn = normalizeTxn(res.data);
        const updated = [newTxn, ...get().transactions];
        saveStoredTxns(updated);
        set({ transactions: updated, isLoading: false });
        get().updateSpendingMetrics(updated);

        // Đồng bộ số dư ví
        const walletStore = useWalletStore.getState();
        if (walletStore?.syncWalletBalances) {
          walletStore.syncWalletBalances();
        }
        return { success: true, data: newTxn };
      } else {
        throw new Error(getUserErrorMessage(res, 'error.generic'));
      }
    } catch (error) { set({ isLoading: false, error: getUserErrorMessage(error, 'error.generic') }); throw error; }
  },

  updateTransaction: async (id, data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await spendingService.updateTransaction(id, data);
      if (!res.success || !res.data) {
        throw new Error(getUserErrorMessage(res, 'error.generic'));
      }
      const updatedTxn = normalizeTxn(res.data);
      const updated = get().transactions.map((t) => (t.id === id ? updatedTxn : t));
      saveStoredTxns(updated);
      set({ transactions: updated, editingTransaction: null, isLoading: false });
      get().updateSpendingMetrics(updated);

      // Đồng bộ số dư ví
      const walletStore = useWalletStore.getState();
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: true, data: updatedTxn };
    } catch (error) { set({ isLoading: false, error: getUserErrorMessage(error, 'error.generic') }); throw error; }
  },

  deleteTransaction: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      await spendingService.deleteTransaction(id);
      const updated = get().transactions.filter((t) => t.id !== id);
      saveStoredTxns(updated);
      set({ transactions: updated, isLoading: false });
      get().updateSpendingMetrics(updated);

      // Đồng bộ số dư ví
      const walletStore = useWalletStore.getState();
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: true };
    } catch (error) { set({ isLoading: false, error: getUserErrorMessage(error, 'error.generic') }); throw error; }
  },

  // Undo a delete. The server rebuilds the entry under its original ID, so its
  // change history stays attached; callers show the success/failure toast.
  restoreTransaction: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    const res = await spendingService.restoreTransaction(id);
    if (!res.success || !res.data) {
      throw new Error(getUserErrorMessage(res, 'transaction.restoreFailed'));
    }
    const restored = normalizeTxn(res.data);
    const updated = [...get().transactions.filter((t) => t.id !== restored.id), restored];
    saveStoredTxns(updated);
    set({ transactions: updated });
    get().updateSpendingMetrics(updated);

    const walletStore = useWalletStore.getState();
    if (walletStore?.syncWalletBalances) {
      walletStore.syncWalletBalances();
    }
    return { success: true, data: restored };
  },

  undoAddTransaction: async (txnId) => {
    const epoch = sessionEpoch();
    const get = scopedGet(epoch, storeGet);
    if (!txnId) return;
    await get().deleteTransaction(txnId);
    useToastStore.getState().addToast({
      type: 'info',
      message: 'Đã hoàn tác thêm giao dịch.'
    });
  },

  resetAllFinancialData: async () => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      await spendingService.resetFinancialData();
      budgetMutationSeq += 1; // reads started before the reset must not refill the cache
      saveStoredTxns([]);
      set((state) => ({
        transactions: [],
        budgets: {},
        budgetMonth: null,
        budgetsByMonth: {},
        financialResetVersion: state.financialResetVersion + 1,
        isLoading: false
      }));
      get().updateSpendingMetrics([]);
      const walletStore = useWalletStore.getState();
      useWalletStore.setState({ walletHistory: [] });
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: true };
    } catch (error) { set({ isLoading: false, error: getUserErrorMessage(error, 'error.generic') }); throw error; }
  }
});
});

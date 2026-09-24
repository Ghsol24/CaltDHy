import { sessionEpoch, scopedSet, scopedGet } from '../services/sessionRuntime';
import { create } from 'zustand';
import { spendingService } from '../services/spendingService';
import { useSpendingStore } from './useSpendingStore';
import { useWalletStore } from './useWalletStore';
import { useToastStore } from './useToastStore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { getLocalDateString, getLocalMonthString } from '../utils/formatters';
import { moneyInteger, MAX_MONEY } from '../utils/moneyPrecision';

const getStoredTxns = () => [];

const saveStoredTxns = () => undefined;

const getStoredExpenseCategories = () => DEFAULT_EXPENSE_CATEGORIES;

const getStoredIncomeCategories = () => DEFAULT_INCOME_CATEGORIES;

const saveStoredExpenseCategories = () => undefined;

const _saveStoredIncomeCategories = () => undefined;
let latestBudgetRequestId = 0;

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
  systemGenerated: Boolean(t.systemGenerated)
});

export const useTransactionStore = create((storeSet, storeGet) => {
const set = storeSet;
const get = storeGet;
return ({
  transactions: getStoredTxns(),
  budgets: {},
  budgetMonth: null,
  expenseCategories: getStoredExpenseCategories(),
  incomeCategories: getStoredIncomeCategories(),
  categories: [],
  isLoading: false,
  hasLoadedTransactions: false,
  financialResetVersion: 0,
  error: null,
  editingTransaction: null,
  filters: {
    type: 'all',
    category: 'all',
    search: ''
  },

  setExpenseCategories: async (cats) => {
    const epoch = sessionEpoch();
    await spendingService.updateCategories(cats.map(c => c.name));
    scopedSet(epoch, storeSet)({ expenseCategories: cats });
  },

  deleteExpenseCategory: async (catName) => {
    const updated = get().expenseCategories.filter((c) => c.name !== catName);
    const updatedBudgets = { ...get().budgets };
    delete updatedBudgets[catName];
    return get().updateBudgetsAndCategories(updatedBudgets, updated);
  },

  addExpenseCategory: async (catObj) => {
    const exists = get().expenseCategories.some(
      (c) => c.name.toLowerCase() === catObj.name.toLowerCase()
    );
    if (exists) return;
    const updated = [...get().expenseCategories, catObj];
    return get().setExpenseCategories(updated);
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value }
    }));
  },

  resetFilters: () => {
    set({
      filters: { type: 'all', category: 'all', search: '' }
    });
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
        throw new Error(res.message || 'Lỗi lấy dữ liệu giao dịch');
      }
    } catch (error) { set({ isLoading: false, hasLoadedTransactions: true, error: error.message }); return { success: false, error: error.message }; }
  },

  fetchBudgets: async (month = null) => {
    const requestId = ++latestBudgetRequestId;
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    const targetMonth = (typeof month === 'string' && month.trim())
      ? month.trim()
      : (useSpendingStore.getState().selectedMonth || getLocalMonthString());

    try {
      const [budgetRes, catRes] = await Promise.all([
        spendingService.getBudgets(targetMonth),
        spendingService.getCategories().catch(() => null)
      ]);

      if (budgetRes?.success && budgetRes.data) {
        const budgetMap = budgetRes.data;
        const budgetCatNames = Object.keys(budgetMap);
        const serverCustomCats = catRes?.success && Array.isArray(catRes.data) ? catRes.data : null;

        // Hợp nhất danh mục từ server customCats, các key của budgets và default categories
        const serverCats = (serverCustomCats && serverCustomCats.length > 0)
          ? serverCustomCats.map((name) => ({ name, icon: getCategoryIcon(name, 'expense') }))
          : (get().expenseCategories && get().expenseCategories.length > 0)
          ? get().expenseCategories
          : DEFAULT_EXPENSE_CATEGORIES;

        const known = new Set(serverCats.map((c) => c.name.toLowerCase()));
        const merged = [...serverCats];

        budgetCatNames.forEach((name) => {
          if (!known.has(name.toLowerCase())) {
            known.add(name.toLowerCase());
            merged.push({ name, icon: getCategoryIcon(name, 'expense') });
          }
        });

        // Chỉ fallback về danh mục mặc định nếu danh sách sau khi merge hoàn toàn rỗng (user mới chưa có dữ liệu)
        if (merged.length === 0) {
          DEFAULT_EXPENSE_CATEGORIES.forEach((defCat) => {
            merged.push({ name: defCat.name, icon: defCat.icon });
          });
        }

        if (requestId === latestBudgetRequestId && targetMonth === useSpendingStore.getState().selectedMonth) {
          saveStoredExpenseCategories(merged);
          set({ budgets: budgetMap, budgetMonth: targetMonth, expenseCategories: merged });
        }
        return { success: true, data: budgetMap };
      }
    } catch (error) {
      if (requestId === latestBudgetRequestId && targetMonth === useSpendingStore.getState().selectedMonth) {
        set({ isLoading: false, error: error.message });
      }
      return { success: false, error: error.message };
    }
    return { success: false };
  },

  updateBudgets: async (budgetsObj, month = null) => {
    latestBudgetRequestId += 1;
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const targetMonth = (typeof month === 'string' && month.trim())
      ? month.trim()
      : (useSpendingStore.getState().selectedMonth || getLocalMonthString());
    set({ isLoading: true });
    try {
      const res = await spendingService.updateBudgets(budgetsObj, targetMonth);
      if (res.success) {
        set({ budgets: budgetsObj, budgetMonth: targetMonth, isLoading: false });
        return { success: true, data: budgetsObj };
      } else {
        throw new Error(res.message || 'Lỗi cập nhật ngân sách');
      }
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  updateBudgetsAndCategories: async (budgetsObj, expenseCats, month = null) => {
    latestBudgetRequestId += 1;
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
      set({
        budgets: budgetsObj,
        budgetMonth: targetMonth,
        ...(expenseCats ? { expenseCategories: expenseCats } : {}),
        isLoading: false
      });
      return { success: true, data: budgetsObj };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
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
        throw new Error(res.message || 'Thêm giao dịch thất bại.');
      }
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  updateTransaction: async (id, data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await spendingService.updateTransaction(id, data);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Cập nhật giao dịch thất bại.');
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
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
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
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  undoDeleteTransaction: async (txn) => {
    const epoch = sessionEpoch();
    const get = scopedGet(epoch, storeGet);
    if (!txn) return;
    const { id: _unusedId, ...dataToRestore } = txn;
    await get().addTransaction(dataToRestore);
    useToastStore.getState().addToast({
      type: 'success',
      message: `Đã khôi phục giao dịch ${txn.desc || txn.category || ''}.`
    });
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
      saveStoredTxns([]);
      set((state) => ({
        transactions: [],
        budgets: {},
        budgetMonth: null,
        financialResetVersion: state.financialResetVersion + 1,
        isLoading: false
      }));
      get().updateSpendingMetrics([]);
      const walletStore = useWalletStore.getState();
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: true };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  }
});
});

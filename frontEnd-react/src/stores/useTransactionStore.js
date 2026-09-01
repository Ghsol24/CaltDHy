import { create } from 'zustand';
import { spendingService } from '../services/spendingService';
import { useSpendingStore } from './useSpendingStore';
import { useWalletStore } from './useWalletStore';
import { useToastStore } from './useToastStore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, getCategoryIcon } from '../utils/categories';
import { getLocalDateString } from '../utils/formatters';

const TXN_KEY = 'caltdhy_txns';
const EXPENSE_CAT_KEY = 'caltdhy_expense_categories';
const INCOME_CAT_KEY = 'caltdhy_income_categories';

const getStoredTxns = () => {
  try {
    const raw = localStorage.getItem(TXN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredTxns = (txns) => {
  try {
    localStorage.setItem(TXN_KEY, JSON.stringify(txns));
  } catch {}
};

const getStoredExpenseCategories = () => {
  try {
    const raw = localStorage.getItem(EXPENSE_CAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_EXPENSE_CATEGORIES;
};

const getStoredIncomeCategories = () => {
  try {
    const raw = localStorage.getItem(INCOME_CAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_INCOME_CATEGORIES;
};

const saveStoredExpenseCategories = (cats) => {
  try {
    localStorage.setItem(EXPENSE_CAT_KEY, JSON.stringify(cats));
  } catch {}
};

const saveStoredIncomeCategories = (cats) => {
  try {
    localStorage.setItem(INCOME_CAT_KEY, JSON.stringify(cats));
  } catch {}
};

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
  installmentId: t.installmentId || null
});

export const useTransactionStore = create((set, get) => ({
  transactions: getStoredTxns(),
  budgets: {},
  expenseCategories: getStoredExpenseCategories(),
  incomeCategories: getStoredIncomeCategories(),
  categories: [],
  isLoading: false,
  error: null,
  editingTransaction: null,
  filters: {
    type: 'all',
    category: 'all',
    search: ''
  },

  setExpenseCategories: (cats) => {
    saveStoredExpenseCategories(cats);
    set({ expenseCategories: cats });
    try {
      spendingService.updateCategories(cats.map((c) => c.name)).catch(() => {});
    } catch {}
  },

  deleteExpenseCategory: (catName) => {
    const updated = get().expenseCategories.filter((c) => c.name !== catName);
    saveStoredExpenseCategories(updated);
    const updatedBudgets = { ...get().budgets };
    delete updatedBudgets[catName];
    set({ expenseCategories: updated, budgets: updatedBudgets });
    try {
      spendingService.updateBudgets(updatedBudgets);
      spendingService.updateCategories(updated.map((c) => c.name)).catch(() => {});
    } catch {}
  },

  addExpenseCategory: (catObj) => {
    const exists = get().expenseCategories.some(
      (c) => c.name.toLowerCase() === catObj.name.toLowerCase()
    );
    if (exists) return;
    const updated = [...get().expenseCategories, catObj];
    saveStoredExpenseCategories(updated);
    set({ expenseCategories: updated });
    try {
      spendingService.updateCategories(updated.map((c) => c.name)).catch(() => {});
    } catch {}
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

    let totalNet = 0;
    let monthInc = 0;
    let monthExp = 0;

    list.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const fee = Number(t.fee) || 0;
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

    useSpendingStore.getState().setMetrics({
      balance: totalNet,
      income: monthInc,
      expense: monthExp
    });
  },

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await spendingService.getTransactions();
      if (res.success && Array.isArray(res.data)) {
        const txns = res.data.map(normalizeTxn);
        saveStoredTxns(txns);
        set({ transactions: txns, isLoading: false });
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
    } catch (err) {
      const local = getStoredTxns();
      set({ transactions: local, isLoading: false, error: err.message });
      get().updateSpendingMetrics(local);

      const walletStore = useWalletStore.getState();
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: false, error: err.message, data: local };
    }
  },

  fetchBudgets: async () => {
    try {
      const [budgetRes, catRes] = await Promise.all([
        spendingService.getBudgets(),
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

        DEFAULT_EXPENSE_CATEGORIES.forEach((defCat) => {
          if (!known.has(defCat.name.toLowerCase())) {
            known.add(defCat.name.toLowerCase());
            merged.push({ name: defCat.name, icon: defCat.icon });
          }
        });

        saveStoredExpenseCategories(merged);
        set({ budgets: budgetMap, expenseCategories: merged });
        return { success: true, data: budgetMap };
      }
    } catch (err) {
      console.error('Lỗi tải ngân sách:', err);
    }
    return { success: false };
  },

  updateBudgets: async (budgetsObj) => {
    set({ isLoading: true });
    try {
      const res = await spendingService.updateBudgets(budgetsObj);
      if (res.success) {
        set({ budgets: budgetsObj, isLoading: false });
        return { success: true, data: budgetsObj };
      } else {
        throw new Error(res.message || 'Lỗi cập nhật ngân sách');
      }
    } catch (err) {
      set({ budgets: budgetsObj, isLoading: false });
      return { success: true, data: budgetsObj, offline: true };
    }
  },

  updateBudgetsAndCategories: async (budgetsObj, expenseCats) => {
    set({ isLoading: true });
    if (expenseCats) {
      saveStoredExpenseCategories(expenseCats);
    }
    try {
      const res = await spendingService.updateBudgets(budgetsObj);
      if (expenseCats && Array.isArray(expenseCats)) {
        await spendingService.updateCategories(expenseCats.map((c) => c.name)).catch(() => {});
      }
      set({
        budgets: budgetsObj,
        ...(expenseCats ? { expenseCategories: expenseCats } : {}),
        isLoading: false
      });
      return { success: true, data: budgetsObj };
    } catch (err) {
      set({
        budgets: budgetsObj,
        ...(expenseCats ? { expenseCategories: expenseCats } : {}),
        isLoading: false
      });
      return { success: true, data: budgetsObj, offline: true };
    }
  },

  addTransaction: async (data) => {
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
    } catch (err) {
      // Offline fallback
      const newTxn = normalizeTxn({
        ...data,
        id: `local_${Date.now()}`
      });
      const updated = [newTxn, ...get().transactions];
      saveStoredTxns(updated);
      set({ transactions: updated, isLoading: false });
      get().updateSpendingMetrics(updated);

      const walletStore = useWalletStore.getState();
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: true, data: newTxn, offline: true, error: err.message };
    }
  },

  updateTransaction: async (id, data) => {
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
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    set({ isLoading: true });
    try {
      if (!String(id).startsWith('local_')) {
        await spendingService.deleteTransaction(id);
      }
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
    } catch (err) {
      set({ isLoading: false });

      // Chỉ coi là "xóa cục bộ, đồng bộ sau" khi THỰC SỰ mất kết nối (status 503 do
      // apiFetch gán khi fetch() ném lỗi mạng). Nếu server đã trả lời nhưng từ chối
      // (400/403/404/500 — ví dụ giao dịch thuộc Hũ/Khoản định kỳ bị chặn ở backend),
      // TUYỆT ĐỐI không được xóa khỏi state cục bộ rồi báo success — làm vậy sẽ khiến
      // UI hiển thị "đã xóa" trong khi giao dịch vẫn còn nguyên trong database, gây
      // lệch dữ liệu ẩn giữa client và server.
      if (err && err.status === 503) {
        const updated = get().transactions.filter((t) => t.id !== id);
        saveStoredTxns(updated);
        set({ transactions: updated });
        get().updateSpendingMetrics(updated);

        const walletStore = useWalletStore.getState();
        if (walletStore?.syncWalletBalances) {
          walletStore.syncWalletBalances();
        }
        return { success: true, offline: true, error: err.message };
      }

      throw err;
    }
  },

  undoDeleteTransaction: async (txn) => {
    if (!txn) return;
    const { id: _unusedId, ...dataToRestore } = txn;
    await get().addTransaction(dataToRestore);
    useToastStore.getState().addToast({
      type: 'success',
      message: `Đã khôi phục giao dịch ${txn.desc || txn.category || ''}.`
    });
  },

  undoAddTransaction: async (txnId) => {
    if (!txnId) return;
    await get().deleteTransaction(txnId);
    useToastStore.getState().addToast({
      type: 'info',
      message: 'Đã hoàn tác thêm giao dịch.'
    });
  },

  resetAllFinancialData: async () => {
    set({ isLoading: true });
    try {
      await spendingService.resetFinancialData();
      saveStoredTxns([]);
      set({
        transactions: [],
        budgets: {},
        isLoading: false
      });
      get().updateSpendingMetrics([]);
      const walletStore = useWalletStore.getState();
      if (walletStore?.syncWalletBalances) {
        walletStore.syncWalletBalances();
      }
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  }
}));

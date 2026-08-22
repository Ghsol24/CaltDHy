import { create } from 'zustand';
import { spendingService } from '../services/spendingService';
import { useSpendingStore } from './useSpendingStore';

const TXN_KEY = 'caltdhy_txns';

const getStoredTxns = () => {
  try {
    const raw = localStorage.getItem(TXN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

const saveStoredTxns = (txns) => {
  try {
    localStorage.setItem(TXN_KEY, JSON.stringify(txns));
  } catch (_) {}
};

export const useTransactionStore = create((set, get) => ({
  transactions: getStoredTxns(),
  budgets: {},
  categories: [],
  isLoading: false,
  error: null,
  editingTransaction: null,
  filters: {
    type: 'all',
    category: 'all',
    search: ''
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
      if (t.type === 'income') {
        totalNet += amt;
        if (t.date && t.date.startsWith(curPrefix)) {
          monthInc += amt;
        }
      } else {
        totalNet -= amt;
        if (t.date && t.date.startsWith(curPrefix)) {
          monthExp += amt;
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
        const txns = res.data.map((t) => ({
          id: t._id || t.id,
          type: t.type,
          desc: t.desc || '',
          amount: Number(t.amount),
          category: t.category,
          date: t.date
        }));
        saveStoredTxns(txns);
        set({ transactions: txns, isLoading: false });
        get().updateSpendingMetrics(txns);
      } else {
        throw new Error(res.message || 'Lỗi lấy dữ liệu');
      }
    } catch (err) {
      // Fallback to local storage
      const local = getStoredTxns();
      set({ transactions: local, isLoading: false, error: err.message });
      get().updateSpendingMetrics(local);
    }
  },

  addTransaction: async (data) => {
    set({ isLoading: true });
    try {
      const res = await spendingService.createTransaction(data);
      if (res.success && res.data) {
        const newTxn = {
          id: res.data._id || res.data.id || Date.now().toString(),
          type: res.data.type,
          desc: res.data.desc || '',
          amount: Number(res.data.amount),
          category: res.data.category,
          date: res.data.date
        };
        const updated = [newTxn, ...get().transactions];
        saveStoredTxns(updated);
        set({ transactions: updated, isLoading: false });
        get().updateSpendingMetrics(updated);
        return { success: true };
      } else {
        throw new Error(res.message || 'Thêm giao dịch thất bại.');
      }
    } catch (err) {
      // Offline fallback: create local transaction
      const newTxn = {
        id: `local_${Date.now()}`,
        type: data.type,
        desc: data.desc || '',
        amount: Number(data.amount),
        category: data.category,
        date: data.date
      };
      const updated = [newTxn, ...get().transactions];
      saveStoredTxns(updated);
      set({ transactions: updated, isLoading: false });
      get().updateSpendingMetrics(updated);
      return { success: true, offline: true };
    }
  },

  updateTransaction: async (id, data) => {
    set({ isLoading: true });
    try {
      const res = await spendingService.updateTransaction(id, data);
      if (!res.success || !res.data) throw new Error(res.message || 'Cập nhật giao dịch thất bại.');
      const updatedTransaction = {
        id: res.data._id || res.data.id || id,
        type: res.data.type,
        desc: res.data.desc || '',
        amount: Number(res.data.amount),
        category: res.data.category,
        date: res.data.date
      };
      const updated = get().transactions.map((transaction) => transaction.id === id ? updatedTransaction : transaction);
      saveStoredTxns(updated);
      set({ transactions: updated, editingTransaction: null, isLoading: false });
      get().updateSpendingMetrics(updated);
      return { success: true };
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
      return { success: true };
    } catch (err) {
      // Local removal
      const updated = get().transactions.filter((t) => t.id !== id);
      saveStoredTxns(updated);
      set({ transactions: updated, isLoading: false });
      get().updateSpendingMetrics(updated);
      return { success: true };
    }
  }
}));

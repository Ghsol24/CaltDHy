import { create } from 'zustand';
import { walletService } from '../services/walletService';
import { spendingService } from '../services/spendingService';
import { useTransactionStore } from './useTransactionStore';
import { calculateWalletBalances } from '../utils/financeMath';

const WALLET_KEY = 'caltdhy_wallets';

const getStoredWallets = () => {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredWallets = (wallets) => {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallets));
  } catch {}
};

const normalizeWallet = (w) => ({
  id: w._id || w.id,
  name: w.name || '',
  type: w.type || 'cash',
  icon: w.icon || (w.type === 'bank' ? '🏦' : w.type === 'credit' ? '💳' : w.type === 'e-wallet' ? '📱' : '💵'),
  color: w.color || '#078A59',
  initialBalance: Number(w.initialBalance ?? w.balance ?? 0),
  creditLimit: Number(w.creditLimit ?? 0),
  isExcludedFromTotal: Boolean(w.isExcludedFromTotal),
  isDefault: Boolean(w.isDefault),
  archived: Boolean(w.archived)
});

export const useWalletStore = create((set, get) => ({
  wallets: getStoredWallets(),
  selectedWalletId: null,
  isLoading: false,
  error: null,

  setSelectedWalletId: (id) => set({ selectedWalletId: id }),

  syncWalletBalances: () => {
    const currentWallets = get().wallets;
    const txns = useTransactionStore.getState()?.transactions || [];
    const { wallets: calculated } = calculateWalletBalances(currentWallets, txns);
    set({ wallets: calculated });
  },

  fetchWallets: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await walletService.getWallets();
      if (res.success && Array.isArray(res.data)) {
        const normalized = res.data.map(normalizeWallet);
        saveStoredWallets(normalized);
        const txns = useTransactionStore.getState()?.transactions || [];
        const { wallets: calculated } = calculateWalletBalances(normalized, txns);
        set({ wallets: calculated, isLoading: false });
        return { success: true, data: calculated };
      } else {
        throw new Error(res.message || 'Lỗi tải danh sách ví');
      }
    } catch (err) {
      const local = getStoredWallets().map(normalizeWallet);
      const txns = useTransactionStore.getState()?.transactions || [];
      const { wallets: calculated } = calculateWalletBalances(local, txns);
      set({ wallets: calculated, isLoading: false, error: err.message });
      return { success: false, error: err.message, data: calculated };
    }
  },

  createWallet: async (data) => {
    set({ isLoading: true });
    try {
      const res = await walletService.createWallet(data);
      if (res.success && res.data) {
        const newWallet = normalizeWallet(res.data);
        const prevWallets = get().wallets.map((w) =>
          data.isDefault ? { ...w, isDefault: false } : w
        );
        const updated = [...prevWallets, newWallet];
        saveStoredWallets(updated);
        const txns = useTransactionStore.getState()?.transactions || [];
        const { wallets: calculated } = calculateWalletBalances(updated, txns);
        set({ wallets: calculated, isLoading: false });
        return { success: true, data: newWallet };
      } else {
        throw new Error(res.message || 'Tạo ví mới thất bại.');
      }
    } catch (err) {
      // Offline fallback
      const newWallet = normalizeWallet({
        ...data,
        id: `local_wallet_${Date.now()}`
      });
      const prevWallets = get().wallets.map((w) =>
        data.isDefault ? { ...w, isDefault: false } : w
      );
      const updated = [...prevWallets, newWallet];
      saveStoredWallets(updated);
      const txns = useTransactionStore.getState()?.transactions || [];
      const { wallets: calculated } = calculateWalletBalances(updated, txns);
      set({ wallets: calculated, isLoading: false });
      return { success: true, data: newWallet, offline: true, error: err.message };
    }
  },

  updateWallet: async (id, data) => {
    set({ isLoading: true });
    try {
      const res = await walletService.updateWallet(id, data);
      if (!res.success || !res.data) {
        throw new Error(res.message || 'Cập nhật ví thất bại.');
      }
      const updatedWallet = normalizeWallet(res.data);
      const updated = get().wallets.map((w) => {
        if (w.id === id) return updatedWallet;
        if (data.isDefault) return { ...w, isDefault: false };
        return w;
      });
      saveStoredWallets(updated);
      const txns = useTransactionStore.getState()?.transactions || [];
      const { wallets: calculated } = calculateWalletBalances(updated, txns);
      set({ wallets: calculated, isLoading: false });
      return { success: true, data: updatedWallet };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteWallet: async (id) => {
    set({ isLoading: true });
    try {
      const res = await walletService.deleteWallet(id);
      if (!res.success) {
        throw new Error(res.message || 'Xóa ví thất bại.');
      }
      const updated = get().wallets.filter((w) => w.id !== id);
      saveStoredWallets(updated);

      // Re-fetch transactions because backend moved orphaned transactions to fallback wallet
      if (useTransactionStore.getState()?.fetchTransactions) {
        await useTransactionStore.getState().fetchTransactions();
      }

      const txns = useTransactionStore.getState()?.transactions || [];
      const { wallets: calculated } = calculateWalletBalances(updated, txns);
      set({ wallets: calculated, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  transferMoney: async ({ fromWalletId, toWalletId, amount, date, desc, fee }) => {
    set({ isLoading: true });
    try {
      const res = await spendingService.createTransaction({
        type: 'transfer',
        amount: Number(amount),
        date: date || new Date().toISOString().slice(0, 10),
        walletId: fromWalletId,
        toWalletId,
        desc: desc || 'Chuyển tiền',
        category: 'Chuyển tiền',
        fee: Number(fee) || 0
      });
      if (!res.success) {
        throw new Error(res.message || 'Chuyển tiền thất bại.');
      }

      // Fetch lại cả transactions và wallets sau khi chuyển tiền thành công
      await useTransactionStore.getState().fetchTransactions();
      await get().fetchWallets();
      set({ isLoading: false });
      return { success: true, data: res.data };
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  }
}));

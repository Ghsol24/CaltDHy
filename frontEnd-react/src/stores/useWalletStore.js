import { sessionEpoch, scopedSet, scopedGet } from '../services/sessionRuntime';
import { create } from 'zustand';
import { walletService } from '../services/walletService';
import { spendingService } from '../services/spendingService';
import { useTransactionStore } from './useTransactionStore';
import { calculateWalletBalances } from '../utils/financeMath';
import { getLocalDateString } from '../utils/formatters';

const getStoredWallets = () => [];

const saveStoredWallets = () => undefined;

const normalizeWallet = (w) => ({
  id: w._id || w.id,
  name: w.name || '',
  type: w.type || 'cash',
  icon: w.icon || w.type || 'cash',
  color: w.color || '#078A59',
  initialBalance: Number(w.initialBalance ?? w.balance ?? 0),
  creditLimit: Number(w.creditLimit ?? 0),
  isExcludedFromTotal: Boolean(w.isExcludedFromTotal),
  isDefault: Boolean(w.isDefault),
  archived: Boolean(w.archived)
});

export const useWalletStore = create((storeSet, storeGet) => {
const set = storeSet;
const get = storeGet;
return ({
  wallets: getStoredWallets(),
  archivedWallets: [],
  selectedWalletId: null,
  isLoading: false,
  error: null,

  setSelectedWalletId: (id) => set({ selectedWalletId: id }),

  syncWalletBalances: () => {
    const currentWallets = get().wallets;
    const currentArchived = get().archivedWallets;
    const txns = useTransactionStore.getState()?.transactions || [];
    const { wallets: calculatedActive } = calculateWalletBalances(currentWallets, txns);
    const { wallets: calculatedArchived } = calculateWalletBalances(currentArchived, txns);
    set({ wallets: calculatedActive, archivedWallets: calculatedArchived });
  },

  fetchWallets: async () => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    set({ isLoading: true, error: null });
    try {
      const res = await walletService.getWallets(true);
      if (res.success && Array.isArray(res.data)) {
        const normalized = res.data.map(normalizeWallet);
        const activeList = normalized.filter((w) => !w.archived);
        const archivedList = normalized.filter((w) => w.archived);

        saveStoredWallets(activeList);
        const txns = useTransactionStore.getState()?.transactions || [];
        const { wallets: calculatedActive } = calculateWalletBalances(activeList, txns);
        const { wallets: calculatedArchived } = calculateWalletBalances(archivedList, txns);

        set({
          wallets: calculatedActive,
          archivedWallets: calculatedArchived,
          isLoading: false
        });
        return { success: true, data: calculatedActive, archived: calculatedArchived };
      } else {
        throw new Error(res.message || 'Lỗi tải danh sách ví');
      }
    } catch (error) { set({ isLoading: false, error: error.message }); return { success: false, error: error.message }; }
  },

  createWallet: async (data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
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
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  updateWallet: async (id, data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
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
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  deleteWallet: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await walletService.deleteWallet(id);
      if (!res.success) {
        throw new Error(res.message || 'Xóa ví thất bại.');
      }
      // Re-fetch transactions because backend moved orphaned transactions to fallback wallet
      if (useTransactionStore.getState()?.fetchTransactions) {
        await useTransactionStore.getState().fetchTransactions();
      }

      // Tải lại danh sách ví từ server để cập nhật initialBalance mới của ví mặc định (đã được cộng dồn)
      await get().fetchWallets();
      set({ isLoading: false });
      return { success: true };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  archiveWallet: async (id, options = {}) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await walletService.archiveWallet(id, options);
      if (!res.success) {
        throw new Error(res.message || 'Không thể đóng và lưu trữ ví.');
      }

      // Nếu có chuyển tiền tất toán, fetch lại transactions
      if (options.transferToWalletId && useTransactionStore.getState()?.fetchTransactions) {
        await useTransactionStore.getState().fetchTransactions();
      }

      // Tải lại danh sách ví
      await get().fetchWallets();
      set({ isLoading: false });
      return { success: true, data: res.data };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  unarchiveWallet: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await walletService.unarchiveWallet(id);
      if (!res.success) {
        throw new Error(res.message || 'Không thể mở lại ví.');
      }
      await get().fetchWallets();
      set({ isLoading: false });
      return { success: true, data: res.data };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  transferMoney: async ({ fromWalletId, toWalletId, amount, date, desc, fee }) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    set({ isLoading: true });
    try {
      const res = await spendingService.createTransaction({
        type: 'transfer',
        amount: Number(amount),
        date: date || getLocalDateString(),
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
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  }
});
});

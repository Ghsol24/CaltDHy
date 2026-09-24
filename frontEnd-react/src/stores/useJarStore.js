import { sessionEpoch, scopedSet, scopedGet } from '../services/sessionRuntime';
import { create } from 'zustand';
import { jarsService } from '../services/jarsService';
import { useTransactionStore } from './useTransactionStore';
import { useWalletStore } from './useWalletStore';
const getStoredJars = () => [];

const saveStoredJars = () => undefined;

const getStoredInstallments = () => [];

const saveStoredInstallments = () => undefined;

const normalizeJar = (j) => ({
  id: j._id || j.id,
  name: j.name || '',
  category: j.category || 'Mục tiêu chung',
  target: Number(j.target) || 0,
  current: Number(j.current) || 0,
  targetDate: j.targetDate || null,
  icon: j.icon || '🫙',
  color: j.color || '#5356F1',
  history: Array.isArray(j.history)
    ? j.history.map((h) => ({
        id: h._id || h.id || `hist_${Date.now()}_${Math.random()}`,
        type: h.type,
        amount: Number(h.amount) || 0,
        reason: h.reason || '',
        date: h.date || new Date().toISOString()
      }))
    : [],
  createdAt: j.createdAt || null,
  updatedAt: j.updatedAt || null
});

const normalizeInstallment = (i) => ({
  id: i._id || i.id,
  name: i.name || '',
  category: i.category || 'Housing & Bills',
  icon: i.icon || 'recurring',
  amount: Number(i.amount) || 0,
  cycle: i.cycle || 'monthly',
  nextDueDate: i.nextDueDate || null,
  active: i.active !== undefined ? i.active : (i.isActive !== undefined ? i.isActive : true),
  totalPaid: Number(i.totalPaid) || 0,
  history: Array.isArray(i.history) ? i.history : [],
  totalAmount: Number(i.totalAmount || i.amount) || 0,
  remainingAmount: Number(i.remainingAmount) || 0,
  monthlyAmount: Number(i.monthlyAmount || i.amount) || 0,
  dueDate: i.dueDate || i.nextDueDate || null,
  totalMonths: Number(i.totalMonths) || 0,
  paidMonths: Number(i.paidMonths) || 0,
  walletId: (i.walletId && typeof i.walletId === 'object') ? (i.walletId._id || i.walletId.id) : (i.walletId || null),
  isActive: i.active !== undefined ? i.active : (i.isActive !== undefined ? i.isActive : true)
});

export const useJarStore = create((storeSet, storeGet) => {
return ({
  jars: getStoredJars(),
  installments: getStoredInstallments(),
  isLoading: false,
  hasLoaded: false,
  error: null,

  fetchData: async () => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    set({ isLoading: true, error: null });
    try {
      const [jarsResponse, installmentsResponse] = await Promise.all([
        jarsService.getJars(),
        jarsService.getInstallments()
      ]);
      const jarsData = (jarsResponse.data || []).map(normalizeJar);
      const instData = (installmentsResponse.data || []).map(normalizeInstallment);

      saveStoredJars(jarsData);
      saveStoredInstallments(instData);

      set({
        jars: jarsData,
        installments: instData,
        isLoading: false,
        hasLoaded: true
      });
    } catch (error) { set({ isLoading: false, hasLoaded: true, error: error.message }); return { success: false, error: error.message }; }
  },

  createJar: async (data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = await jarsService.createJar(data);
      const newJar = normalizeJar(response.data);
      const updated = [newJar, ...get().jars];
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: newJar };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  updateJar: async (id, data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = await jarsService.updateJar(id, data);
      const updatedJar = normalizeJar(response.data);
      const updated = get().jars.map((jar) => (jar.id === id ? updatedJar : jar));
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: updatedJar };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  updateJarBalance: async (id, action, amount, reason, walletId = null) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = action === 'deposit'
        ? await jarsService.deposit(id, amount, reason, walletId)
        : await jarsService.withdraw(id, amount, reason, walletId);
      const updatedJar = normalizeJar(response.data);
      const updated = get().jars.map((jar) => (jar.id === id ? updatedJar : jar));
      saveStoredJars(updated);
      set({ jars: updated });
      // Tự động đồng bộ giao dịch và số dư ví sau khi nạp/rút hũ
      useTransactionStore.getState()?.fetchTransactions?.();
      useWalletStore.getState()?.fetchWallets?.();
      return { success: true, data: updatedJar };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  deleteJar: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      await jarsService.deleteJar(id);
      const updated = get().jars.filter((jar) => jar.id !== id);
      saveStoredJars(updated);
      set({ jars: updated });
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  createInstallment: async (data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = await jarsService.createInstallment(data);
      const newInst = normalizeInstallment(response.data);
      const updated = [...get().installments, newInst];
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  updateInstallment: async (id, data) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = await jarsService.updateInstallment(id, data);
      const updatedInst = normalizeInstallment(response.data);
      const updated = get().installments.map((item) => (item.id === id ? updatedInst : item));
      saveStoredInstallments(updated);
      set({ installments: updated });

      // Đồng bộ lại transactions và budgets nếu category hoặc name có thay đổi
      if (data && (data.category !== undefined || data.name !== undefined)) {
        useTransactionStore.getState()?.fetchTransactions?.();
        useTransactionStore.getState()?.fetchBudgets?.();
      }

      return { success: true, data: updatedInst };
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  payInstallment: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = await jarsService.payInstallment(id, get().installments.find(item => item.id === id)?.nextDueDate);
      const updatedInst = normalizeInstallment(response.data);
      const updated = get().installments.map((item) => (item.id === id ? updatedInst : item));
      saveStoredInstallments(updated);
      set({ installments: updated });
      // Tự động đồng bộ giao dịch chi tiêu mới và số dư ví sau khi thanh toán định kỳ
      useTransactionStore.getState()?.fetchTransactions?.();
      useWalletStore.getState()?.fetchWallets?.();
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  toggleInstallment: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      const response = await jarsService.toggleInstallment(id);
      const updatedInst = normalizeInstallment(response.data);
      const updated = get().installments.map((item) => (item.id === id ? updatedInst : item));
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  },

  deleteInstallment: async (id) => {
    const epoch = sessionEpoch();
    const set = scopedSet(epoch, storeSet);
    const get = scopedGet(epoch, storeGet);
    try {
      await jarsService.deleteInstallment(id);
      const updated = get().installments.filter((item) => item.id !== id);
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (error) { set({ isLoading: false, error: error.message }); throw error; }
  }
});
});

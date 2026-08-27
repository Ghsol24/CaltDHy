import { create } from 'zustand';
import { jarsService } from '../services/jarsService';

const JARS_KEY = 'caltdhy_jars';
const INSTALLMENTS_KEY = 'caltdhy_installments';

const getStoredJars = () => {
  try {
    const raw = localStorage.getItem(JARS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredJars = (jars) => {
  try {
    localStorage.setItem(JARS_KEY, JSON.stringify(jars));
  } catch {}
};

const getStoredInstallments = () => {
  try {
    const raw = localStorage.getItem(INSTALLMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredInstallments = (items) => {
  try {
    localStorage.setItem(INSTALLMENTS_KEY, JSON.stringify(items));
  } catch {}
};

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
  icon: i.icon || '💳',
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
  isActive: i.active !== undefined ? i.active : (i.isActive !== undefined ? i.isActive : true)
});

export const useJarStore = create((set, get) => ({
  jars: getStoredJars(),
  installments: getStoredInstallments(),
  isLoading: false,
  error: null,

  fetchData: async () => {
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
        isLoading: false
      });
    } catch (error) {
      const localJars = getStoredJars();
      const localInst = getStoredInstallments();
      set({
        jars: localJars,
        installments: localInst,
        isLoading: false,
        error: error.message || 'Không thể tải dữ liệu hũ.'
      });
    }
  },

  createJar: async (data) => {
    try {
      const response = await jarsService.createJar(data);
      const newJar = normalizeJar(response.data);
      const updated = [newJar, ...get().jars];
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: newJar };
    } catch (err) {
      const numInit = Number(data.current) || 0;
      const initialHist = numInit > 0 ? [{
        id: `hist_init_${Date.now()}`,
        type: 'deposit',
        amount: numInit,
        reason: 'Số dư ban đầu khi tạo hũ',
        date: new Date().toISOString()
      }] : [];
      const fallbackJar = normalizeJar({
        ...data,
        id: `local_jar_${Date.now()}`,
        history: initialHist,
        createdAt: new Date().toISOString()
      });
      const updated = [fallbackJar, ...get().jars];
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: fallbackJar, offline: true };
    }
  },

  updateJar: async (id, data) => {
    try {
      const response = await jarsService.updateJar(id, data);
      const updatedJar = normalizeJar(response.data);
      const updated = get().jars.map((jar) => (jar.id === id ? updatedJar : jar));
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: updatedJar };
    } catch (err) {
      const updated = get().jars.map((jar) => (jar.id === id ? { ...jar, ...data } : jar));
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: { id, ...data }, offline: true };
    }
  },

  updateJarBalance: async (id, action, amount, reason, walletId = null) => {
    try {
      const response = action === 'deposit'
        ? await jarsService.deposit(id, amount, reason, walletId)
        : await jarsService.withdraw(id, amount, reason, walletId);
      const updatedJar = normalizeJar(response.data);
      const updated = get().jars.map((jar) => (jar.id === id ? updatedJar : jar));
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: updatedJar };
    } catch (err) {
      // Chỉ áp dụng fallback lưu-cục-bộ khi THỰC SỰ mất kết nối (api.js gán status 503
      // riêng cho trường hợp "Failed to fetch"). Nếu server đã phản hồi và từ chối hợp lệ
      // (400 không đủ số dư, ví không hợp lệ...) thì phải ném lỗi ra ngoài để UI báo đúng,
      // tuyệt đối không được âm thầm coi là "thành công offline".
      if (err.status && err.status !== 503) {
        throw err;
      }
      const targetJar = get().jars.find((j) => j.id === id);
      const numAmt = Number(amount) || 0;
      const newBalance = targetJar
        ? action === 'deposit'
          ? (targetJar.current || 0) + numAmt
          : Math.max(0, (targetJar.current || 0) - numAmt)
        : 0;
      const newEntry = {
        id: `local_hist_${Date.now()}`,
        type: action,
        amount: numAmt,
        reason: reason || '',
        date: new Date().toISOString()
      };
      const updated = get().jars.map((jar) => {
        if (jar.id !== id) return jar;
        const currentHist = Array.isArray(jar.history) ? jar.history : [];
        return { ...jar, current: newBalance, history: [newEntry, ...currentHist] };
      });
      saveStoredJars(updated);
      set({ jars: updated });
      return { success: true, data: { id, current: newBalance }, offline: true };
    }
  },

  deleteJar: async (id) => {
    try {
      if (!String(id).startsWith('local_')) {
        await jarsService.deleteJar(id);
      }
      const updated = get().jars.filter((jar) => jar.id !== id);
      saveStoredJars(updated);
      set({ jars: updated });
    } catch (err) {
      const updated = get().jars.filter((jar) => jar.id !== id);
      saveStoredJars(updated);
      set({ jars: updated });
    }
  },

  createInstallment: async (data) => {
    try {
      const response = await jarsService.createInstallment(data);
      const newInst = normalizeInstallment(response.data);
      const updated = [...get().installments, newInst];
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (err) {
      const fallbackInst = normalizeInstallment({
        ...data,
        id: `local_inst_${Date.now()}`
      });
      const updated = [...get().installments, fallbackInst];
      saveStoredInstallments(updated);
      set({ installments: updated });
    }
  },

  payInstallment: async (id) => {
    try {
      const response = await jarsService.payInstallment(id);
      const updatedInst = normalizeInstallment(response.data);
      const updated = get().installments.map((item) => (item.id === id ? updatedInst : item));
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (err) {
      const updated = get().installments.map((item) => {
        if (item.id !== id) return item;
        const newPaid = (item.paidMonths || 0) + 1;
        const newRemaining = Math.max(0, (item.remainingAmount || 0) - (item.monthlyAmount || 0));
        return { ...item, paidMonths: newPaid, remainingAmount: newRemaining };
      });
      saveStoredInstallments(updated);
      set({ installments: updated });
    }
  },

  toggleInstallment: async (id) => {
    try {
      const response = await jarsService.toggleInstallment(id);
      const updatedInst = normalizeInstallment(response.data);
      const updated = get().installments.map((item) => (item.id === id ? updatedInst : item));
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (err) {
      const updated = get().installments.map((item) => (item.id === id ? { ...item, isActive: !item.isActive } : item));
      saveStoredInstallments(updated);
      set({ installments: updated });
    }
  },

  deleteInstallment: async (id) => {
    try {
      if (!String(id).startsWith('local_')) {
        await jarsService.deleteInstallment(id);
      }
      const updated = get().installments.filter((item) => item.id !== id);
      saveStoredInstallments(updated);
      set({ installments: updated });
    } catch (err) {
      const updated = get().installments.filter((item) => item.id !== id);
      saveStoredInstallments(updated);
      set({ installments: updated });
    }
  }
}));

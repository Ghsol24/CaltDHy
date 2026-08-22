import { create } from 'zustand';
import { jarsService } from '../services/jarsService';

export const useJarStore = create((set, get) => ({
  jars: [],
  installments: [],
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [jarsResponse, installmentsResponse] = await Promise.all([jarsService.getJars(), jarsService.getInstallments()]);
      set({
        jars: jarsResponse.data || [],
        installments: installmentsResponse.data || [],
        isLoading: false
      });
    } catch (error) {
      set({ isLoading: false, error: error.message || 'Không thể tải dữ liệu hũ.' });
    }
  },

  createJar: async (data) => {
    const response = await jarsService.createJar(data);
    set({ jars: [response.data, ...get().jars] });
  },

  updateJarBalance: async (id, action, amount, reason) => {
    const response = action === 'deposit'
      ? await jarsService.deposit(id, amount, reason)
      : await jarsService.withdraw(id, amount, reason);
    set({ jars: get().jars.map((jar) => jar.id === id ? response.data : jar) });
  },

  deleteJar: async (id) => {
    await jarsService.deleteJar(id);
    set({ jars: get().jars.filter((jar) => jar.id !== id) });
  },

  createInstallment: async (data) => {
    const response = await jarsService.createInstallment(data);
    set({ installments: [...get().installments, response.data] });
  },

  payInstallment: async (id) => {
    const response = await jarsService.payInstallment(id);
    set({ installments: get().installments.map((item) => item.id === id ? response.data : item) });
  },

  toggleInstallment: async (id) => {
    const response = await jarsService.toggleInstallment(id);
    set({ installments: get().installments.map((item) => item.id === id ? response.data : item) });
  },

  deleteInstallment: async (id) => {
    await jarsService.deleteInstallment(id);
    set({ installments: get().installments.filter((item) => item.id !== id) });
  }
}));

import { create } from 'zustand';

export const useSpendingStore = create((set, get) => ({
  activeView: 'home',
  railCollapsed: (() => {
    try {
      return localStorage.getItem('railCollapsed') === 'true';
    } catch (_) {
      return false;
    }
  })(),

  totalBalance: 24811500, // Default display value
  monthlyIncome: 6200000,
  monthlyExpense: 1843000,

  isAddTxnOpen: false,
  isNumpadOpen: false,
  isSettingsOpen: false,
  isWrapupOpen: false,
  isAccountOpen: false,
  isHelpOpen: false,

  setActiveView: (view) => set({ activeView: view }),

  toggleRail: () => {
    const next = !get().railCollapsed;
    try {
      localStorage.setItem('railCollapsed', String(next));
    } catch (_) {}
    set({ railCollapsed: next });
  },

  setMetrics: ({ balance, income, expense }) =>
    set((state) => ({
      totalBalance: balance !== undefined ? balance : state.totalBalance,
      monthlyIncome: income !== undefined ? income : state.monthlyIncome,
      monthlyExpense: expense !== undefined ? expense : state.monthlyExpense
    })),

  openAddTxnModal: () => set({ isAddTxnOpen: true }),
  closeAddTxnModal: () => set({ isAddTxnOpen: false }),

  openNumpadModal: () => set({ isNumpadOpen: true }),
  closeNumpadModal: () => set({ isNumpadOpen: false }),

  openSettingsModal: () => set({ isSettingsOpen: true }),
  closeSettingsModal: () => set({ isSettingsOpen: false }),

  openWrapupModal: () => set({ isWrapupOpen: true }),
  closeWrapupModal: () => set({ isWrapupOpen: false }),

  openAccountModal: () => set({ isAccountOpen: true }),
  closeAccountModal: () => set({ isAccountOpen: false }),

  openHelpModal: () => set({ isHelpOpen: true }),
  closeHelpModal: () => set({ isHelpOpen: false })
}));

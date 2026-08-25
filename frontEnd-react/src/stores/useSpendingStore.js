import { create } from 'zustand';

export const useSpendingStore = create((set) => ({
  activeView: 'home', // 'home' | 'plan' | 'analytics' | 'jars'
  planSubTab: 'wallets', // 'wallets' | 'budgets' | 'recurring'
  analyticsSubTab: 'overview', // 'overview' | 'spending' | 'cash-flow' | 'reports'
  jarsSubTab: 'jars', // 'jars' | 'goals' | 'history'
  isSidebarCollapsed: false,
  selectedMonth: new Date().toISOString().slice(0, 7), // 'YYYY-MM'

  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,

  isAddTxnOpen: false,
  isSettingsOpen: false,
  isWrapupOpen: false,
  isAccountOpen: false,
  isHelpOpen: false,

  setActiveView: (view) => set({ activeView: view }),
  setPlanSubTab: (subTab) => set({ planSubTab: subTab }),
  setAnalyticsSubTab: (subTab) => set({ analyticsSubTab: subTab }),
  setJarsSubTab: (subTab) => set({ jarsSubTab: subTab }),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSelectedMonth: (month) => set({ selectedMonth: month }),

  setMetrics: ({ balance, income, expense }) =>
    set((state) => ({
      totalBalance: balance !== undefined ? balance : state.totalBalance,
      monthlyIncome: income !== undefined ? income : state.monthlyIncome,
      monthlyExpense: expense !== undefined ? expense : state.monthlyExpense
    })),

  openAddTxnModal: () => set({ isAddTxnOpen: true }),
  closeAddTxnModal: () => set({ isAddTxnOpen: false }),

  openSettingsModal: () => set({ isSettingsOpen: true }),
  closeSettingsModal: () => set({ isSettingsOpen: false }),

  openWrapupModal: () => set({ isWrapupOpen: true }),
  closeWrapupModal: () => set({ isWrapupOpen: false }),

  openAccountModal: () => set({ isAccountOpen: true }),
  closeAccountModal: () => set({ isAccountOpen: false }),

  openHelpModal: () => set({ isHelpOpen: true }),
  closeHelpModal: () => set({ isHelpOpen: false })
}));

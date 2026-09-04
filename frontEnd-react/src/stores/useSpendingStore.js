import { create } from 'zustand';
import { getLocalMonthString } from '../utils/formatters';

export const useSpendingStore = create((set) => ({
  activeView: 'home', // 'home' | 'plan' | 'analytics' | 'jars'
  planSubTab: 'overview', // 'overview' | 'wallets' | 'budgets' | 'recurring'
  analyticsSubTab: 'overview', // 'overview' | 'spending' | 'cash-flow' | 'reports'
  jarsSubTab: 'goals', // 'goals' | 'jars' | 'history'
  isSidebarCollapsed: false,
  selectedMonth: getLocalMonthString(), // 'YYYY-MM' theo giờ địa phương

  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,

  isAddTxnOpen: false,
  addTxnInitialState: null,
  isSettingsOpen: false,
  isWrapupOpen: false,
  isAccountOpen: false,
  isHelpOpen: false,

  setActiveView: (view) =>
    set((state) => ({
      activeView: view,
      planSubTab: view === 'plan' ? 'overview' : state.planSubTab
    })),
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

  openAddTxnModal: (initialState = null) =>
    set({ isAddTxnOpen: true, addTxnInitialState: initialState }),
  closeAddTxnModal: () =>
    set({ isAddTxnOpen: false, addTxnInitialState: null }),

  openSettingsModal: () => set({ isSettingsOpen: true }),
  closeSettingsModal: () => set({ isSettingsOpen: false }),

  openWrapupModal: () => set({ isWrapupOpen: true }),
  closeWrapupModal: () => set({ isWrapupOpen: false }),

  openAccountModal: () => set({ isAccountOpen: true }),
  closeAccountModal: () => set({ isAccountOpen: false }),

  openHelpModal: () => set({ isHelpOpen: true }),
  closeHelpModal: () => set({ isHelpOpen: false })
}));

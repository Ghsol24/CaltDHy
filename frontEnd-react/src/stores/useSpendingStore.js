import { create } from 'zustand';
import { getLocalMonthString } from '../utils/formatters';

export const useSpendingStore = create((set) => ({
  activeView: 'home', // 'home' | 'plan' | 'analytics' | 'jars'
  planSubTab: 'overview', // 'overview' | 'wallets' | 'budgets' | 'recurring'
  analyticsSubTab: 'overview', // 'overview' | 'spending' | 'cash-flow' | 'reports'
  analyticsExcludeRecurring: false,
  jarsSubTab: 'goals', // 'goals' | 'jars' | 'history'
  isSidebarCollapsed: false,
  selectedMonth: getLocalMonthString(), // 'YYYY-MM' theo giờ địa phương

  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,

  isAddTxnOpen: false,
  addTxnInitialState: null,
  isSettingsOpen: false,
  settingsSection: 'general',
  isSettingsHome: true,
  settingsNavigationRequest: null,
  isWrapupOpen: false,
  isHelpOpen: false,

  routeRevision: 0,
  routeMode: 'push',

  setActiveView: (view, options = {}) =>
    set((state) => {
      if (state.activeView === view && (view !== 'plan' || state.planSubTab === 'overview')) {
        return state;
      }
      return {
        activeView: view,
        planSubTab: view === 'plan' ? 'overview' : state.planSubTab,
        ...(options.syncRoute === false ? {} : {
          routeRevision: state.routeRevision + 1,
          routeMode: options.replace ? 'replace' : 'push'
        })
      };
    }),
  setPlanSubTab: (subTab, options = {}) =>
    set((state) => (state.planSubTab === subTab ? state : {
      planSubTab: subTab,
      ...(options.syncRoute === false ? {} : { routeRevision: state.routeRevision + 1, routeMode: options.replace ? 'replace' : 'push' })
    })),
  setAnalyticsSubTab: (subTab, options = {}) =>
    set((state) => (state.analyticsSubTab === subTab ? state : {
      analyticsSubTab: subTab,
      ...(options.syncRoute === false ? {} : { routeRevision: state.routeRevision + 1, routeMode: options.replace ? 'replace' : 'push' })
    })),
  setAnalyticsExcludeRecurring: (excludeRecurring) =>
    set((state) => (state.analyticsExcludeRecurring === Boolean(excludeRecurring) ? state : {
      analyticsExcludeRecurring: Boolean(excludeRecurring),
    })),
  hydrateAnalyticsExcludeRecurring: (excludeRecurring) =>
    set((state) => {
      const nextValue = typeof excludeRecurring === 'boolean' ? excludeRecurring : false;
      return state.analyticsExcludeRecurring === nextValue ? state : {
        analyticsExcludeRecurring: nextValue,
      };
    }),
  setJarsSubTab: (subTab, options = {}) =>
    set((state) => (state.jarsSubTab === subTab ? state : {
      jarsSubTab: subTab,
      ...(options.syncRoute === false ? {} : { routeRevision: state.routeRevision + 1, routeMode: options.replace ? 'replace' : 'push' })
    })),
  navigateTo: (view, subTab = null, options = {}) =>
    set((state) => ({
      activeView: view,
      ...(view === 'plan' ? { planSubTab: subTab || 'overview' } : {}),
      ...(view === 'analytics' ? { analyticsSubTab: subTab || 'overview' } : {}),
      ...(view === 'jars' ? { jarsSubTab: subTab || 'goals' } : {}),
      routeRevision: state.routeRevision + 1,
      routeMode: options.replace ? 'replace' : 'push'
    })),
  syncFromRoute: (view, subTab) =>
    set((state) => ({
      activeView: view,
      ...(view === 'plan' ? { planSubTab: subTab || 'overview' } : {}),
      ...(view === 'analytics' ? { analyticsSubTab: subTab || 'overview' } : {}),
      ...(view === 'jars' ? { jarsSubTab: subTab || 'goals' } : {}),
      routeMode: state.routeMode
    })),
  setSidebarCollapsed: (collapsed) =>
    set((state) => (state.isSidebarCollapsed === collapsed ? state : { isSidebarCollapsed: collapsed })),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSelectedMonth: (month) =>
    set((state) => (state.selectedMonth === month ? state : { selectedMonth: month })),

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

  openSettingsModal: (section) => set((state) => state.isSettingsOpen
    // Let the mounted dialog protect drafts before changing its screen.
    ? { settingsNavigationRequest: { section: section || 'home' } }
    : {
      isSettingsOpen: true,
      settingsSection: section || 'general',
      isSettingsHome: !section,
      settingsNavigationRequest: null
    }),
  consumeSettingsNavigationRequest: (request) => set((state) => (
    state.settingsNavigationRequest === request ? { settingsNavigationRequest: null } : state
  )),
  setSettingsSection: (section) => set({ settingsSection: section, isSettingsHome: false }),
  showSettingsHome: () => set({ isSettingsHome: true }),
  closeSettingsModal: () => set({ isSettingsOpen: false, settingsNavigationRequest: null }),

  openWrapupModal: () => set({ isWrapupOpen: true }),
  closeWrapupModal: () => set({ isWrapupOpen: false }),

  openHelpModal: () => set({ isHelpOpen: true }),
  closeHelpModal: () => set({ isHelpOpen: false })
}));

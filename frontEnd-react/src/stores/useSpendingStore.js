import { create } from 'zustand';
import { getLocalMonthString } from '../utils/formatters';

export const useSpendingStore = create((set) => ({
  activeView: 'home', // 'home' | 'plan' | 'analytics' | 'jars'
  planSubTab: 'overview', // 'overview' | 'wallets' | 'budgets' | 'recurring'
  analyticsSubTab: 'overview', // 'overview' | 'spending' | 'cash-flow' | 'reports'
  analyticsExcludeRecurring: false,
  // Block being read on the long computer "Tóm tắt thu chi" page ('spending' |
  // 'cash-flow' | 'reports' | null). Only a secondary sidebar cue: it never
  // changes analyticsSubTab, the URL or the current page (đợt 13b).
  analyticsInViewSection: null,
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
  isHelpOpen: false,
  // One-shot hand-off from the command palette to a screen that owns the dialog,
  // e.g. { action: 'transfer' } opens WalletsTab's transfer form once it mounts.
  commandRequest: null,

  routeRevision: 0,
  routeMode: 'push',

  setPlanSubTab: (subTab, options = {}) =>
    set((state) => (state.planSubTab === subTab ? state : {
      planSubTab: subTab,
      routeRevision: state.routeRevision + 1,
      routeMode: options.replace ? 'replace' : 'push'
    })),
  setAnalyticsExcludeRecurring: (excludeRecurring) =>
    set((state) => (state.analyticsExcludeRecurring === Boolean(excludeRecurring) ? state : {
      analyticsExcludeRecurring: Boolean(excludeRecurring),
    })),
  setAnalyticsInViewSection: (section) =>
    set((state) => (state.analyticsInViewSection === (section ?? null) ? state : {
      analyticsInViewSection: section ?? null,
    })),
  hydrateAnalyticsExcludeRecurring: (excludeRecurring) =>
    set((state) => {
      const nextValue = typeof excludeRecurring === 'boolean' ? excludeRecurring : false;
      return state.analyticsExcludeRecurring === nextValue ? state : {
        analyticsExcludeRecurring: nextValue,
      };
    }),
  navigateTo: (view, subTab = null, options = {}) =>
    set((state) => ({
      activeView: view,
      ...(view === 'plan' ? { planSubTab: subTab || 'overview' } : {}),
      ...(view === 'analytics' ? { analyticsSubTab: subTab || 'overview' } : {}),
      routeRevision: state.routeRevision + 1,
      routeMode: options.replace ? 'replace' : 'push'
    })),
  syncFromRoute: (view, subTab) =>
    set((state) => ({
      activeView: view,
      ...(view === 'plan' ? { planSubTab: subTab || 'overview' } : {}),
      ...(view === 'analytics' ? { analyticsSubTab: subTab || 'overview' } : {}),
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

  requestCommand: (action, payload = {}) => set({ commandRequest: { ...payload, action, at: Date.now() } }),
  consumeCommandRequest: (request) => set((state) => (
    state.commandRequest === request ? { commandRequest: null } : state
  )),

  openHelpModal: () => set({ isHelpOpen: true }),
  closeHelpModal: () => set({ isHelpOpen: false })
}));

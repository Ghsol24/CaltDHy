import React, { Suspense, lazy, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useSpendingStore } from '../stores/useSpendingStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useWalletStore } from '../stores/useWalletStore';
import { useJarStore } from '../stores/useJarStore';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { MoneyDisplayGuard } from '../components/ui/MoneyDisplayGuard';
import { PageSkeleton } from '../components/ui/PageSkeleton';
import { getLocalMonthString } from '../utils/formatters';
import { SpendingRouteSync } from '../components/layout/SpendingRouteSync';
import { useLangStore } from '../stores/useLangStore';
import { useCurrencyStore } from '../stores/useCurrencyStore';

const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const HomeView = lazyNamed(() => import('../features/home/HomeView'), 'HomeView');
const PlanView = lazyNamed(() => import('../features/plan/PlanView'), 'PlanView');
const AnalyticsView = lazyNamed(() => import('../features/analytics/AnalyticsView'), 'AnalyticsView');
const TransactionHistoryView = lazyNamed(() => import('../features/transactions/TransactionHistoryView'), 'TransactionHistoryView');
const JarsView = lazyNamed(() => import('../features/jars/JarsView'), 'JarsView');
const TransactionModal = lazyNamed(() => import('../features/transactions/TransactionModal'), 'TransactionModal');
const AppUtilities = lazyNamed(() => import('../components/ui/AppUtilities'), 'AppUtilities');

export function SpendingPage() {
  const lang = useLangStore((state) => state.lang);
  const displayCurrency = useCurrencyStore((state) => state.displayCurrency);
  const activeView = useSpendingStore((s) => s.activeView);
  const analyticsSubTab = useSpendingStore((s) => s.analyticsSubTab);
  const fetchTransactions = useTransactionStore((s) => s.fetchTransactions);
  const fetchBudgets = useTransactionStore((s) => s.fetchBudgets);
  const fetchWallets = useWalletStore((s) => s.fetchWallets);
  const fetchJarData = useJarStore((s) => s.fetchData);
  const isTxnsLoading = useTransactionStore((s) => s.isLoading);
  const hasLoadedTransactions = useTransactionStore((s) => s.hasLoadedTransactions);
  const isInitialLoading = isTxnsLoading && !hasLoadedTransactions;

  useEffect(() => {
    const currentMonth = getLocalMonthString();
    fetchTransactions();
    fetchWallets();
    fetchBudgets(currentMonth);
    fetchJarData();
  }, [fetchTransactions, fetchWallets, fetchBudgets, fetchJarData]);

  return (
    <>
      <SpendingRouteSync />
      <AppShell key={`${lang}-${displayCurrency}`}>
      <ErrorBoundary>
        <MoneyDisplayGuard>
        {isInitialLoading ? (
          <PageSkeleton />
        ) : (
          <Suspense fallback={<PageSkeleton />}>
            {/* ── VIEW 1: HOME (DASHBOARD TỔNG QUAN & TIMELINE) ── */}
            {activeView === 'home' && <HomeView />}

            {/* ── VIEW 2: PLAN (VÍ TIỀN, HẠN MỨC NGÂN SÁCH & ĐỊNH KỲ) ── */}
            {activeView === 'plan' && <PlanView />}

            {/* ── VIEW 3: ANALYTICS (PHÂN TÍCH THU CHI) ── */}
            {activeView === 'analytics' && (analyticsSubTab === 'transactions'
              ? <TransactionHistoryView /> : <AnalyticsView />)}

            {/* ── VIEW 4: JARS (HŨ CHI TIÊU & TIẾT KIỆM) ── */}
            {activeView === 'jars' && <JarsView />}
          </Suspense>
        )}
        </MoneyDisplayGuard>
      </ErrorBoundary>

      {/* Global Modals */}
      <Suspense fallback={null}>
        <TransactionModal />
        <AppUtilities />
      </Suspense>
      </AppShell>
    </>
  );
}

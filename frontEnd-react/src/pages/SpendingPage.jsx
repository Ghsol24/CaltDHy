import React, { useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useSpendingStore } from '../stores/useSpendingStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useWalletStore } from '../stores/useWalletStore';
import { useJarStore } from '../stores/useJarStore';
import { HomeView } from '../features/home/HomeView';
import { PlanView } from '../features/plan/PlanView';
import { AnalyticsView } from '../features/analytics/AnalyticsView';
import { JarsView } from '../features/jars/JarsView';
import { TransactionModal } from '../features/transactions/TransactionModal';
import { AppUtilities } from '../components/ui/AppUtilities';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

export function SpendingPage() {
  const activeView = useSpendingStore((s) => s.activeView);
  const fetchTransactions = useTransactionStore((s) => s.fetchTransactions);
  const fetchBudgets = useTransactionStore((s) => s.fetchBudgets);
  const fetchWallets = useWalletStore((s) => s.fetchWallets);
  const fetchJarData = useJarStore((s) => s.fetchData);

  useEffect(() => {
    fetchTransactions();
    fetchWallets();
    fetchBudgets();
    fetchJarData();
  }, [fetchTransactions, fetchWallets, fetchBudgets, fetchJarData]);

  return (
    <AppShell>
      <ErrorBoundary>
        {/* ── VIEW 1: HOME (DASHBOARD TỔNG QUAN & TIMELINE) ── */}
        {activeView === 'home' && <HomeView />}

        {/* ── VIEW 2: PLAN (VÍ TIỀN, HẠN MỨC NGÂN SÁCH & ĐỊNH KỲ) ── */}
        {activeView === 'plan' && <PlanView />}

        {/* ── VIEW 3: ANALYTICS (PHÂN TÍCH THU CHI) ── */}
        {activeView === 'analytics' && <AnalyticsView />}

        {/* ── VIEW 4: JARS (HŨ CHI TIÊU & TIẾT KIỆM) ── */}
        {activeView === 'jars' && <JarsView />}
      </ErrorBoundary>

      {/* Global Modals */}
      <TransactionModal />
      <AppUtilities />
    </AppShell>
  );
}

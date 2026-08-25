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

export function SpendingPage() {
  const { activeView } = useSpendingStore();
  const { fetchTransactions, fetchBudgets } = useTransactionStore();
  const { fetchWallets } = useWalletStore();
  const { fetchData: fetchJarData } = useJarStore();

  useEffect(() => {
    fetchTransactions();
    fetchWallets();
    fetchBudgets();
    fetchJarData();
  }, [fetchTransactions, fetchWallets, fetchBudgets, fetchJarData]);

  return (
    <AppShell>
      {/* ── VIEW 1: HOME (DASHBOARD TỔNG QUAN & TIMELINE) ── */}
      {activeView === 'home' && <HomeView />}

      {/* ── VIEW 2: PLAN (VÍ TIỀN, HẠN MỨC NGÂN SÁCH & ĐỊNH KỲ) ── */}
      {activeView === 'plan' && <PlanView />}

      {/* ── VIEW 3: ANALYTICS (PHÂN TÍCH THU CHI) ── */}
      {activeView === 'analytics' && <AnalyticsView />}

      {/* ── VIEW 4: JARS (HŨ CHI TIÊU & TIẾT KIỆM) ── */}
      {activeView === 'jars' && <JarsView />}

      {/* Global Modals */}
      <TransactionModal />
      <AppUtilities />
    </AppShell>
  );
}

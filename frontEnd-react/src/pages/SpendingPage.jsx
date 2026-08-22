import React, { useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useSpendingStore } from '../stores/useSpendingStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { TransactionFilter } from '../features/transactions/TransactionFilter';
import { TransactionList } from '../features/transactions/TransactionList';
import { TransactionModal } from '../features/transactions/TransactionModal';
import { NumpadModal } from '../components/ui/NumpadModal';
import { AnalyticsView } from '../features/analytics/AnalyticsView';
import { JarsView } from '../features/jars/JarsView';
import { AppUtilities } from '../components/ui/AppUtilities';

export function SpendingPage() {
  const { activeView, openNumpadModal } = useSpendingStore();
  const { fetchTransactions } = useTransactionStore();

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <AppShell>
      {/* ── WELCOME BANNER (ONBOARDING) ── */}
      <div className="welcome-banner" role="region" aria-label="Chào mừng">
        <div className="welcome-banner__content">
          <div className="welcome-banner__badge">
            <span className="welcome-banner__dot"></span>
            <span>CHÀO MỪNG ĐẾN VỚI CALTDHY</span>
          </div>
          <h3 className="welcome-banner__title">Bắt đầu quản lý tài chính với 3 bước đơn giản</h3>
          <div className="welcome-banner__steps">
            <div className="wb-step">
              <span className="wb-step__num">1</span>
              <span className="wb-step__text">Ghi giao dịch thu / chi đầu tiên</span>
            </div>
            <div className="wb-step">
              <span className="wb-step__num">2</span>
              <span className="wb-step__text">Tạo hũ tiết kiệm theo mục tiêu</span>
            </div>
            <div className="wb-step">
              <span className="wb-step__num">3</span>
              <span className="wb-step__text">Theo dõi báo cáo phân tích tự động</span>
            </div>
          </div>
        </div>
        <div className="welcome-banner__actions">
          <button className="wb-btn-primary" onClick={openNumpadModal}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ghi giao dịch ngay
          </button>
        </div>
      </div>

      {/* VIEW PANEL 1: DASHBOARD HOME (TIMELINE GIAO DỊCH) */}
      {activeView === 'home' && (
        <div className="dashboard-home-view" style={{ padding: '20px 0' }}>
          <TransactionFilter />
          <TransactionList />
        </div>
      )}

      {/* VIEW PANEL 2: ANALYTICS */}
      {activeView === 'analytics' && (
        <AnalyticsView />
      )}

      {/* VIEW PANEL 3: JARS */}
      {activeView === 'jars' && (
        <JarsView />
      )}

      {/* Modals */}
      <TransactionModal />
      <NumpadModal />
      <AppUtilities />
    </AppShell>
  );
}

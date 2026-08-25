import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { calculateMonthlyStats } from '../../utils/financeMath';
import { AvailableToSpendCard } from './AvailableToSpendCard';
import { RecentTransactions } from './RecentTransactions';
import { AttentionPanel } from './AttentionPanel';

export function HomeView() {
  const { openAddTxnModal, selectedMonth } = useSpendingStore();
  const { transactions, budgets } = useTransactionStore();

  const currentMonthStr = selectedMonth || new Date().toISOString().slice(0, 7);
  const [, mStr] = currentMonthStr.split('-');
  const monthNum = parseInt(mStr, 10) || (new Date().getMonth() + 1);

  // Check if finances are generally in good health
  const monthlyStats = calculateMonthlyStats(transactions, currentMonthStr);
  let hasCriticalBudget = false;
  if (budgets && typeof budgets === 'object') {
    Object.entries(budgets).forEach(([category, limit]) => {
      const numLimit = Number(limit) || 0;
      if (numLimit > 0) {
        const spent = monthlyStats.byCategory[category] || 0;
        if (spent >= numLimit) {
          hasCriticalBudget = true;
        }
      }
    });
  }

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const lastUpdatedText = `Cập nhật lần cuối hôm nay, ${hours}:${minutes}`;

  return (
    <div className="home-dashboard-v2-container">
      {/* ── TOP HEADER ROW ── */}
      <div className="home-dashboard-header">
        <div className="home-dashboard-title-box">
          <h1 className="home-dashboard-greeting">
            {hasCriticalBudget
              ? `Tháng ${monthNum} của bạn cần chú ý`
              : `Tháng ${monthNum} của bạn đang ổn`}
          </h1>
          <p className="home-dashboard-updated">{lastUpdatedText}</p>
        </div>

        <button
          type="button"
          className="home-btn-add-txn"
          onClick={openAddTxnModal}
          aria-label="Thêm giao dịch mới"
        >
          <span className="home-btn-add-plus" aria-hidden="true">+</span>
          <span>Thêm giao dịch</span>
        </button>
      </div>

      {/* ── 2-COLUMN RESPONSIVE GRID ── */}
      <div className="home-dashboard-grid">
        {/* Left Column: Hero Card + Recent Transactions */}
        <div className="home-col-main">
          <AvailableToSpendCard />
          <RecentTransactions />
        </div>

        {/* Right Column: Sidebar Attention & Plan */}
        <div className="home-col-side">
          <AttentionPanel />
        </div>
      </div>
    </div>
  );
}

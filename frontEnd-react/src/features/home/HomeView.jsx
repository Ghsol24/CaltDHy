import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { calculateMonthlyStats } from '../../utils/financeMath';
import { getLocalMonthString } from '../../utils/formatters';
import { AvailableToSpendCard } from './AvailableToSpendCard';
import { RecentTransactions } from './RecentTransactions';
import { AttentionPanel } from './AttentionPanel';

export function HomeView() {
  const { openAddTxnModal, selectedMonth } = useSpendingStore();
  const { transactions, budgets } = useTransactionStore();

  const currentMonthStr = selectedMonth || getLocalMonthString();
  const [, mStr] = currentMonthStr.split('-');
  const monthNum = parseInt(mStr, 10) || (new Date().getMonth() + 1);

  // Check finance health & context
  const monthlyStats = calculateMonthlyStats(transactions, currentMonthStr);
  const hasTransactions = (transactions || []).some(
    (t) => (t.date || '').slice(0, 7) === currentMonthStr
  );
  
  let hasAnyBudget = false;
  let hasCriticalBudget = false;
  let hasWarningBudget = false;
  let totalBudgetLimit = 0;

  if (budgets && typeof budgets === 'object') {
    Object.entries(budgets).forEach(([category, limit]) => {
      const numLimit = Number(limit) || 0;
      if (numLimit > 0) {
        hasAnyBudget = true;
        totalBudgetLimit += numLimit;
        const spent = monthlyStats.byCategory[category] || 0;
        if (spent >= numLimit) {
          hasCriticalBudget = true;
        } else if (spent >= numLimit * 0.75) {
          hasWarningBudget = true;
        }
      }
    });
  }

  // Dynamic context-aware greeting
  let greeting = `Tháng ${monthNum} của bạn đang ổn`;
  if (!hasTransactions && !hasAnyBudget) {
    greeting = `Chào bạn, hãy bắt đầu quản lý tài chính tháng ${monthNum}`;
  } else if (!hasTransactions && hasAnyBudget) {
    greeting = `Tháng ${monthNum} đã sẵn sàng cho kế hoạch chi tiêu`;
  } else if (hasCriticalBudget) {
    greeting = `Tháng ${monthNum} có khoản đã vượt hạn mức!`;
  } else if (hasWarningBudget) {
    greeting = `Tháng ${monthNum} cần chú ý chi tiêu`;
  } else if (!hasAnyBudget && monthlyStats.totalExpense > 0) {
    greeting = `Tổng quan chi tiêu tháng ${monthNum}`;
  } else if (monthlyStats.totalIncome > 0 && monthlyStats.totalIncome > monthlyStats.totalExpense * 1.5) {
    greeting = `Dòng tiền tháng ${monthNum} đang tăng trưởng tích cực`;
  } else if (hasAnyBudget) {
    greeting = `Chi tiêu tháng ${monthNum} trong tầm kiểm soát`;
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
          <h1 className="home-dashboard-greeting">{greeting}</h1>
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

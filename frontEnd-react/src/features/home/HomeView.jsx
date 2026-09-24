import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { calculateMonthlyStats } from '../../utils/financeMath';
import { formatDate, formatTime, getLocalMonthString } from '../../utils/formatters';
import { AvailableToSpendCard } from './AvailableToSpendCard';
import { RecentTransactions } from './RecentTransactions';
import { AttentionPanel } from './AttentionPanel';
import { useTranslation } from '../../i18n/useTranslation';

export function HomeView() {
  const { t } = useTranslation();
  const openAddTxnModal = useSpendingStore((s) => s.openAddTxnModal);
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const setSelectedMonth = useSpendingStore((s) => s.setSelectedMonth);
  const transactions = useTransactionStore((s) => s.transactions);
  const budgets = useTransactionStore((s) => s.budgets);
  const budgetMonth = useTransactionStore((s) => s.budgetMonth);
  const fetchBudgets = useTransactionStore((s) => s.fetchBudgets);

  const currentMonthStr = getLocalMonthString();
  const monthLabel = formatDate(`${currentMonthStr}-01`, 'month');

  // Tự động kiểm tra và đồng bộ dữ liệu ngân sách chuẩn của tháng hiện tại khi mở Trang chủ
  React.useEffect(() => {
    if (budgetMonth !== currentMonthStr) {
      fetchBudgets(currentMonthStr);
    }
    if (selectedMonth !== currentMonthStr) {
      setSelectedMonth(currentMonthStr);
    }
  }, [budgetMonth, currentMonthStr, fetchBudgets, selectedMonth, setSelectedMonth]);

  // Check finance health & context
  const { greeting, lastUpdatedText } = React.useMemo(() => {
    const monthlyStats = calculateMonthlyStats(transactions, currentMonthStr);
    const hasTransactions = (transactions || []).some(
      (t) => (t.date || '').slice(0, 7) === currentMonthStr
    );
    
    let hasAnyBudget = false;
    let hasCriticalBudget = false;
    let hasWarningBudget = false;

    if (budgets && typeof budgets === 'object') {
      Object.entries(budgets).forEach(([category, limit]) => {
        const numLimit = Number(limit) || 0;
        if (numLimit > 0) {
          hasAnyBudget = true;
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
    let greetingKey = 'home.greetingOkay';
    if (!hasTransactions && !hasAnyBudget) {
      greetingKey = 'home.greetingStart';
    } else if (!hasTransactions && hasAnyBudget) {
      greetingKey = 'home.greetingReady';
    } else if (hasCriticalBudget) {
      greetingKey = 'home.greetingOver';
    } else if (hasWarningBudget) {
      greetingKey = 'home.greetingWarning';
    } else if (!hasAnyBudget && monthlyStats.expense > 0) {
      greetingKey = 'home.greetingSummary';
    } else if (monthlyStats.income > 0 && monthlyStats.income > monthlyStats.expense * 1.5) {
      greetingKey = 'home.greetingGrowing';
    } else if (hasAnyBudget) {
      greetingKey = 'home.greetingControlled';
    }

    const now = new Date();
    const updatedText = t('home.lastUpdated', { time: formatTime(now) });

    return { greeting: t(greetingKey, { month: monthLabel }), lastUpdatedText: updatedText };
  }, [transactions, budgets, currentMonthStr, monthLabel, t]);

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
          aria-label={t('home.addTransaction')}
        >
          <span className="home-btn-add-plus" aria-hidden="true">+</span>
          <span>{t('home.addTransaction')}</span>
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

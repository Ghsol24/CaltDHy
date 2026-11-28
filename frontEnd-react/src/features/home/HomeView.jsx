import React, { lazy, Suspense } from 'react';
import '../../i18n/homeTranslations';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { BUDGET_WARN_PERCENT, calculateMonthlyStats } from '../../utils/financeMath';
import { formatMonthYear, getLocalMonthString } from '../../utils/formatters';
import { AvailableToSpendCard } from './AvailableToSpendCard';
import { RecentTransactions } from './RecentTransactions';
import { AttentionPanel, HomeQuickLinks } from './AttentionPanel';
import { ReminderInviteCard } from './ReminderInviteCard';
import { useTranslation } from '../../i18n/useTranslation';
import { AlertTriangleOutlineIcon } from '../../components/ui/AppIcons';
import { PageHeader } from '../../components/ui/PageHeader';

const ForecastCard = lazy(() => import('../forecast/ForecastCard').then((module) => ({ default: module.ForecastCard })));

export function HomeView() {
  const { t } = useTranslation();
  const selectedMonth = useSpendingStore((s) => s.selectedMonth);
  const setSelectedMonth = useSpendingStore((s) => s.setSelectedMonth);
  const transactions = useTransactionStore((s) => s.transactions);
  const budgets = useTransactionStore((s) => s.budgets);
  const budgetMonth = useTransactionStore((s) => s.budgetMonth);
  const fetchBudgets = useTransactionStore((s) => s.fetchBudgets);

  const currentMonthStr = getLocalMonthString();
  // "Tháng 11" is the headline, "tháng 11" sits inside a sentence; the year shows only when it is not this year.
  const monthTitle = formatMonthYear(`${currentMonthStr}-01`, { omitCurrentYear: true });
  const monthInline = formatMonthYear(`${currentMonthStr}-01`, { omitCurrentYear: true, lowercase: true });

  // Tự động kiểm tra và đồng bộ dữ liệu ngân sách chuẩn của tháng hiện tại khi mở Trang chủ
  React.useEffect(() => {
    if (budgetMonth !== currentMonthStr) {
      fetchBudgets(currentMonthStr);
    }
    if (selectedMonth !== currentMonthStr) {
      setSelectedMonth(currentMonthStr);
    }
  }, [budgetMonth, currentMonthStr, fetchBudgets, selectedMonth, setSelectedMonth]);

  // The headline is just the month; the state of the month is one chip next to it and the
  // details live in the alert card, so "over the limit" is said once, not four times.
  const { status, isFreshStart } = React.useMemo(() => {
    const monthlyStats = calculateMonthlyStats(transactions, currentMonthStr);
    const hasTransactions = (transactions || []).some(
      (t) => (t.date || '').slice(0, 7) === currentMonthStr
    );

    let hasAnyBudget = false;
    let overCount = 0;
    let nearCount = 0;

    if (budgets && typeof budgets === 'object') {
      Object.entries(budgets).forEach(([category, limit]) => {
        const numLimit = Number(limit) || 0;
        if (numLimit > 0) {
          hasAnyBudget = true;
          const spent = monthlyStats.byCategory[category] || 0;
          if (spent >= numLimit) overCount += 1;
          else if (spent * 100 >= numLimit * BUDGET_WARN_PERCENT) nearCount += 1;
        }
      });
    }

    let chip = null;
    if (hasTransactions && overCount > 0) chip = { tone: 'danger', text: t('home.statusOver', { count: overCount }) };
    else if (hasTransactions && nearCount > 0) chip = { tone: 'warning', text: t('home.statusNear', { count: nearCount }) };

    return { status: chip, isFreshStart: !hasTransactions && !hasAnyBudget };
  }, [transactions, budgets, currentMonthStr, t]);

  return (
    <div className="home-dashboard-v2-container">
      {/* ── TOP HEADER ROW ── */}
      <PageHeader
        icon="home"
        title={monthTitle}
        titleClassName="home-dashboard-greeting"
        meta={status && (
          <span className={`home-status-chip is-${status.tone}`}>
            <AlertTriangleOutlineIcon size={14} />
            {status.text}
          </span>
        )}
        subtitle={isFreshStart ? t('home.greetingStart', { month: monthInline }) : null}
      />

      {/* Desktop: two columns (grid areas in home.css). DOM order is the phone order:
          balance, alerts and this month's plan, then forecast and recent activity, then shortcuts. */}
      <div className="home-dashboard-grid">
        <div className="home-area-hero">
          <AvailableToSpendCard />
        </div>
        <AttentionPanel />
        <div className="home-col-main">
          <Suspense fallback={null}><ForecastCard /></Suspense>
          <ReminderInviteCard />
          <RecentTransactions />
        </div>
        <HomeQuickLinks />
      </div>
    </div>
  );
}

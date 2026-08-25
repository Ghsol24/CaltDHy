import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency } from '../../utils/formatters';

export function AttentionPanel() {
  const { setActiveView, setPlanSubTab, selectedMonth } = useSpendingStore();
  const { transactions, budgets } = useTransactionStore();
  const { jars, installments } = useJarStore();

  const currentMonthPrefix = selectedMonth || new Date().toISOString().slice(0, 7);
  const monthlyStats = calculateMonthlyStats(transactions, currentMonthPrefix);

  // 1. Gather all category budget statuses
  const categoryStatusList = [];
  if (budgets && typeof budgets === 'object') {
    Object.entries(budgets).forEach(([category, limit]) => {
      const numLimit = Number(limit) || 0;
      if (numLimit > 0) {
        const spent = monthlyStats.byCategory[category] || 0;
        const status = getBudgetStatus(spent, numLimit);
        categoryStatusList.push({
          category,
          spent,
          limit: numLimit,
          percent: status.percent,
          remaining: status.remaining,
          status: status.status
        });
      }
    });
  }

  // Sort by spent descending
  categoryStatusList.sort((a, b) => b.spent - a.spent);

  // Top 2 categories for the plan card
  const topCategories = categoryStatusList.slice(0, 2);

  // Top 1 Jar for the plan card
  const topJar = jars && jars.length > 0 ? jars[0] : null;

  // Highest warning category (percent >= 75%)
  const warningCategory = [...categoryStatusList]
    .sort((a, b) => b.percent - a.percent)
    .find((c) => c.percent >= 75);

  // Days left in current month
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());

  // Count upcoming active installments
  const activeInstallmentsCount = (installments || []).filter((i) => i.active !== false).length;
  const jarsCount = (jars || []).length;

  const handleGoToBudgets = () => {
    setActiveView('plan');
    setPlanSubTab('budgets');
  };

  const handleGoToRecurring = () => {
    setActiveView('plan');
    setPlanSubTab('recurring');
  };

  const handleGoToJars = () => {
    setActiveView('jars');
  };

  return (
    <aside className="home-sidebar-panel" aria-label="Bảng kế hoạch và cảnh báo">
      {/* ── CARD 1: KẾ HOẠCH THÁNG NÀY ── */}
      <div className="home-plan-card">
        <h3 className="home-plan-card-title">Kế hoạch tháng này</h3>
        
        <div className="home-plan-items-list">
          {/* Top Budget Categories */}
          {topCategories.map((item, idx) => {
            const isWarning = item.percent >= 75 && item.percent < 100;
            const isDanger = item.percent >= 100;
            const barClass = isDanger ? 'is-danger' : isWarning ? 'is-warning' : 'is-healthy';

            return (
              <div key={item.category || idx} className="home-plan-item">
                <div className="home-plan-item-header">
                  <span className="home-plan-item-name">{item.category}</span>
                  <span className="home-plan-item-amounts">
                    {formatCurrency(item.spent).replace(' đ', '')} / {formatCurrency(item.limit)}
                  </span>
                </div>
                <div className="home-plan-progress-track">
                  <div
                    className={`home-plan-progress-fill ${barClass}`}
                    style={{ width: `${Math.min(100, Math.max(4, item.percent))}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Top Savings Jar */}
          {topJar && (
            <div className="home-plan-item">
              <div className="home-plan-item-header">
                <span className="home-plan-item-name">{topJar.name}</span>
                <span className="home-plan-item-amounts">
                  {formatCurrency(topJar.current).replace(' đ', '')} / {formatCurrency(topJar.target)}
                </span>
              </div>
              <div className="home-plan-progress-track">
                <div
                  className="home-plan-progress-fill is-jar"
                  style={{
                    width: `${Math.min(100, Math.max(4, Math.round((Number(topJar.current) / Number(topJar.target)) * 100)))}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CARD 2: ATTENTION CALLOUT CARD (AMBER) ── */}
      <div className="home-callout-warning-card">
        <h4 className="home-callout-title">
          {warningCategory
            ? `${warningCategory.category} gần chạm ngân sách`
            : 'Kế hoạch chi tiêu đang rất ổn'}
        </h4>
        <p className="home-callout-body">
          {warningCategory
            ? `Bạn còn ${formatCurrency(Math.max(0, warningCategory.remaining))} cho ${daysLeft} ngày tới. Có muốn điều chỉnh hạn mức?`
            : 'Bạn đang chi tiêu hoàn toàn trong tầm kiểm soát an toàn của tháng.'}
        </p>
        <button
          type="button"
          className="home-callout-link-btn"
          onClick={handleGoToBudgets}
        >
          <span>Xem ngân sách</span>
          <span aria-hidden="true"> →</span>
        </button>
      </div>

      {/* ── CARD 3: 2 MINI STAT CARDS (BOTTOM) ── */}
      <div className="home-mini-stats-grid">
        <div
          className="home-mini-stat-card"
          role="button"
          tabIndex={0}
          onClick={handleGoToRecurring}
          onKeyDown={(e) => e.key === 'Enter' && handleGoToRecurring()}
        >
          <span className="home-mini-stat-label">Hóa đơn sắp tới</span>
          <strong className="home-mini-stat-val">{activeInstallmentsCount}</strong>
        </div>

        <div
          className="home-mini-stat-card"
          role="button"
          tabIndex={0}
          onClick={handleGoToJars}
          onKeyDown={(e) => e.key === 'Enter' && handleGoToJars()}
        >
          <span className="home-mini-stat-label">Hũ tiết kiệm</span>
          <strong className="home-mini-stat-val">{jarsCount}</strong>
        </div>
      </div>
    </aside>
  );
}

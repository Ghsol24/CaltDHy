import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { calculateMonthlyStats, calculateAvailableToSpend, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, getLocalMonthString } from '../../utils/formatters';

export function AttentionPanel() {
  const { setActiveView, setPlanSubTab } = useSpendingStore();
  const { transactions, budgets } = useTransactionStore();
  const { jars, installments } = useJarStore();
  const { wallets } = useWalletStore();

  const currentMonthPrefix = getLocalMonthString();
  const monthlyStats = calculateMonthlyStats(transactions, currentMonthPrefix);

  // Số dư khả dụng thật sự (độc lập với ngân sách) — dùng để "bắc cầu" cho banner
  // cảnh báo vượt ngân sách bên dưới, tránh cảm giác hai con số mâu thuẫn nhau.
  const { availableToSpend } = calculateAvailableToSpend({
    wallets,
    transactions,
    jars,
    currentMonthPrefix
  });

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

  const hasBudgets = categoryStatusList.length > 0;
  const hasTransactions = (transactions || []).some(
    (t) => (t.date || '').slice(0, 7) === currentMonthPrefix
  );
  const totalLimit = categoryStatusList.reduce((acc, c) => acc + c.limit, 0);
  const totalBudgetSpent = categoryStatusList.reduce((acc, c) => acc + c.spent, 0);

  // Top 2 categories for the plan card
  const topCategories = categoryStatusList.slice(0, 2);

  // Top 1 Jar for the plan card
  const topJar = jars && jars.length > 0 ? jars[0] : null;

  // Critical category (percent >= 100%)
  const dangerCategory = [...categoryStatusList]
    .sort((a, b) => b.percent - a.percent)
    .find((c) => c.percent >= 100);

  // Warning category (75% <= percent < 100%)
  const warningCategory = [...categoryStatusList]
    .sort((a, b) => b.percent - a.percent)
    .find((c) => c.percent >= 75 && c.percent < 100);

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

  // Dynamic context-aware Callout Card configuration
  const netCashFlow = monthlyStats.income - monthlyStats.expense;
  let calloutConfig = {
    title: 'Kế hoạch chi tiêu đang rất ổn',
    body: 'Bạn đang chi tiêu hoàn toàn trong tầm kiểm soát an toàn của tháng.',
    ctaText: 'Xem ngân sách',
    ctaAction: handleGoToBudgets,
    cardClass: 'is-info'
  };

  if (!hasBudgets && !hasTransactions) {
    calloutConfig = {
      title: 'Chưa thiết lập kế hoạch ngân sách',
      body: 'Hãy đặt hạn mức chi tiêu cho các danh mục để CaltDHy đồng hành giúp bạn kiểm soát dòng tiền hiệu quả nhất.',
      ctaText: 'Thiết lập ngân sách ngay',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-info'
    };
  } else if (hasBudgets && !hasTransactions) {
    calloutConfig = {
      title: 'Kế hoạch tháng đã sẵn sàng',
      body: `Bạn đã phân bổ ${formatCurrency(totalLimit)} ngân sách cho ${categoryStatusList.length} danh mục. Ghi nhận giao dịch khi phát sinh chi tiêu nhé!`,
      ctaText: 'Xem chi tiết ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-info'
    };
  } else if (!hasBudgets && monthlyStats.expense > 0) {
    calloutConfig = {
      title: 'Nên đặt hạn mức chi tiêu',
      body: `Bạn đã chi tiêu ${formatCurrency(monthlyStats.expense)} trong tháng này. Đặt ngân sách giúp bạn chủ động kiểm soát chi tiêu tốt hơn.`,
      ctaText: 'Tạo ngân sách ngay',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-warning'
    };
  } else if (dangerCategory) {
    calloutConfig = {
      title: `Cảnh báo: ${dangerCategory.category} vượt ngân sách`,
      body: `Đã chi ${formatCurrency(dangerCategory.spent)} / ${formatCurrency(dangerCategory.limit)} (vượt +${formatCurrency(dangerCategory.spent - dangerCategory.limit)}) so với hạn mức bạn tự đặt cho danh mục này. ${
        availableToSpend > 0
          ? `Bạn vẫn còn ${formatCurrency(availableToSpend)} khả dụng nói chung, nhưng nên điều chỉnh hạn mức hoặc giảm chi ở đây.`
          : 'Hãy cân nhắc điều chỉnh các khoản tiếp theo!'
      }`,
      ctaText: 'Xem và điều chỉnh ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-danger'
    };
  } else if (warningCategory) {
    calloutConfig = {
      title: `${warningCategory.category} gần chạm ngân sách`,
      body: `Bạn chỉ còn ${formatCurrency(Math.max(0, warningCategory.remaining))} cho ${daysLeft} ngày tới. Cần lưu ý khi phát sinh chi tiêu mới.`,
      ctaText: 'Xem ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-warning'
    };
  } else if (netCashFlow > 0 && monthlyStats.income > monthlyStats.expense * 1.5 && jarsCount > 0) {
    calloutConfig = {
      title: 'Dòng tiền tháng này rất dồi dào',
      body: `Thặng dư hiện tại đạt +${formatCurrency(netCashFlow)}. Hãy trích một phần vào các Hũ tiết kiệm để sớm đạt mục tiêu!`,
      ctaText: 'Tích luỹ vào hũ tiết kiệm',
      ctaAction: handleGoToJars,
      cardClass: 'is-success'
    };
  } else if (hasBudgets && monthlyStats.expense > 0) {
    const usedPct = totalLimit > 0 ? Math.round((totalBudgetSpent / totalLimit) * 100) : 0;
    calloutConfig = {
      title: 'Kế hoạch chi tiêu rất tối ưu',
      body: `Bạn mới sử dụng ${usedPct}% tổng ngân sách đã đặt. Tiến độ chi tiêu hoàn toàn an toàn.`,
      ctaText: 'Xem ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-success'
    };
  }

  return (
    <aside className="home-sidebar-panel" aria-label="Bảng kế hoạch và cảnh báo">
      {/* ── CARD 1: KẾ HOẠCH THÁNG NÀY ── */}
      <div className="home-plan-card">
        <h3 className="home-plan-card-title">Kế hoạch tháng này</h3>
        
        <div className="home-plan-items-list">
          {/* Empty state if no budgets and no jars */}
          {topCategories.length === 0 && !topJar && (
            <div className="home-plan-empty-state">
              <span className="home-plan-empty-icon" role="img" aria-label="Mục tiêu">🎯</span>
              <p className="home-plan-empty-text">
                Chưa có hạn mức ngân sách hoặc hũ tiết kiệm nào được thiết lập.
              </p>
              <button
                type="button"
                className="home-plan-empty-btn"
                onClick={handleGoToBudgets}
              >
                + Thiết lập ngay
              </button>
            </div>
          )}

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

      {/* ── CARD 2: ATTENTION CALLOUT CARD ── */}
      <div className={`home-callout-warning-card ${calloutConfig.cardClass}`}>
        <h4 className="home-callout-title">
          {calloutConfig.title}
        </h4>
        <p className="home-callout-body">
          {calloutConfig.body}
        </p>
        <button
          type="button"
          className="home-callout-link-btn"
          onClick={calloutConfig.ctaAction}
        >
          <span>{calloutConfig.ctaText}</span>
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

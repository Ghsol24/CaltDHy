import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useJarStore } from '../../stores/useJarStore';
import { calculateMonthlyStats, getBudgetStatus } from '../../utils/financeMath';
import { formatCurrency, getLocalMonthString, getDueStatus } from '../../utils/formatters';
import { TargetOutlineIcon } from '../../components/ui/AppIcons';
import { isInstallmentEnded, isRecurringIncome } from '../../utils/installmentTerm';
import { useTranslation } from '../../i18n/useTranslation';

export const AttentionPanel = React.memo(function AttentionPanel() {
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const { label } = useTranslation();
  const transactions = useTransactionStore((s) => s.transactions);
  const budgets = useTransactionStore((s) => s.budgets);
  const jars = useJarStore((s) => s.jars);

  const currentMonthPrefix = getLocalMonthString();

  // Memoize all expensive aggregate metrics
  const {
    monthlyStats,
    categoryStatusList,
    hasBudgets,
    hasTransactions,
    totalLimit,
    totalBudgetSpent,
    topCategories,
    topJar,
    dangerCategory,
    warningCategory,
    daysLeft,
    overCount,
    jarsCount
  } = React.useMemo(() => {
    const stats = calculateMonthlyStats(transactions, currentMonthPrefix);


    const catList = [];
    if (budgets && typeof budgets === 'object') {
      Object.entries(budgets).forEach(([category, limit]) => {
        const numLimit = Number(limit) || 0;
        if (numLimit > 0) {
          const spent = stats.byCategory[category] || 0;
          const status = getBudgetStatus(spent, numLimit);
          catList.push({
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

    catList.sort((a, b) => b.spent - a.spent);

    const hasB = catList.length > 0;
    const hasT = (transactions || []).some(
      (t) => (t.date || '').slice(0, 7) === currentMonthPrefix
    );
    const totLimit = catList.reduce((acc, c) => acc + c.limit, 0);
    const totSpent = catList.reduce((acc, c) => acc + c.spent, 0);
    const topCats = catList.slice(0, 2);
    const tj = jars && jars.length > 0 ? jars[0] : null;

    const dangerCat = [...catList]
      .sort((a, b) => b.percent - a.percent)
      .find((c) => c.percent >= 100);

    const warningCat = [...catList]
      .sort((a, b) => b.percent - a.percent)
      .find((c) => c.percent >= 75 && c.percent < 100);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dLeft = Math.max(1, daysInMonth - now.getDate());

    return {
      monthlyStats: stats,
      categoryStatusList: catList,
      hasBudgets: hasB,
      hasTransactions: hasT,
      totalLimit: totLimit,
      totalBudgetSpent: totSpent,
      topCategories: topCats,
      topJar: tj,
      dangerCategory: dangerCat,
      warningCategory: warningCat,
      daysLeft: dLeft,
      overCount: catList.filter((c) => c.percent >= 100).length,
      jarsCount: (jars || []).length
    };
  }, [transactions, budgets, jars, currentMonthPrefix]);

  const handleGoToBudgets = () => {
    navigateTo('plan', 'budgets');
  };

  const handleGoToJars = () => {
    navigateTo('jars', 'goals');
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
      body: `Bạn đã phân bổ ${formatCurrency(totalLimit)} ngân sách cho ${categoryStatusList.length} danh mục. Hãy ghi giao dịch khi phát sinh chi tiêu.`,
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
    const others = overCount - 1;
    calloutConfig = {
      title: `${label(dangerCategory.category)} vượt hạn mức`,
      body: `Đã chi ${formatCurrency(dangerCategory.spent)} / ${formatCurrency(dangerCategory.limit)} (vượt ${formatCurrency(dangerCategory.spent - dangerCategory.limit)}).${
        others > 0 ? ` Còn ${others} danh mục khác cũng vượt.` : ''
      }`,
      ctaText: 'Điều chỉnh ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-danger'
    };
  } else if (warningCategory) {
    calloutConfig = {
      title: `${label(warningCategory.category)} gần chạm ngân sách`,
      body: `Bạn chỉ còn ${formatCurrency(Math.max(0, warningCategory.remaining))} cho ${daysLeft} ngày tới. Cần lưu ý khi phát sinh chi tiêu mới.`,
      ctaText: 'Xem ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-warning'
    };
  } else if (netCashFlow > 0 && monthlyStats.income > monthlyStats.expense * 1.5 && jarsCount > 0) {
    calloutConfig = {
      title: `Tháng này dư ${formatCurrency(netCashFlow)}`,
      body: 'Có thể chuyển một phần vào hũ tiết kiệm để sớm đạt mục tiêu.',
      ctaText: 'Tích luỹ vào hũ tiết kiệm',
      ctaAction: handleGoToJars,
      cardClass: 'is-success'
    };
  } else if (hasBudgets && monthlyStats.expense > 0) {
    const usedPct = totalLimit > 0 ? Math.round((totalBudgetSpent / totalLimit) * 100) : 0;
    calloutConfig = {
      title: `Đã dùng ${usedPct}% tổng ngân sách`,
      body: 'Chưa có danh mục nào vượt hạn mức.',
      ctaText: 'Xem ngân sách',
      ctaAction: handleGoToBudgets,
      cardClass: 'is-success'
    };
  }

  const callout = (
    <div className={`home-callout-warning-card ${calloutConfig.cardClass}`}>
      <h3 className="home-callout-title">
        {calloutConfig.title}
      </h3>
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
  );

  return (
    <aside className="home-sidebar-panel" aria-label="Bảng kế hoạch và cảnh báo">
      {/* Alert first: on phones this sits right under the balance card. */}
      {callout}

      <div className="home-plan-card">
        <h3 className="home-plan-card-title">Kế hoạch tháng này</h3>

        {topCategories.length === 0 && !topJar && (
          <div className="home-plan-empty-state">
            <span className="home-plan-empty-icon home-plan-empty-icon--layout" aria-hidden="true">
              <TargetOutlineIcon size={24} color="currentColor" />
            </span>
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

        {topCategories.length > 0 && (
          <div className="home-plan-group">
            <h4 className="home-plan-group-title">Ngân sách</h4>
            <div className="home-plan-items-list">
              {topCategories.map((item, idx) => {
                const isWarning = item.percent >= 75 && item.percent < 100;
                const isDanger = item.percent >= 100;
                const barClass = isDanger ? 'is-danger' : isWarning ? 'is-warning' : 'is-healthy';

                return (
                  <div key={item.category || idx} className="home-plan-item">
                    <div className="home-plan-item-header">
                      <span className="home-plan-item-name">{label(item.category)}</span>
                      <span className="home-plan-item-amounts">
                        {formatCurrency(item.spent)} / {formatCurrency(item.limit)}
                      </span>
                    </div>
                    <div className="home-plan-progress-track">
                      <div
                        className={`home-plan-progress-fill ${barClass} home-plan-progress-fill--box`}
                        style={{ '--home-plan-progress-fill-width': `${Math.min(100, Math.max(4, item.percent))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {topJar && (
          <div className="home-plan-group">
            <h4 className="home-plan-group-title">Hũ</h4>
            <div className="home-plan-items-list">
              <div className="home-plan-item">
                <div className="home-plan-item-header">
                  <span className="home-plan-item-name">{topJar.name}</span>
                  <span className="home-plan-item-amounts">
                    {formatCurrency(topJar.current)} / {formatCurrency(topJar.target)}
                  </span>
                </div>
                <div className="home-plan-progress-track">
                  <div
                    className="home-plan-progress-fill is-jar home-plan-progress-fill--box"
                    style={{ '--home-plan-progress-fill-width': `${Math.min(100, Math.max(4, Math.round((Number(topJar.current) / Number(topJar.target)) * 100)))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});

/** Two shortcuts that used to be two count-only cards: recurring items due soon and savings jars. */
export const HomeQuickLinks = React.memo(function HomeQuickLinks() {
  const navigateTo = useSpendingStore((s) => s.navigateTo);
  const jars = useJarStore((s) => s.jars);
  const installments = useJarStore((s) => s.installments);
  const currentMonthPrefix = getLocalMonthString();

  const upcomingCount = React.useMemo(() => (installments || []).filter((item) => {
    if (item.active === false || isInstallmentEnded(item) || isRecurringIncome(item)) return false;

    // 1. Đã thanh toán trong tháng hiện tại chưa
    const isPaidInMonth = Array.isArray(item.history) && item.history.some(
      (h) => h && typeof h.paidDate === 'string' && h.paidDate.startsWith(currentMonthPrefix)
    );
    if (isPaidInMonth) return false;

    // 2. Kiểm tra hạn thanh toán: đến hạn trong tháng này (hoặc quá hạn) hoặc sắp tới hạn trong 7 ngày tới
    const due = getDueStatus(item.nextDueDate);
    const dueMonth = item.nextDueDate ? String(item.nextDueDate).slice(0, 7) : '';
    const isDueThisMonth = dueMonth ? dueMonth <= currentMonthPrefix : true;

    return isDueThisMonth || due.isSoon;
  }).length, [installments, currentMonthPrefix]);
  const jarsCount = (jars || []).length;

  return (
    <div className="home-quick-links">
      <button type="button" className="home-quick-link" onClick={() => navigateTo('plan', 'recurring')}>
        <span>{upcomingCount > 0 ? `${upcomingCount} khoản định kỳ sắp đến hạn` : 'Không có khoản định kỳ sắp đến hạn'}</span>
        <span className="home-quick-link-chevron" aria-hidden="true">›</span>
      </button>
      <button type="button" className="home-quick-link" onClick={() => navigateTo('jars', 'goals')}>
        <span>{jarsCount > 0 ? `${jarsCount} hũ tiết kiệm` : 'Chưa có hũ tiết kiệm'}</span>
        <span className="home-quick-link-chevron" aria-hidden="true">›</span>
      </button>
    </div>
  );
});

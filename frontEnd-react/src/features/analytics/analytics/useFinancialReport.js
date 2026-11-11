import { useMemo } from 'react';
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '../../../utils/formatters';
import { getBudgetStatus } from '../../../utils/financeMath';
import { getCategoryIcon } from '../../../utils/categories';
import { translateLegacyText } from '../../../i18n/legacyTranslations';
import { csvRow } from '../../../utils/csv';
import { getUserErrorMessage } from '../../../utils/userErrors.js';

export function useFinancialReport({ activeMonth, addToast, budgets, curQuarterMonths, label, lang, monthLabel, prevMonthStr, prevQuarterLabel, prevQuarterMonths, quarterLabel, reportPeriodType, t, transactions }) {
  const reportData = useMemo(() => {
    const isQuarter = reportPeriodType === 'quarterly';
    const curLabel = isQuarter ? quarterLabel : monthLabel;
    const prevLabel = isQuarter ? prevQuarterLabel : formatDate(`${prevMonthStr}-01`, 'month', { locale: lang });

    const matchesCurrent = (txDate) => {
      if (!txDate) return false;
      if (isQuarter) {
        return curQuarterMonths.some((m) => txDate.startsWith(m));
      }
      return txDate.startsWith(activeMonth);
    };

    const matchesPrevious = (txDate) => {
      if (!txDate) return false;
      if (isQuarter) {
        return prevQuarterMonths.some((m) => txDate.startsWith(m));
      }
      return txDate.startsWith(prevMonthStr);
    };

    const curTxns = transactions.filter((t) => matchesCurrent(t.date || t.createdAt));
    const prevTxns = transactions.filter((t) => matchesPrevious(t.date || t.createdAt));

    const calcStats = (txList) => {
      let income = 0;
      let expense = 0;
      let incomeCount = 0;
      let expenseCount = 0;
      const catMap = Object.create(null);

      txList.forEach((t) => {
        const amt = Number(t.amount) || 0;
        const fee = Number(t.fee) || 0;
        if (t.type === 'income') {
          income += amt;
          incomeCount += 1;
        } else if (t.type === 'expense') {
          const total = amt + fee;
          expense += total;
          expenseCount += 1;
          const cat = t.category || 'Khác';
          if (!catMap[cat]) {
            catMap[cat] = { amount: 0, count: 0 };
          }
          catMap[cat].amount += total;
          catMap[cat].count += 1;
        }
      });

      const net = income - expense;
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
      return { income, expense, incomeCount, expenseCount, net, savingsRate, catMap };
    };

    const curStats = calcStats(curTxns);
    const prevStats = calcStats(prevTxns);

    const incomeDelta = curStats.income - prevStats.income;
    const incomeDeltaPct = prevStats.income > 0 
      ? ((curStats.income - prevStats.income) / prevStats.income) * 100 
      : (curStats.income > 0 ? 100 : 0);

    const expenseDelta = curStats.expense - prevStats.expense;
    const expenseDeltaPct = prevStats.expense > 0 
      ? ((curStats.expense - prevStats.expense) / prevStats.expense) * 100 
      : (curStats.expense > 0 ? 100 : 0);

    const netDelta = curStats.net - prevStats.net;
    const savingsRateDelta = curStats.savingsRate - prevStats.savingsRate;

    const allCatNamesSet = new Set([
      ...Object.keys(curStats.catMap),
      ...Object.keys(prevStats.catMap),
      ...Object.keys(budgets || {})
    ]);

    const multiplier = isQuarter ? 3 : 1;

    const categoryRows = Array.from(allCatNamesSet).map((catName) => {
      const curCat = curStats.catMap[catName] || { amount: 0, count: 0 };
      const prevCat = prevStats.catMap[catName] || { amount: 0, count: 0 };

      const spentCur = curCat.amount;
      const countCur = curCat.count;
      const spentPrev = prevCat.amount;
      const countPrev = prevCat.count;

      const isNewInPeriod = spentPrev === 0 && spentCur > 0;
      const isEliminated = spentCur === 0 && spentPrev > 0;
      const deltaAmt = spentCur - spentPrev;
      const deltaPct = spentPrev > 0 
        ? ((spentCur - spentPrev) / spentPrev) * 100 
        : 0;

      const pctOfTotal = curStats.expense > 0 ? (spentCur / curStats.expense) * 100 : 0;

      const rawLimit = budgets && budgets[catName] !== undefined ? Number(budgets[catName]) : null;
      const limit = rawLimit && rawLimit > 0 ? rawLimit * multiplier : null;
      const budgetStatus = getBudgetStatus(spentCur, limit || 0);

      // Evaluate delta badge status accurately (never show false alarms)
      let deltaBadgeType = 'neutral'; // 'good' | 'bad' | 'warn' | 'new' | 'neutral'
      let deltaBadgeText = '';

      if (spentCur === 0 && spentPrev === 0) {
        deltaBadgeType = 'neutral';
        deltaBadgeText = formatCurrency(0);
      } else if (isNewInPeriod) {
        if (limit && budgetStatus.isOver) {
          deltaBadgeType = 'bad';
          deltaBadgeText = 'Mới (Vượt trần)';
        } else if (limit && (budgetStatus.status === 'warning' || budgetStatus.percent >= 100)) {
          deltaBadgeType = 'warn';
          deltaBadgeText = 'Mới (Cận trần)';
        } else {
          deltaBadgeType = 'new';
          deltaBadgeText = 'Mới trong kỳ';
        }
      } else if (isEliminated) {
        deltaBadgeType = 'good';
        deltaBadgeText = '↓ -100%';
      } else if (deltaAmt < 0) {
        deltaBadgeType = 'good';
        deltaBadgeText = `↓ -${formatPercent(Math.abs(deltaPct), { fractionDigits: 1 })}`;
      } else if (deltaAmt === 0 || Math.abs(deltaPct) < 0.5) {
        deltaBadgeType = 'neutral';
        deltaBadgeText = `~ ${formatPercent(0, { fractionDigits: 1 })}`;
      } else {
        // deltaAmt > 0 (Chi tiêu tăng so với kỳ trước)
        if (limit && budgetStatus.isOver) {
          deltaBadgeType = 'bad';
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        } else if (limit && (budgetStatus.status === 'warning' || budgetStatus.percent >= 100)) {
          deltaBadgeType = 'warn';
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        } else if (limit && spentCur <= limit * 0.75) {
          // Tăng nhưng an toàn dưới 75% hạn mức
          if (deltaPct > 30) {
            deltaBadgeType = 'warn';
          } else {
            deltaBadgeType = 'neutral';
          }
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        } else {
          // Chưa đặt hạn mức
          if (deltaPct > 50) {
            deltaBadgeType = 'bad';
          } else if (deltaPct > 20) {
            deltaBadgeType = 'warn';
          } else {
            deltaBadgeType = 'neutral';
          }
          deltaBadgeText = `↑ +${formatPercent(deltaPct, { fractionDigits: 1 })}`;
        }
      }

      let adviceText = '';
      let adviceType = 'neutral';

      if (spentCur === 0 && spentPrev === 0) {
        adviceText = 'Không phát sinh chi tiêu trong kỳ';
        adviceType = 'neutral';
      } else if (spentCur === 0 && spentPrev > 0) {
        adviceText = 'Không phát sinh chi tiêu (tiết kiệm 100% so với kỳ trước)';
        adviceType = 'good';
      } else if (limit && budgetStatus.isOver) {
        const overPct = budgetStatus.percent - 100;
        adviceText = `Vượt ${formatPercent(overPct)} ngân sách! Cần thắt chặt chi tiêu`;
        adviceType = 'danger';
      } else if (limit && budgetStatus.percent === 100) {
        adviceText = `Đã chạm 100% hạn mức trần! Hạn chế phát sinh thêm chi phí`;
        adviceType = 'warning';
      } else if (limit && budgetStatus.status === 'warning') {
        adviceText = `Đã chạm ${budgetStatus.percent}% hạn mức, còn ${formatCurrency(budgetStatus.remaining)}`;
        adviceType = 'warning';
      } else if (limit && spentCur < limit * 0.75 && deltaAmt < 0) {
        adviceText = `Tiết kiệm tốt (giảm ${formatPercent(Math.abs(deltaPct))}), an toàn dưới ngân sách`;
        adviceType = 'good';
      } else if (limit && spentCur < limit * 0.75) {
        adviceText = `Kiểm soát tốt dưới hạn mức ngân sách (${budgetStatus.percent}%)`;
        adviceType = 'good';
      } else if (!limit && deltaAmt < 0) {
        adviceText = `Chi tiêu giảm ${formatPercent(Math.abs(deltaPct))} so với kỳ trước`;
        adviceType = 'good';
      } else if (!limit && deltaPct > 30) {
        adviceText = `Tăng ${formatPercent(deltaPct)} so với kỳ trước, nên thiết lập hạn mức`;
        adviceType = 'warning';
      } else {
        adviceText = 'Nên đặt hạn mức ngân sách để kiểm soát dòng tiền tốt hơn';
        adviceType = 'neutral';
      }

      return {
        name: catName,
        icon: getCategoryIcon(catName, 'expense'),
        spentCur,
        spentPrev,
        countCur,
        countPrev,
        deltaAmt,
        deltaPct,
        isNewInPeriod,
        isEliminated,
        deltaBadgeType,
        deltaBadgeText,
        pctOfTotal,
        limit,
        budgetStatus,
        adviceText,
        adviceType
      };
    })
    .filter((row) => row.spentCur > 0 || row.spentPrev > 0 || (row.limit && row.limit > 0))
    .sort((a, b) => b.spentCur - a.spentCur);

    // Smart overall insights list
    const insights = [];
    const overList = categoryRows.filter((r) => r.limit && r.budgetStatus.isOver);
    const warnList = categoryRows.filter((r) => r.limit && r.budgetStatus.status === 'warning');
    const hasCurrentData = curTxns.length > 0;

    if (!hasCurrentData) {
      insights.push({
        type: 'info',
        text: 'Chưa đủ dữ liệu trong kỳ này để đưa ra nhận định tài chính. Hãy ghi nhận giao dịch trước khi đánh giá xu hướng.'
      });
    } else if (curStats.net > 0 && curStats.savingsRate >= 20) {
      insights.push({
        type: 'accolade',
        text: `Quản lý tài chính xuất sắc! Dòng tiền thặng dư ${formatCurrency(curStats.net)} và bạn đã tiết kiệm được ${formatPercent(curStats.savingsRate)} tổng thu nhập trong kỳ này.`
      });
    } else if (curStats.net > 0) {
      insights.push({
        type: 'accolade',
        text: `Dòng tiền dương thặng dư ${formatCurrency(curStats.net)}. Thu nhập đang kiểm soát tốt hơn tổng chi tiêu.`
      });
    } else if (curStats.net < 0) {
      insights.push({
        type: 'warning',
        text: `Dòng tiền đang thâm hụt ${formatCurrency(Math.abs(curStats.net))}. Chi tiêu vượt tổng thu nhập trong kỳ, cần hạn chế các khoản chi không cấp thiết.`
      });
    }

    if (overList.length > 0) {
      insights.push({
        type: 'warning',
        text: `Cảnh báo vượt ngân sách: Có ${overList.length} nhóm chi phí đã vượt hạn mức (${overList.map(o => o.name).join(', ')}). Hãy rà soát lại các khoản chi lớn.`
      });
    } else if (warnList.length > 0) {
      insights.push({
        type: 'info',
        text: `Có ${warnList.length} nhóm chi phí đang tiệm cận trần ngân sách (${warnList.map(w => w.name).join(', ')}). Chú ý thắt chặt trong các ngày còn lại.`
      });
    } else if (hasCurrentData && curStats.expense > 0 && categoryRows.some(r => r.limit)) {
      insights.push({
        type: 'accolade',
        text: `Tất cả các nhóm có thiết lập ngân sách đều nằm trong vùng kiểm soát an toàn! Tiếp tục phát huy kỷ luật tài chính.`
      });
    }

    if (hasCurrentData && curStats.expense < prevStats.expense && prevStats.expense > 0) {
      insights.push({
        type: 'accolade',
        text: `Tổng chi tiêu giảm ${formatCurrency(prevStats.expense - curStats.expense)} (${formatPercent(Math.abs(expenseDeltaPct))}) so với kỳ trước. Bạn đang tối ưu ngân sách rất hiệu quả!`
      });
    }

    return {
      isQuarter,
      curLabel,
      prevLabel,
      curStats,
      prevStats,
      curTxns,
      incomeDelta,
      incomeDeltaPct,
      expenseDelta,
      expenseDeltaPct,
      netDelta,
      savingsRateDelta,
      categoryRows,
      insights
    };
  }, [reportPeriodType, quarterLabel, prevQuarterLabel, monthLabel, prevMonthStr, activeMonth, curQuarterMonths, prevQuarterMonths, transactions, budgets, lang]);

  // Handle CSV Export with UTF-8 BOM
  const handleExportCSV = () => {
    try {
      const { curLabel, prevLabel, curStats, prevStats, categoryRows, curTxns, incomeDelta, incomeDeltaPct, expenseDelta, expenseDeltaPct, netDelta, savingsRateDelta } = reportData;

      let csv = '\uFEFF'; // UTF-8 BOM for Excel Vietnamese compatibility
      csv += `${t('analytics.csvTitle')}\n`;
      csv += `${t('analytics.csvPeriod')}:,"${translateLegacyText(lang, curLabel)}"\n`;
      csv += `${t('analytics.csvComparison')}:,"${translateLegacyText(lang, prevLabel)}"\n`;
      csv += `${t('analytics.csvExportedAt')}:,"${formatDateTime(new Date())}"\n\n`;

      // 1. Chỉ số tài chính
      csv += `${t('analytics.csvSummary')}\n`;
      csv += `${t('analytics.csvSummaryHeaders')}\n`;
      csv += `${t('analytics.totalIncome')},"${curStats.income}","${prevStats.income}","${incomeDelta}","${incomeDeltaPct.toFixed(1)}%"\n`;
      csv += `${t('analytics.totalExpense')},"${curStats.expense}","${prevStats.expense}","${expenseDelta}","${expenseDeltaPct.toFixed(1)}%"\n`;
      csv += `${t('analytics.net')},"${curStats.net}","${prevStats.net}","${netDelta}",""\n`;
      csv += `${t('analytics.savingsRate')},"${curStats.savingsRate.toFixed(1)}%","${prevStats.savingsRate.toFixed(1)}%","${savingsRateDelta.toFixed(1)}%",""\n\n`;

      // 2. Phân tích chi tiết danh mục
      csv += `${t('analytics.csvCategorySection')}\n`;
      csv += `${t('analytics.csvCategoryHeaders')}\n`;
      categoryRows.forEach((r) => {
        const statusText = r.limit
          ? t(r.budgetStatus.isOver ? 'analytics.overBudget' : r.budgetStatus.status === 'warning' ? 'analytics.warningBudget' : 'analytics.safeBudget', { percent: r.budgetStatus.percent })
          : t('transaction.limitUnset');
        const advice = translateLegacyText(lang, r.adviceText);
        csv += csvRow([label(r.name), r.spentCur, r.spentPrev, r.deltaAmt,
          `${r.deltaPct.toFixed(1)}%`, `${r.pctOfTotal.toFixed(1)}%`, r.countCur,
          r.limit || 0, statusText, advice]);
      });
      csv += '\n';

      // 3. Danh sách giao dịch trong kỳ
      csv += `${t('analytics.csvTransactions')}\n`;
      csv += `${t('analytics.csvTransactionHeaders')}\n`;
      curTxns.forEach((tx) => {
        csv += csvRow([tx.date || '', t(`type.${tx.type === 'income' ? 'income' : 'expense'}`),
          label(tx.category || ''), tx.amount || 0, tx.fee || 0, tx.note || '']);
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanPeriod = curLabel.replace(/[\s,/()]/g, '_');
      a.download = `Bao_Cao_Tai_Chinh_CaltDHy_${cleanPeriod}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      addToast({ type: 'error', message: getUserErrorMessage(error, 'settings.exportFailed') });
    }
  };


  // Handle Print
  const handlePrint = () => {
    try { window.print(); } catch (error) {
      addToast({ type: 'error', message: getUserErrorMessage(error) });
    }
  };
  return { handleExportCSV, handlePrint, reportData };
}

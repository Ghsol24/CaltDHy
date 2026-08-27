import React from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useJarStore } from '../../stores/useJarStore';
import { calculateAvailableToSpend } from '../../utils/financeMath';
import { formatCurrency, getLocalMonthString } from '../../utils/formatters';

export function AvailableToSpendCard() {
  const { selectedMonth } = useSpendingStore();
  const { transactions } = useTransactionStore();
  const { wallets } = useWalletStore();
  const { jars } = useJarStore();

  // Month prefix: e.g. "2026-08"
  const currentMonthPrefix = selectedMonth || getLocalMonthString();

  // Calculate Safe-To-Spend and other key metrics
  const {
    availableToSpend,
    monthlyIncome,
    monthlyExpense
  } = calculateAvailableToSpend({
    wallets,
    transactions,
    jars,
    currentMonthPrefix
  });

  return (
    <div className="home-hero-balance-card" role="region" aria-label="Tổng quan tiền khả dụng">
      <div className="hero-card-pattern" aria-hidden="true" />
      
      {/* Top Header Eyebrow */}
      <div className="hero-card-eyebrow">
        <span className="hero-card-eyebrow-dot" aria-hidden="true" />
        <span>TIỀN CÓ THỂ CHI CÒN LẠI</span>
      </div>

      {/* Main Hero Amount */}
      <div className="hero-card-main-amount">
        {formatCurrency(availableToSpend)}
      </div>

      {/* Subtitle */}
      <p className="hero-card-subtext">
        Sau chi tiêu thiết yếu và tiền đã dành cho mục tiêu.
      </p>

      {/* Bottom 2-Column Stats */}
      <div className="hero-card-bottom-row">
        <div className="hero-stat-col">
          <span className="hero-stat-label">Đã chi tháng này</span>
          <strong className="hero-stat-val hero-stat-val--expense">
            −{formatCurrency(monthlyExpense)}
          </strong>
        </div>

        <div className="hero-stat-col">
          <span className="hero-stat-label">Thu nhập tháng này</span>
          <strong className="hero-stat-val hero-stat-val--income">
            +{formatCurrency(monthlyIncome)}
          </strong>
        </div>
      </div>
    </div>
  );
}

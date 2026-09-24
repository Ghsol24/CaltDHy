import React from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useJarStore } from '../../stores/useJarStore';
import { calculateAvailableToSpend } from '../../utils/financeMath';
import { formatCurrency, getLocalMonthString } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';

export const AvailableToSpendCard = React.memo(function AvailableToSpendCard() {
  const { t } = useTranslation();
  const transactions = useTransactionStore((s) => s.transactions);
  const wallets = useWalletStore((s) => s.wallets);
  const jars = useJarStore((s) => s.jars);

  // Month prefix: e.g. "2026-09"
  const currentMonthPrefix = getLocalMonthString();

  // Calculate Safe-To-Spend and other key metrics
  const {
    availableToSpend,
    monthlyIncome,
    monthlyExpense
  } = React.useMemo(() => {
    return calculateAvailableToSpend({
      wallets,
      transactions,
      jars,
      currentMonthPrefix
    });
  }, [wallets, transactions, jars, currentMonthPrefix]);

  return (
    <div className="home-hero-balance-card" role="region" aria-label={t('home.availableOverview')}>
      <div className="hero-card-pattern" aria-hidden="true" />
      
      {/* Top Header Eyebrow */}
      <div className="hero-card-eyebrow">
        <span className="hero-card-eyebrow-dot" aria-hidden="true" />
        <span>{t('home.available')}</span>
      </div>

      {/* Main Hero Amount */}
      <div className="hero-card-main-amount">
        {formatCurrency(availableToSpend)}
      </div>

      {/* Subtitle */}
      <p className="hero-card-subtext">
        {t('home.availableHint')}
      </p>

      {/* Bottom 2-Column Stats */}
      <div className="hero-card-bottom-row">
        <div className="hero-stat-col">
          <span className="hero-stat-label">{t('home.spentThisMonth')}</span>
          <strong className="hero-stat-val hero-stat-val--expense">
            −{formatCurrency(monthlyExpense)}
          </strong>
        </div>

        <div className="hero-stat-col">
          <span className="hero-stat-label">{t('home.incomeThisMonth')}</span>
          <strong className="hero-stat-val hero-stat-val--income">
            +{formatCurrency(monthlyIncome)}
          </strong>
        </div>
      </div>
    </div>
  );
});

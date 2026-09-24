import React, { useMemo } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useJarStore } from '../../stores/useJarStore';
import { inspectMoneyDisplay } from '../../utils/moneyPrecision';
import { formatCurrency } from '../../utils/formatters';
import { useTranslation } from '../../i18n/useTranslation';

export function MoneyDisplayGuard({ children }) {
  const { t } = useTranslation();
  const transactions = useTransactionStore(state => state.transactions);
  const budgets = useTransactionStore(state => state.budgets);
  const wallets = useWalletStore(state => state.wallets);
  const archived = useWalletStore(state => state.archivedWallets);
  const jars = useJarStore(state => state.jars);
  const installments = useJarStore(state => state.installments);

  const result = useMemo(() => {
    return inspectMoneyDisplay({
      transactions,
      budgets,
      wallets: wallets.concat(archived),
      jars,
      installments
    });
  }, [transactions, budgets, wallets, archived, jars, installments]);

  if (result.safe) return children;
  return <section role="alert" data-testid="money-range-notice" style={{ padding: '24px',
    color: 'var(--color-warning)', background: 'var(--color-warning-bg)',
    border: '1px solid var(--color-warning-border)', borderRadius: '12px' }}>
    <h2>{t('moneyGuard.title')}</h2>
    <p>{t(result.invalid ? 'moneyGuard.invalid' : 'moneyGuard.overflow')}</p>
    {result.turnover !== null && <p>{t('moneyGuard.turnover', { amount: formatCurrency(result.turnover) })}</p>}
    <p>{t('moneyGuard.safe')}</p>
  </section>;
}

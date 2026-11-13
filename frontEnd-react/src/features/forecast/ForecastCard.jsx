import React, { useEffect, useMemo, useState } from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useWalletStore } from '../../stores/useWalletStore';
import { useJarStore } from '../../stores/useJarStore';
import { spendingService } from '../../services/spendingService';
import { useTranslation } from '../../i18n/useTranslation';
import { formatCurrency, formatDate, getLocalMonthString } from '../../utils/formatters';
import { estimateJarCompletion, forecastMonthEnd } from '../../utils/forecast';
import { getForecastCopy } from './forecastCopy';
import './forecast.css';

/** Home card: projected month-end balance, savings rate, items still due and jar goal dates. */
export function ForecastCard() {
  const { lang } = useTranslation();
  const copy = getForecastCopy(lang);
  const transactions = useTransactionStore((state) => state.transactions);
  const wallets = useWalletStore((state) => state.wallets);
  const jars = useJarStore((state) => state.jars);
  const installments = useJarStore((state) => state.installments);
  const [expectedDays, setExpectedDays] = useState([]);
  const month = getLocalMonthString();

  useEffect(() => {
    let active = true;
    spendingService.getExpectedDays(month).then((response) => { if (active) setExpectedDays(response.data || []); }).catch(() => {});
    return () => { active = false; };
  }, [month]);

  const forecast = useMemo(() => forecastMonthEnd({ transactions, wallets, jars, installments, expectedDays }),
    [transactions, wallets, jars, installments, expectedDays]);
  const goals = useMemo(() => jars.filter((jar) => jar.target > 0)
    .map((jar) => ({ jar, estimate: estimateJarCompletion(jar) })).filter(({ estimate }) => !estimate.done).slice(0, 3), [jars]);
  const showDate = (iso) => formatDate(iso, 'short', { locale: lang });

  return <section className="forecast-card" aria-labelledby="forecast-title">
    <h2 id="forecast-title">{copy.title}</h2>
    <div className="forecast-grid">
      <div className={`forecast-stat is-main${forecast.projectedBalance < 0 ? ' is-negative' : ''}`}>
        <span>{copy.projected}</span>
        <strong>{formatCurrency(forecast.projectedBalance)}</strong>
        <small>{!forecast.hasData ? copy.noData : forecast.remainingDays === 0 ? copy.lastDay
          : forecast.projectedBalance < 0 ? copy.negative : copy.projectedHint(formatCurrency(forecast.dailyPace), forecast.remainingDays)}</small>
      </div>
      <div className="forecast-stat">
        <span>{copy.savingsRate}</span>
        <strong className={forecast.savingsRate !== null && forecast.savingsRate < 0 ? 'is-negative' : ''}>
          {forecast.savingsRate === null ? '—' : `${forecast.savingsRate}%`}</strong>
        <small>{forecast.savingsRate === null ? copy.savingsNoIncome
          : copy.savingsHint(formatCurrency(forecast.income), formatCurrency(forecast.expense))}</small>
      </div>
      <div className="forecast-stat">
        <span>{copy.upcoming}</span>
        <strong>{forecast.upcoming.length ? formatCurrency(forecast.upcomingExpense - forecast.upcomingIncome) : '—'}</strong>
        <small>{forecast.upcoming.length ? copy.upcomingCount(forecast.upcoming.length) : copy.upcomingNone}</small>
      </div>
    </div>
    {forecast.upcoming.length > 0 && <ul className="forecast-list">
      {forecast.upcoming.slice(0, 4).map((item) => <li key={item.id}>
        <time dateTime={item.date}>{showDate(item.date)}</time><span>{item.name}</span>
        <strong>{item.type === 'income' ? '+' : '−'}{formatCurrency(item.amount)}</strong>
      </li>)}
    </ul>}
    {goals.length > 0 && <div className="forecast-goals">
      <h3>{copy.goals}</h3>
      <ul className="forecast-list">
        {goals.map(({ jar, estimate }) => <li key={jar.id}>
          <span className="forecast-goal-name">{jar.name}</span>
          <span className={estimate.late ? 'is-late' : ''}>
            {estimate.stalled ? copy.goalStalled : copy.goalEta(showDate(estimate.date), formatCurrency(estimate.monthly))}
            {estimate.late && ` · ${copy.goalLate}`}
          </span>
        </li>)}
      </ul>
    </div>}
    {expectedDays.length > 0 && <p className="forecast-note">{copy.expectedNote}</p>}
  </section>;
}

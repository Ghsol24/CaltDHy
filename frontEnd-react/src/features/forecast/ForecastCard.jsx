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

/** Home card: projected month-end balance, savings rate (or overspend), items still due; jar goal dates folded away. */
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
  // Spending above income reads better as an amount than as a large negative savings rate.
  const overspent = forecast.expense > forecast.income ? forecast.expense - forecast.income : 0;
  const nextDue = forecast.upcoming[0];

  return <section className="forecast-card" aria-labelledby="forecast-title">
    <h2 id="forecast-title">{copy.title}</h2>
    <div className="forecast-grid">
      <div className={`forecast-stat is-main${forecast.projectedBalance < 0 ? ' is-negative' : ''}`}>
        <span>{copy.projected}</span>
        <strong>{formatCurrency(forecast.projectedBalance)}</strong>
        <small>{!forecast.hasData ? copy.noData : forecast.remainingDays === 0 ? copy.lastDay
          : forecast.projectedBalance < 0 ? copy.negative : copy.projectedHint(formatCurrency(forecast.dailyPace), forecast.remainingDays)}</small>
      </div>
      {overspent > 0 ? <div className="forecast-stat">
        <span>{copy.overspent}</span>
        <strong className="is-negative">{formatCurrency(overspent)}</strong>
        <small>{forecast.income > 0 ? copy.savingsHint(formatCurrency(forecast.income), formatCurrency(forecast.expense)) : copy.savingsNoIncome}</small>
      </div> : <div className="forecast-stat">
        <span>{copy.savingsRate}</span>
        <strong>{forecast.savingsRate === null ? '—' : `${forecast.savingsRate}%`}</strong>
        <small>{forecast.savingsRate === null ? copy.savingsNoIncome
          : copy.savingsHint(formatCurrency(forecast.income), formatCurrency(forecast.expense))}</small>
      </div>}
      <div className="forecast-stat">
        <span>{copy.upcoming}</span>
        <strong>{nextDue ? formatCurrency(forecast.upcomingExpense - forecast.upcomingIncome) : '—'}</strong>
        <small>{!nextDue ? copy.upcomingNone : forecast.upcoming.length === 1 ? `${showDate(nextDue.date)} · ${nextDue.name}`
          : copy.upcomingMany(forecast.upcoming.length, showDate(nextDue.date))}</small>
      </div>
    </div>
    {goals.length > 0 && <details className="forecast-goals">
      <summary>{copy.goalsShow}<span className="forecast-goals-chevron" aria-hidden="true">›</span></summary>
      <ul className="forecast-list">
        {goals.map(({ jar, estimate }) => <li key={jar.id}>
          <span className="forecast-goal-name">{jar.name}</span>
          <span className={estimate.late ? 'is-late' : ''}>
            {estimate.stalled ? copy.goalStalled : copy.goalEta(showDate(estimate.date), formatCurrency(estimate.monthly))}
            {estimate.late && ` · ${copy.goalLate}`}
          </span>
        </li>)}
      </ul>
    </details>}
    {expectedDays.length > 0 && <p className="forecast-note">{copy.expectedNote}</p>}
  </section>;
}

import React from 'react';
import { CashFlowPanel } from '../CashFlowPanel';
import { formatCurrency, formatDate, getLocalMonthString } from '../../../utils/formatters';
import { Bar } from 'react-chartjs-2';
import { Icon } from '../../../components/ui/AppIcons';
import { useTranslation } from '../../../i18n/useTranslation';

export function AnalyticsCashFlowSection({ activeMonth, backToCashFlowPeriod, barChartData, barChartRef, barOptions, cashFlowActive, changeCashFlowMonth, changeCashFlowPeriod, chartContext, currentMonthNum, dailyTrend, drilldown, excludeRecurring, hasTrendData, highestSpendingDays, isCompactChart, openDay, periodLabel, pinnedDefault, saveCashFlowChoice, saveCashFlowDefault, savingCashFlowPreferences, savingExpectedDay, selectedWeekIndex, setMobileWeek, today, toggleExpectedDay, trendMode, trendSeries, trendSummary, unusualDays, viewCashFlowHistory, visibleDailyDays, weekCount, weekEnd, weekStart }) {
  const { intlLocale, lang, t } = useTranslation();
  return (cashFlowActive && <CashFlowPanel
    t={t} lang={lang} intlLocale={intlLocale}
    periodMode={trendMode} series={trendSeries} excludeRecurring={excludeRecurring}
    activeMonth={activeMonth} periodLabel={periodLabel}
    summary={trendSummary} topDays={highestSpendingDays} hasData={hasTrendData}
    emptyMessage={trendMode === 'daily' && visibleDailyDays[0]?.date > today
      ? t('analytics.cashflow.futureDays')
      : isCompactChart && trendMode === 'daily' && dailyTrend.hasAnyData
        ? t('analytics.noDataForRange') : t('analytics.noChartData')}
    currentMonth={getLocalMonthString()} latestMonth={getLocalMonthString()}
    savingPreferences={savingCashFlowPreferences} pinnedDefault={pinnedDefault}
    onPeriodModeChange={changeCashFlowPeriod}
    onSeriesChange={(series) => saveCashFlowChoice({ series })}
    onExcludeRecurringChange={(excludeRecurring) => saveCashFlowChoice({ excludeRecurring })}
    onMonthChange={changeCashFlowMonth} onOpenDay={openDay}
    onViewHistory={viewCashFlowHistory}
    onPinDefault={() => saveCashFlowDefault(false)} onClearDefault={() => saveCashFlowDefault(true)}
    drilldownOrigin={drilldown} onBackToPeriod={backToCashFlowPeriod}
    chart={<Bar ref={barChartRef} data={barChartData} options={barOptions} plugins={[chartContext]}
      data-testid="cashflow-chart" data-series={trendSeries} data-mode={trendMode}
      role="img" aria-label={t(trendSeries === 'expense' ? 'analytics.cashFlowExpenseChartAria'
        : trendSeries === 'income' ? 'analytics.cashFlowIncomeChartAria' : 'analytics.cashFlowChartAria')} />}
    weekNavigation={isCompactChart && trendMode === 'daily' &&
      <div className="trend-week-nav" role="group" aria-label={t('analytics.weekNavigation')}>
        <button type="button" className="trend-week-nav__button" disabled={selectedWeekIndex === 0}
          aria-label={t('analytics.previousWeek')}
          onClick={() => setMobileWeek({ month: activeMonth, index: selectedWeekIndex - 1 })}>
          <Icon name="chevronLeft" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </button>
        <span className="trend-week-nav__range" aria-live="polite">
          {t('analytics.weekRange', { start: weekStart, end: weekEnd, month: currentMonthNum })}
        </span>
        <button type="button" className="trend-week-nav__button" disabled={selectedWeekIndex >= weekCount - 1}
          aria-label={t('analytics.nextWeek')}
          onClick={() => setMobileWeek({ month: activeMonth, index: selectedWeekIndex + 1 })}>
          <Icon name="chevronRight" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </button>
      </div>}
    unusualContent={trendMode === 'daily' && trendSeries !== 'income' && unusualDays.length > 0 &&
      <div className="analytics-unusual-days">
        <div><strong>{t('analytics.unusualTitle')}</strong><p>{t('analytics.unusualExplanation')}</p>
          <small>{t('analytics.cashflow.recurringExcluded')}</small></div>
        {unusualDays.map((day) => <div className="analytics-unusual-row" key={day.date}>
          <button type="button" onClick={() => openDay(day.date, 'expense', true)}>
            <strong>{formatDate(day.date, 'short', { locale: lang })}</strong>
            <span>{formatCurrency(day.amount)} · {t('analytics.unusualRatio', {
              ratio: day.ratio.toLocaleString(intlLocale, { maximumFractionDigits: 1 }),
            })}</span>
          </button>
          <button type="button" disabled={savingExpectedDay === day.date}
            onClick={() => toggleExpectedDay(day.date, true)}>{t('analytics.unusualMarkExpected')}</button>
        </div>)}
      </div>}
  />) || null;
}

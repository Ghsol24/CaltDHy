import React from 'react';
import { Icon, AlertTriangleOutlineIcon } from '../../../components/ui/AppIcons';
import { formatCurrency, formatDate, getLocalMonthString } from '../../../utils/formatters';
import { moneyNumber } from '../../../utils/moneyPrecision.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { getBudgetLineCopy } from '../transactionBudgetCopy';
import { describeBudgetLine } from './transactionModalHelpers';

/**
 * Máy tính, "Phương án 3": số tiền là ô nhập lớn ở giữa (dấu − cho chi tiêu theo màu chữ thường,
 * + màu xanh cho thu nhập), ngay dưới là một dòng phụ giữ nguyên chiều cao:
 * chi tiêu → hạn mức của danh mục đang chọn, thu nhập → số dư ví sau khi nạp.
 */
export function TransactionHero({
  type, amount, amountError, amountInputRef, handleAmountChange,
  category, categoryMetrics, baselineMetrics, budgetReady, budgetError, selectedPeriod, draftAmount,
  setBudgetRetry, onSetLimit, incomeLine, periodNotice
}) {
  const { t, label, lang } = useTranslation();
  const budgetCopy = getBudgetLineCopy(lang);
  const isIncome = type === 'income';
  const isCurrentPeriod = selectedPeriod === getLocalMonthString();
  const periodLabel = selectedPeriod ? formatDate(`${selectedPeriod}-01`, 'month', { locale: lang }) : '';
  const limitText = isCurrentPeriod ? budgetCopy.thisLimit : budgetCopy.periodLimit(periodLabel);
  const budgetLine = !isIncome && budgetReady && !budgetError && category
    ? describeBudgetLine({
      copy: budgetCopy,
      formatMoney: (raw) => formatCurrency(moneyNumber(raw)),
      baseline: baselineMetrics[category],
      category: label(category),
      hasDraft: draftAmount > 0,
      limit: limitText,
      metric: categoryMetrics[category]
    })
    : null;
  const errorId = 'txn-amount-error';
  // Rộng theo số chữ số để dấu và "₫" bám sát con số, kể cả khi gõ.
  const digits = Math.max(String(amount || '0').length, 1);

  return (
    <div className={`txn-hero${isIncome ? ' txn-hero--income' : ''}`}>
      <div className={`txn-hero__amount${amountError ? ' has-error' : ''}`}>
        <span className="txn-hero__sign" aria-hidden="true">{isIncome ? '+' : '−'}</span>
        <input
          id="txn-amount-input"
          ref={amountInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="txn-hero__input"
          placeholder="0"
          value={amount}
          onChange={handleAmountChange}
          required
          aria-required="true"
          aria-label={t('transaction.amount')}
          aria-invalid={amountError ? true : undefined}
          aria-describedby={amountError ? errorId : undefined}
          style={{ '--txn-hero-digits': digits }}
        />
        <span className="txn-hero__currency" aria-hidden="true">₫</span>
      </div>
      {amountError && (
        <p id={errorId} className="form-field-error txn-hero__error" role="alert">
          <Icon name="alertCircle" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <span>{amountError}</span>
        </p>
      )}

      {/* Dòng phụ luôn giữ chỗ để form không nhảy khi đổi danh mục / gõ số tiền. */}
      <div className="txn-hero__sub">
        {isIncome ? (
          <p className="txn-hero__line txn-hero__line--income" aria-live="polite">{incomeLine}</p>
        ) : (
          <>
            {selectedPeriod && !isCurrentPeriod && <p className="txn-budget-period">{t('transaction.budgetForPeriod', { month: periodLabel })}</p>}
            {!budgetReady && <p role="status" className="txn-budget-period">{t('transaction.budgetLoading')}</p>}
            {budgetError && <p role="alert" className="txn-budget-error">{t('transaction.budgetFailed')}
              {' '}<button type="button" onClick={() => setBudgetRetry((value) => value + 1)}>{t('common.tryAgain')}</button></p>}
            {/* Luôn có (trống khi đang tải / lỗi): không hiện hạn mức của kỳ khác, form không nhảy. */}
            <p className={`txn-budget-line txn-hero__line${budgetLine?.tone ? ` is-${budgetLine.tone}` : ''}`} aria-live="polite">
              {budgetLine?.tone === 'danger' && <AlertTriangleOutlineIcon size={14} />}
              {budgetLine?.tone === 'danger' ? <span>{budgetLine.text}</span> : budgetLine?.text}
              {budgetLine?.kind === 'unset' && (
                <>{' '}<button type="button" className="txn-budget-line__link" onClick={onSetLimit}>{budgetCopy.setLimit}</button></>
              )}
            </p>
          </>
        )}
      </div>
      {periodNotice}
    </div>
  );
}

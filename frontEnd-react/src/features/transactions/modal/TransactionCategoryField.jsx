import React, { useRef } from 'react';
import { formatCurrency, formatDate, getLocalMonthString } from '../../../utils/formatters';
import { moneyNumber } from '../../../utils/moneyPrecision.js';
import { CheckOutlineIcon, FolderOutlineIcon } from '../../../utils/categoryIcons';
import { AlertTriangleOutlineIcon } from '../../../components/ui/AppIcons';
import { CategoryMark } from '../../../components/ui/CategoryMark';
import { Icon } from '../../../components/ui/AppIcons';
import { CategorySummaryButton } from '../TransactionMobileFields';
import { getBudgetLineCopy } from '../transactionBudgetCopy';
import { describeBudgetLine, pickVisibleCategories } from './transactionModalHelpers';
import { useTranslation } from '../../../i18n/useTranslation';

const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Nhóm chọn một (radio): một điểm dừng Tab, mũi tên đổi danh mục và chuyển focus theo. */
function useRadioArrows() {
  const groupRef = useRef(null);
  const onKeyDown = (event) => {
    const step = ARROW_STEP[event.key];
    if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
    const radios = [...(groupRef.current?.querySelectorAll('[role="radio"]') || [])];
    const index = radios.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = radios[(index + step + radios.length) % radios.length];
    next.focus();
    next.click();
  };
  return { groupRef, onKeyDown };
}

export function TransactionCategoryField({ baselineMetrics, budgetError, budgetReady, category, categoryMetrics, close, draftAmount, isPhone, navigateTo, selectedPeriod, setBudgetRetry, setCategory, setPicker, sortedCategories, type }) {
  const { label, lang, t } = useTranslation();
  const { groupRef, onKeyDown } = useRadioArrows();
  const budgetCopy = getBudgetLineCopy(lang);
  const isCurrentPeriod = selectedPeriod === getLocalMonthString();
  const periodLabel = selectedPeriod ? formatDate(`${selectedPeriod}-01`, 'month', { locale: lang }) : '';
  const limitText = isCurrentPeriod ? budgetCopy.thisLimit : budgetCopy.periodLimit(periodLabel);
  const selectedKey = category.toLowerCase();
  const isSelectedCat = (name) => selectedKey === name.toLowerCase();
  const anySelected = sortedCategories.some((cat) => isSelectedCat(cat.name));

  const { visible, hasMore } = type === 'expense' ? pickVisibleCategories(sortedCategories, category) : { visible: sortedCategories, hasMore: false };
  const budgetLine = type === 'expense' && budgetReady && !budgetError && category
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

  return (
    <div className="txn-field-group">
      <label className="txn-label" id="txn-category-label">
        <span>{t('transaction.category')}</span>
      </label>

      {type === 'expense' && selectedPeriod && !isCurrentPeriod && <p className="txn-budget-period">
        {t('transaction.budgetForPeriod', { month: periodLabel })}
      </p>}
      {type === 'expense' && !budgetReady && <p role="status" className="txn-budget-period">{t('transaction.budgetLoading')}</p>}
      {type === 'expense' && budgetError && <p role="alert" className="txn-budget-error">{t('transaction.budgetFailed')}
        {' '}<button type="button" onClick={() => setBudgetRetry((value) => value + 1)}>{t('common.tryAgain')}</button></p>}
      {type === 'expense' && sortedCategories.length === 0 ? (
        <div className="txn-empty-categories" role="status">
          <span className="txn-empty-icon txn-empty-icon--layout" aria-hidden="true">
            <FolderOutlineIcon size={24} color="currentColor" />
          </span>
          <h4 className="txn-empty-title">{t('transaction.noCategory')}</h4>
          <p className="txn-empty-desc">{t('transaction.noCategoryHint')}</p>
          <button
            type="button"
            className="txn-empty-cta-btn"
            onClick={() => {
              close();
              navigateTo('plan', 'budgets');
            }}
          >
            {t('transaction.setupCategory')}
          </button>
        </div>
      ) : isPhone ? (
        <CategorySummaryButton
          labelId="txn-category-label"
          type={type}
          category={category}
          metric={categoryMetrics[category]}
          baseline={baselineMetrics[category]}
          hasDraft={draftAmount > 0}
          budgetReady={Boolean(budgetReady)}
          budgetError={budgetError}
          limitText={limitText}
          onOpen={() => setPicker('category')}
        />
      ) : type === 'income' ? (
        // Thu nhập không có hạn mức để hiển thị, nên mỗi danh mục chỉ cần biểu tượng và tên:
        // dùng chip gọn tự xuống dòng thay cho thẻ lớn lặp lại nhãn "Thu nhập".
        <div className="txn-category-chips" role="radiogroup" aria-labelledby="txn-category-label" ref={groupRef} onKeyDown={onKeyDown}>
          {sortedCategories.map((cat, index) => {
            const isSelected = isSelectedCat(cat.name);
            return (
              <button
                type="button"
                key={cat.name}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected || (!anySelected && index === 0) ? 0 : -1}
                className={`txn-category-chip${isSelected ? ' active' : ''}`}
                onClick={() => setCategory(cat.name)}
              >
                <span className="txn-category-chip__icon" aria-hidden="true">
                  {isSelected ? <CheckOutlineIcon size={14} /> : <CategoryMark name={cat.name} size={16} />}
                </span>
                <span className="txn-category-chip__name">{label(cat.name)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Chip gọn hai hàng: biểu tượng + tên (đủ chữ ở tooltip). Hạn mức chỉ nói ở dòng bên dưới. */}
          <div className="txn-category-grid" role="radiogroup" aria-labelledby="txn-category-label" ref={groupRef} onKeyDown={onKeyDown}>
            {visible.map((cat, index) => {
              const isSelected = isSelectedCat(cat.name);
              const name = label(cat.name);
              return (
                <button
                  type="button"
                  key={cat.name}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected || (!anySelected && index === 0) ? 0 : -1}
                  title={name}
                  className={`txn-category-card${isSelected ? ' active active--expense' : ''}`}
                  onClick={() => setCategory(cat.name)}
                >
                  <span className="txn-card-icon" aria-hidden="true">
                    <CategoryMark name={cat.name} size={18} />
                  </span>
                  <span className="txn-card-name">{name}</span>
                </button>
              );
            })}
            {hasMore && (
              <button
                type="button"
                className="txn-category-card txn-category-card--more"
                aria-haspopup="dialog"
                aria-label={budgetCopy.moreAria}
                title={budgetCopy.moreAria}
                onClick={() => setPicker('category')}
              >
                <span className="txn-card-icon" aria-hidden="true">
                  <Icon name="plus" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </span>
                <span className="txn-card-name">{budgetCopy.more}</span>
              </button>
            )}
          </div>

          {/* Một dòng ngân sách cho danh mục đang chọn; luôn giữ chiều cao để form không nhảy. */}
          <p
            className={`txn-budget-line${budgetLine?.tone ? ` is-${budgetLine.tone}` : ''}`}
            aria-live="polite"
          >
            {budgetLine?.tone === 'danger' && <AlertTriangleOutlineIcon size={14} />}
            {budgetLine?.tone === 'danger' ? <span>{budgetLine.text}</span> : budgetLine?.text}
            {budgetLine?.kind === 'unset' && (
              <>
                {' '}
                <button
                  type="button"
                  className="txn-budget-line__link"
                  onClick={() => {
                    close();
                    navigateTo('plan', 'budgets');
                  }}
                >
                  {budgetCopy.setLimit}
                </button>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

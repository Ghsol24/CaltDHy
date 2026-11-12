import React from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { CategoryOutlineIcon, CheckOutlineIcon, FolderOutlineIcon } from '../../../utils/categoryIcons';
import { CategorySummaryButton } from '../TransactionMobileFields';
import { useTranslation } from '../../../i18n/useTranslation';

export function TransactionCategoryField({ baselineMetrics, budgetError, budgetReady, category, categoryMetrics, close, draftAmount, isPhone, navigateTo, selectedPeriod, setBudgetRetry, setCategory, setPicker, sortedCategories, type }) {
  const { label, lang, t } = useTranslation();
  return (
    <div className="txn-field-group">
      <label className="txn-label" id="txn-category-label">
        <span>{t('transaction.category')}</span>
      </label>
    
      {type === 'expense' && selectedPeriod && <p className="txn-budget-period">
        {t('transaction.budgetForPeriod', { month: formatDate(`${selectedPeriod}-01`, 'month', { locale: lang }) })}
        {!isPhone && <>{' · '}{t('transaction.budgetPreview')}</>}
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
          onOpen={() => setPicker('category')}
        />
      ) : type === 'income' ? (
        // Thu nhập không có hạn mức để hiển thị, nên mỗi danh mục chỉ cần biểu tượng và tên:
        // dùng chip gọn tự xuống dòng thay cho thẻ lớn lặp lại nhãn "Thu nhập".
        <div className="txn-category-chips" role="radiogroup" aria-label={t('transaction.chooseCategory')}>
          {sortedCategories.map((cat) => {
            const isSelected = category.toLowerCase() === cat.name.toLowerCase();
            return (
              <button
                type="button"
                key={cat.name}
                role="radio"
                aria-checked={isSelected}
                className={`txn-category-chip${isSelected ? ' active' : ''}`}
                onClick={() => setCategory(cat.name)}
              >
                <span className="txn-category-chip__icon" aria-hidden="true">
                  {isSelected ? <CheckOutlineIcon size={14} /> : <CategoryOutlineIcon name={cat.name} size={16} />}
                </span>
                <span className="txn-category-chip__name">{label(cat.name)}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="txn-category-grid" role="radiogroup" aria-label={t('transaction.chooseCategory')}>
          {sortedCategories.map((cat) => {
            const isSelected = category.toLowerCase() === cat.name.toLowerCase();
            const metric = categoryMetrics[cat.name];
            return (
              <button
                type="button"
                key={cat.name}
                role="radio"
                aria-checked={isSelected}
                className={`txn-category-card ${isSelected ? 'active' : ''} ${isSelected ? (type === 'income' ? 'active--income' : 'active--expense') : ''} ${metric && !metric.hasLimit ? 'is-unset' : ''}`}
                onClick={() => setCategory(cat.name)}
              >
                {isSelected && (
                  <span className={`txn-card-check-badge ${type === 'income' ? 'txn-card-check-badge--income' : ''}`} aria-hidden="true">
                    <CheckOutlineIcon size={10} />
                  </span>
                )}
                <span className="txn-card-icon" aria-hidden="true">
                  <CategoryOutlineIcon name={cat.name} size={18} />
                </span>
                <span className="txn-card-name" title={cat.name}>
                  {label(cat.name)}
                </span>
    
                {type === 'expense' && metric ? (
                  <>
                    <div className="txn-card-amount">
                      {metric.hasLimit
                        ? `${formatCurrency(metric.remaining)}`
                        : `${formatCurrency(0)}`}
                    </div>
                    <div
                      className={`txn-card-subtitle${metric.hasLimit && (metric.percent < 15 || metric.rawRemaining <= 0) ? ' txn-card-subtitle--danger' : ''}`}
                    >
                      {metric.statusLabel}
                    </div>
                    <div className="txn-card-progress-track" aria-hidden="true">
                      <div
                        className="txn-card-progress-fill txn-card-progress-fill--box"
                        style={{ '--txn-card-progress-fill-width': metric.hasLimit ? `${metric.percent}%` : '0%', '--txn-card-progress-fill-background-color': metric.color }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="txn-card-income-tag">
                    {type === 'expense' ? t(budgetError ? 'transaction.budgetUnavailable' : 'transaction.budgetLoading') : t('type.income')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

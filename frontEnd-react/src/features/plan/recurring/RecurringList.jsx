import React from 'react';
import { isInstallmentEnded, isRecurringIncome } from '../../../utils/installmentTerm';
import { formatCurrency, formatDate, getRecurringTier, parseDate } from '../../../utils/formatters';
import { CYCLE_SUFFIXES } from './recurringOptions';
import { detectBrandInfo } from '../../../utils/brandDetection';
import { translateLegacyText } from '../../../i18n/legacyTranslations';
import { BrandLogoIcon } from '../../../utils/brandIcons';
import { Icon } from '../../../components/ui/AppIcons';
import { useTranslation } from '../../../i18n/useTranslation';
import { MenuPopover } from '../../../components/ui/MenuPopover';

// One row per item: name · category, then one line "Ngày 24 hằng tháng · còn 9 ngày · ZaloPay".
// The wallet is plain text here; it is changed in the edit dialog, not by a stray tap (REC-02).
export function RecurringList({ currentMonthStr, displayItems, handleDelete, handleOpenEdit, handlePay, handleToggle, isLoading, menuRef, menuTriggerRef, openActionMenuId, pendingActions, setOpenActionMenuId, wallets }) {
  const { label, lang, t } = useTranslation();
  return (!isLoading && displayItems.length > 0 && (
    <div className="recurring-rows-list">
      {displayItems.map((item) => {
        const isActive = item.active !== false;
        const isEnded = isInstallmentEnded(item);
        const isIncome = isRecurringIncome(item);
        const tierInfo = getRecurringTier(item, currentMonthStr);
        const cycleSuffix = CYCLE_SUFFIXES[item.cycle] || '/tháng';
        const brandInfo = isIncome
          ? { brandKey: 'default', categoryDefault: 'Salary', noteDefault: '' }
          : detectBrandInfo(item.name);
        const brandKey = item.brandKey || brandInfo.brandKey;
  
        const parsedDueDate = item.nextDueDate ? parseDate(item.nextDueDate) : null;
        const formattedEndDate = item.endDate ? formatDate(item.endDate, 'day-date') : '';
        const dueDay = parsedDueDate ? parsedDueDate.getDate() : null;
        const dayText = !parsedDueDate ? 'Chưa định ngày'
          : item.cycle === 'yearly' ? `Ngày ${dueDay}/${parsedDueDate.getMonth() + 1} hằng năm`
          : item.cycle === 'quarterly' ? `Ngày ${dueDay} hằng quý`
          : `Ngày ${dueDay} hằng tháng`;

        const assignedWallet = wallets.find((w) => String(w.id) === String(item.walletId))
          || (item.walletId ? null : wallets[0]);
        const walletLabel = assignedWallet?.name || (item.walletId ? 'Ví đã lưu trữ' : 'Chưa chọn ví');
        const categoryLabel = label(item.category || brandInfo.categoryDefault);
        const noteLabel = translateLegacyText(lang, item.note || item.desc || brandInfo.noteDefault || '');

        const isPaidThisMonth = tierInfo.isPaidThisMonth;
        const walletColLabel = isIncome ? 'Ví nhận tiền' : 'Ví trừ tiền';
        // Red only when overdue; due today or within a few days is orange; paid is green.
        let status;
        if (isEnded) status = { tone: 'muted', text: 'Đã kết thúc' };
        else if (!isActive) status = { tone: 'muted', text: 'Tạm dừng' };
        else if (tierInfo.tier === 'paid') status = { tone: 'ok', text: isIncome ? 'Đã nhận tháng này' : tierInfo.text };
        else if (tierInfo.isOverdue) status = { tone: 'danger', text: tierInfo.text };
        else if (tierInfo.tier === 'danger' || tierInfo.tier === 'warning') status = { tone: 'warning', text: tierInfo.text };
        else status = { tone: 'normal', text: tierInfo.text };
        // Xác nhận một chạm: chỉ hiện khi kỳ này đã tới gần (≤ 3 ngày), đến hạn hoặc quá hạn.
        const canQuickConfirm = isActive && !isEnded && !isPaidThisMonth && tierInfo.tier === 'danger';

        const isMenuOpen = openActionMenuId === item.id;
        const pendingAction = pendingActions[item.id];

        return (
          <div
            key={item.id}
            className={`recurring-row-card ${isIncome ? 'is-income' : ''} ${!isActive ? 'is-paused' : ''} ${isEnded ? 'is-ended' : ''} ${isMenuOpen ? 'has-open-dropdown' : ''} ${pendingAction ? 'is-processing' : ''}`}
            aria-busy={Boolean(pendingAction)}
          >
            <div className="recurring-row-logo-col">
              <BrandLogoIcon brandKey={brandKey} size={48} />
            </div>

            <div className="recurring-row-main-col">
              <div className="recurring-title-row">
                <h2 className="recurring-main-name" title={noteLabel ? `${item.name} — ${noteLabel}` : item.name}>
                  {item.name}
                </h2>
                <span className="recurring-category-text">{categoryLabel}</span>
                {isIncome && <span className="recurring-income-badge">Khoản thu</span>}
              </div>

              <p className="recurring-meta-line">
                {(pendingAction === 'pay' || pendingAction === 'toggle') && <span className="btn-spinner" role="status" aria-label={t('common.processing')} />}
                <span>{dayText}</span>
                <span className="recurring-meta-sep" aria-hidden="true">·</span>
                <span className={`recurring-status-text is-${status.tone}`}>{status.text}</span>
                {formattedEndDate && (
                  <>
                    <span className="recurring-meta-sep" aria-hidden="true">·</span>
                    <span>{isEnded ? formattedEndDate : `Kết thúc ${formattedEndDate}`}</span>
                  </>
                )}
                <span className="recurring-meta-sep" aria-hidden="true">·</span>
                <span className="recurring-wallet-text" title={walletColLabel}>
                  <span className="bdash-sr-only">{walletColLabel}: </span>{walletLabel}
                </span>
              </p>
            </div>

            <div className="recurring-row-amount-col">
              <strong className="recurring-row-price">
                {isIncome ? '+' : ''}{formatCurrency(item.amount)}<span className="price-cycle">{cycleSuffix}</span>
              </strong>
            </div>

            <div className="recurring-row-confirm-col">
              {canQuickConfirm && (
                <button
                  type="button"
                  className="recurring-quick-confirm-btn"
                  onClick={() => handlePay(item)}
                  disabled={Boolean(pendingAction)}
                  aria-label={`${isIncome ? 'Đã nhận' : 'Đã trả'}: ${item.name}`}
                >
                  <Icon name="check" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                  <span>{isIncome ? 'Đã nhận' : 'Đã trả'}</span>
                </button>
              )}
            </div>

            {/* 6. Actions: 3-dots Menu ONLY with Pure Outline SVG Icons */}
            <div className="recurring-row-actions-col">
              <div className="recurring-menu-wrapper" ref={isMenuOpen ? menuRef : null}>
                <button
                  type="button"
                  className="recurring-dots-action-btn"
                  onClick={(e) => { menuTriggerRef.current = e.currentTarget; setOpenActionMenuId(isMenuOpen ? null : item.id); }}
                  disabled={Boolean(pendingAction)}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="true"
                  aria-label={`Tùy chọn cho khoản ${item.name}`}
                  title="Tùy chọn"
                >
                  <Icon name="moreVertical" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </button>
  
                {isMenuOpen && (
                  <MenuPopover className="recurring-actions-dropdown" label={`Tùy chọn cho khoản ${item.name}`} onClose={() => setOpenActionMenuId(null)} triggerRef={menuTriggerRef}>
                    <button
                      type="button"
                      className="actions-dropdown-item"
                      role="menuitem"
                      onClick={() => handlePay(item)}
                      disabled={isEnded}
                      title={isEnded ? 'Gia hạn ngày kết thúc để tiếp tục thanh toán' : undefined}
                    >
                      <Icon name="check" className="menu-action-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <span>{isIncome
                        ? (isPaidThisMonth ? 'Đánh dấu đã nhận kỳ tới' : 'Đánh dấu đã nhận kỳ này')
                        : (isPaidThisMonth ? 'Đánh dấu đã trả kỳ tới' : 'Đánh dấu đã trả kỳ này')}</span>
                    </button>
                    <button
                      type="button"
                      className="actions-dropdown-item"
                      role="menuitem"
                      onClick={() => handleOpenEdit(item)}
                    >
                      <Icon name="pencil" className="menu-action-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <span>Chỉnh sửa khoản định kỳ</span>
                    </button>
                    <button
                      type="button"
                      className="actions-dropdown-item"
                      role="menuitem"
                      onClick={() => handleToggle(item)}
                      disabled={isEnded}
                      title={isEnded ? 'Gia hạn ngày kết thúc để tiếp tục theo dõi' : undefined}
                    >
                      <Icon name={isActive ? 'pause' : 'play'} className="menu-action-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <span>{isActive ? 'Tạm dừng theo dõi' : 'Tiếp tục theo dõi'}</span>
                    </button>
                    <div className="dropdown-menu-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="actions-dropdown-item text-danger"
                      role="menuitem"
                      onClick={() => handleDelete(item)}
                    >
                      <Icon name="trash" className="menu-action-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <span>Xóa khoản định kỳ</span>
                    </button>
                  </MenuPopover>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )) || null;
}

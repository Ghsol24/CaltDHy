import React from 'react';
import { isInstallmentEnded } from '../../../utils/installmentTerm';
import { formatCurrency, formatDate, getRecurringTier, parseDate } from '../../../utils/formatters';
import { CYCLE_SUFFIXES } from './recurringOptions';
import { detectBrandInfo } from '../../../utils/brandDetection';
import { translateLegacyText } from '../../../i18n/legacyTranslations';
import { BrandLogoIcon } from '../../../utils/brandIcons';
import { Icon } from '../../../components/ui/AppIcons';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { useTranslation } from '../../../i18n/useTranslation';

export function RecurringList({ currentMonthStr, displayItems, handleAssignWallet, handleDelete, handleOpenEdit, handlePay, handleToggle, isLoading, menuRef, menuTriggerRef, openActionMenuId, openWalletSelectorId, pendingActions, setOpenActionMenuId, setOpenWalletSelectorId, walletRef, wallets }) {
  const { label, lang, t } = useTranslation();
  return (!isLoading && displayItems.length > 0 && (
    <div className="recurring-rows-list">
      {displayItems.map((item) => {
        const isActive = item.active !== false;
        const isEnded = isInstallmentEnded(item);
        const tierInfo = getRecurringTier(item, currentMonthStr);
        const cycleSuffix = CYCLE_SUFFIXES[item.cycle] || '/ tháng';
        const brandInfo = detectBrandInfo(item.name);
        const brandKey = item.brandKey || brandInfo.brandKey;
  
        // Formatted due date
        const parsedDueDate = item.nextDueDate ? parseDate(item.nextDueDate) : null;
        const formattedDueDate = parsedDueDate ? formatDate(parsedDueDate, 'day-date') : item.nextDueDate || 'Chưa định ngày';
        const formattedEndDate = item.endDate ? formatDate(item.endDate, 'day-date') : '';
        const dayOfMonth = parsedDueDate ? String(parsedDueDate.getDate()).padStart(2, '0') : '01';
  
        // Assigned wallet
        const assignedWallet = wallets.find((w) => String(w.id) === String(item.walletId))
          || (item.walletId ? null : wallets[0]);
        const walletLabel = assignedWallet?.name || (item.walletId ? 'Ví đã lưu trữ' : 'Chọn ví');
        const categoryLabel = label(item.category || brandInfo.categoryDefault);
        const noteLabel = translateLegacyText(lang, item.note || item.desc || brandInfo.noteDefault || '');
  
        const isPaidThisMonth = tierInfo.isPaidThisMonth;
  
        const isMenuOpen = openActionMenuId === item.id;
        const isWalletMenuOpen = openWalletSelectorId === item.id;
        const pendingAction = pendingActions[item.id];
  
        return (
          <div
            key={item.id}
            className={`recurring-row-card ${!isActive ? 'is-paused' : ''} ${isEnded ? 'is-ended' : ''} ${isWalletMenuOpen || isMenuOpen ? 'has-open-dropdown' : ''} ${pendingAction ? 'is-processing' : ''}`}
            aria-busy={Boolean(pendingAction)}
          >
            {/* 1. Brand Logo Tile */}
            <div className="recurring-row-logo-col">
              <BrandLogoIcon brandKey={brandKey} size={48} />
            </div>
  
            {/* 2. Title & Meta Info */}
            <div className="recurring-row-main-col">
              <div className="recurring-title-row">
                <h4 className="recurring-main-name" title={item.name}>
                  {item.name}
                </h4>
                <span className="recurring-category-badge">
                  {categoryLabel}
                </span>
              </div>
  
              <div className="recurring-meta-row">
                <span className="recurring-meta-item">
                  <Icon name="calendar" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <span>Ngày thanh toán: <strong>{dayOfMonth} hàng tháng</strong></span>
                </span>
  
                {formattedEndDate && (
                  <span className="recurring-meta-item recurring-term-meta">
                    <Icon name="calendarAlt" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                    <span>Kết thúc: <strong>{formattedEndDate}</strong></span>
                  </span>
                )}
  
                {noteLabel && (
                  <span className="recurring-meta-item recurring-meta-note">
                    <Icon name="tag" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <span>{noteLabel}</span>
                  </span>
                )}
              </div>
            </div>
  
            {/* Wallet + due status: one footer row on phones; transparent to the desktop grid. */}
            <div className="recurring-row-footer">
            {/* 3. Ví trừ tiền (Custom Themed Dropdown Popover) */}
            <div className="recurring-row-wallet-col">
              <span className="row-col-label">Ví trừ tiền</span>
              <div className="recurring-wallet-custom-wrapper" ref={isWalletMenuOpen ? walletRef : null}>
                <button
                  type="button"
                  className="recurring-wallet-chip-btn"
                  onClick={() => setOpenWalletSelectorId(isWalletMenuOpen ? null : item.id)}
                  disabled={Boolean(pendingAction)}
                  aria-expanded={isWalletMenuOpen}
                  title={assignedWallet?.name ? `Ví trừ tiền: ${assignedWallet.name}` : walletLabel}
                >
                  <span className="wallet-chip-icon" aria-hidden="true">
                    {pendingAction === 'wallet' ? <span className="btn-spinner" /> : <WalletOutlineIcon type={assignedWallet?.type} size={16} color="currentColor" />}
                  </span>
                  <span className="wallet-chip-name">{walletLabel}</span>
                  <Icon name="chevronDown" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </button>
  
                {isWalletMenuOpen && (
                  <div
                    className="recurring-wallet-popover-menu"
                    role="menu"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="wallet-popover-header">Chọn ví trừ tiền</div>
                    {wallets.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={`wallet-popover-item ${String(w.id) === String(assignedWallet?.id) ? 'is-active' : ''}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignWallet(item, w.id);
                        }}
                      >
                        <span className="wallet-popover-icon">
                          <WalletOutlineIcon type={w.type} size={16} color="currentColor" />
                        </span>
                        <div className="wallet-popover-info">
                          <span className="wallet-popover-name">{w.name}</span>
                          <span className="wallet-popover-bal">{formatCurrency(w.currentBalance ?? 0)}</span>
                        </div>
                        {String(w.id) === String(assignedWallet?.id) && (
                          <Icon name="check" className="wallet-check-icon" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
  
            {/* 4. Due Status Countdown Pill */}
            <div className="recurring-row-due-col">
              <div className={`recurring-due-pill-box due-${isEnded ? 'ended' : tierInfo.tier}`}>
                {(pendingAction === 'pay' || pendingAction === 'toggle') && <span className="btn-spinner" role="status" aria-label={t('common.processing')} />}
                {isEnded ? (
                  <>
                    <div className="due-pill-top">
                      <Icon name="minusCircle" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                      <strong>Đã kết thúc</strong>
                    </div>
                    <span className="due-pill-sub">Kỳ hạn: {formattedEndDate}</span>
                  </>
                ) : tierInfo.tier === 'paid' ? (
                  <>
                    <div className="due-pill-top">
                      <Icon name="check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <strong>{tierInfo.text}</strong>
                    </div>
                    <span className="due-pill-sub">
                      Kỳ tới: {formattedDueDate}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="due-pill-top">
                      {tierInfo.tier === 'danger' ? (
                        <Icon name="alertCircle" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <Icon name="clock" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                      <strong>{tierInfo.text}</strong>
                    </div>
                    <span className="due-pill-sub">
                      Đến hạn vào {formattedDueDate}
                    </span>
                  </>
                )}
              </div>
            </div>
  
            </div>
  
            {/* 5. Amount */}
            <div className="recurring-row-amount-col">
              <span className="row-col-label">Số tiền</span>
              <strong className="recurring-row-price">
                {formatCurrency(item.amount)} <span className="price-cycle">{cycleSuffix}</span>
              </strong>
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
                  <div className="recurring-actions-dropdown" role="menu">
                    <button
                      type="button"
                      className="actions-dropdown-item"
                      role="menuitem"
                      onClick={() => handlePay(item)}
                      disabled={isEnded}
                      title={isEnded ? 'Gia hạn ngày kết thúc để tiếp tục thanh toán' : undefined}
                    >
                      <Icon name="check" className="menu-action-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <span>{isPaidThisMonth ? 'Đánh dấu đã trả kỳ tới' : 'Đánh dấu đã trả kỳ này'}</span>
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
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )) || null;
}

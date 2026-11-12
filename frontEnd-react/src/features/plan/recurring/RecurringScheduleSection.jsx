import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { formatCurrency } from '../../../utils/formatters';
import { CYCLE_OPTIONS } from './cycleOptions';
import { CustomDatePicker } from '../../../components/ui/CustomDatePicker';

export function RecurringScheduleSection({ amount, cycRef, cycle, endDate, handleAmountChange, hasArchivedWallet, hasEndDate, installmentToEdit, isCycleDropdownOpen, isIncome = false, isWalletDropdownOpen, nextDueDate, selectedCycleLabel, selectedWallet, setCycle, setEndDate, setHasEndDate, setIsCategoryDropdownOpen, setIsCycleDropdownOpen, setIsWalletDropdownOpen, setNextDueDate, setWalletId, walRef, wallets }) {
  return (
    <div className="recurring-form-section">
      <div className="recurring-section-header">
        <Icon name="creditCard" className="section-header-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <span className="section-header-title">Thiết lập dòng tiền & Chu kỳ</span>
      </div>
    
      <div className="recurring-section-content">
        <div className="recurring-form-grid-2col">
          {/* Số tiền mỗi kỳ */}
          <div className="txn-field-group">
            <label htmlFor="rec-amount" className="txn-label">
              <span>Số tiền mỗi kỳ</span>
            </label>
            <div className="txn-amount-box">
              <input
                id="rec-amount"
                type="text"
                inputMode="numeric"
                className="txn-amount-input"
                placeholder="0"
                value={amount}
                onChange={handleAmountChange}
                required
              />
              <span className="txn-amount-suffix">VNĐ</span>
            </div>
          </div>
    
          {/* Ví trừ tiền mặc định */}
          <div className="txn-field-group" ref={walRef}>
            <label className="txn-label">
              <span>{isIncome ? 'Ví nhận tiền' : 'Ví trừ tiền'}</span>
            </label>
            <div className="modal-custom-dropdown-wrap">
              <button
                type="button"
                className={`modal-custom-dropdown-btn ${isWalletDropdownOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setIsWalletDropdownOpen(!isWalletDropdownOpen);
                  setIsCategoryDropdownOpen(false);
                  setIsCycleDropdownOpen(false);
                }}
                aria-expanded={isWalletDropdownOpen}
              >
                <div className="dropdown-btn-content">
                  <WalletOutlineIcon type={selectedWallet?.type} size={16} color="currentColor" className="dropdown-outline-icon text-brand" />
                  <span className="dropdown-btn-text">{selectedWallet?.name || 'Chọn ví'}</span>
                </div>
                <Icon name="chevronDown" className="dropdown-chevron-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </button>
    
              {isWalletDropdownOpen && (
                <div className="modal-custom-dropdown-menu" role="listbox">
                  {wallets.map((w) => {
                    const isSelected = String(w.id) === String(selectedWallet?.id || '');
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`modal-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setWalletId(w.id);
                          setIsWalletDropdownOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="dropdown-item-left">
                          <WalletOutlineIcon type={w.type} size={16} color="currentColor" className="dropdown-outline-icon" />
                          <div className="wallet-dropdown-text-group">
                            <span className="dropdown-item-label">{w.name}</span>
                            <span className="dropdown-item-sub">{formatCurrency(w.currentBalance ?? 0)}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <Icon name="check" className="dropdown-item-check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {hasArchivedWallet && (
              <span className="recurring-term-hint" role="note">
                Ví trước đây đã lưu trữ. Hãy chọn ví mới trước khi gia hạn khoản này.
              </span>
            )}
          </div>
    
          {/* Chu kỳ thanh toán */}
          <div className="txn-field-group" ref={cycRef}>
            <label className="txn-label">
              <span>Chu kỳ lặp</span>
            </label>
            <div className="modal-custom-dropdown-wrap">
              <button
                type="button"
                className={`modal-custom-dropdown-btn ${isCycleDropdownOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setIsCycleDropdownOpen(!isCycleDropdownOpen);
                  setIsCategoryDropdownOpen(false);
                  setIsWalletDropdownOpen(false);
                }}
                aria-expanded={isCycleDropdownOpen}
              >
                <div className="dropdown-btn-content">
                  <Icon name="rotateCw" className="dropdown-outline-icon text-brand" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                  <span className="dropdown-btn-text">{selectedCycleLabel}</span>
                </div>
                <Icon name="chevronDown" className="dropdown-chevron-icon" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </button>
    
              {isCycleDropdownOpen && (
                <div className="modal-custom-dropdown-menu" role="listbox">
                  {CYCLE_OPTIONS.map((opt) => {
                    const isSelected = opt.value === cycle;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`modal-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setCycle(opt.value);
                          setIsCycleDropdownOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="dropdown-item-left">
                          <span className="dropdown-item-label">{opt.label}</span>
                        </div>
                        {isSelected && (
                          <Icon name="check" className="dropdown-item-check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
    
          {/* Ngày đến hạn tiếp theo */}
          <div className="txn-field-group">
            <label htmlFor="rec-date" className="txn-label">
              <span>Ngày đến hạn tiếp theo</span>
            </label>
            <CustomDatePicker
              id="rec-date"
              inputClassName="txn-input"
              value={nextDueDate}
              onChange={setNextDueDate}
              required
            />
          </div>
        </div>
        <div className="recurring-term-control">
          <label className="recurring-term-toggle" htmlFor="rec-has-end-date">
            <span className="recurring-term-copy">
              <strong>Có kỳ hạn</strong>
              <span>Đặt ngày kết thúc cho khoản định kỳ này</span>
            </span>
            <input
              id="rec-has-end-date"
              type="checkbox"
              role="switch"
              checked={hasEndDate}
              onChange={(e) => setHasEndDate(e.target.checked)}
              aria-controls="rec-term-date"
            />
            <span className="recurring-term-switch" aria-hidden="true" />
          </label>
          {hasEndDate && (
            <div className="txn-field-group recurring-term-date-field" id="rec-term-date">
              <label htmlFor="rec-end-date" className="txn-label">
                <span>Ngày kết thúc</span>
              </label>
              <CustomDatePicker
                id="rec-end-date"
                inputClassName="txn-input"
                value={endDate}
                min={installmentToEdit ? undefined : nextDueDate}
                onChange={setEndDate}
                required
              />
              <span className="recurring-term-hint">Kỳ đến hạn đúng ngày này vẫn được tính.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

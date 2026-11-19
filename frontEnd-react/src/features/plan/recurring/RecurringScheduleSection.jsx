import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';
import { WalletOutlineIcon } from '../../../components/ui/WalletOutlineIcon';
import { formatCurrency } from '../../../utils/formatters';
import { CYCLE_OPTIONS } from './cycleOptions';
import { CustomDatePicker } from '../../../components/ui/CustomDatePicker';
import { FormField } from '../../../components/ui/FormField';

export function RecurringScheduleSection({ errors = {}, amount, cycRef, cycle, endDate, handleAmountChange, hasArchivedWallet, hasEndDate, installmentToEdit, isCycleDropdownOpen, isIncome = false, isWalletDropdownOpen, nextDueDate, selectedCycleLabel, selectedWallet, setCycle, setEndDate, setHasEndDate, setIsCategoryDropdownOpen, setIsCycleDropdownOpen, setIsWalletDropdownOpen, setNextDueDate, setWalletId, walRef, wallets }) {
  return (
    <>
        <div className="recurring-form-grid-2col">
          <FormField label="Số tiền mỗi kỳ" htmlFor="rec-amount" error={errors.amount}>
            {({ describedBy, invalid }) => (
              <div className={`txn-amount-box${invalid ? ' has-error' : ''}`}>
                <input
                  id="rec-amount"
                  type="text"
                  inputMode="numeric"
                  className="txn-amount-input"
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  required
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                />
                <span className="txn-amount-suffix">₫</span>
              </div>
            )}
          </FormField>

          <FormField label={isIncome ? 'Ví nhận tiền' : 'Ví trừ tiền'} ref={walRef} error={errors.wallet}>
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
            {hasArchivedWallet && !errors.wallet && (
              <span className="recurring-term-hint" role="note">
                Ví trước đây đã lưu trữ. Hãy chọn ví mới trước khi gia hạn khoản này.
              </span>
            )}
          </FormField>

          <FormField label="Chu kỳ lặp" ref={cycRef}>
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
          </FormField>

          <FormField label="Ngày đến hạn tiếp theo" htmlFor="rec-date" error={errors.date}>
            <CustomDatePicker
              id="rec-date"
              inputClassName="txn-input"
              value={nextDueDate}
              onChange={setNextDueDate}
              required
            />
          </FormField>
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
            <FormField
              id="rec-term-date"
              className="recurring-term-date-field"
              label="Ngày kết thúc"
              htmlFor="rec-end-date"
              hint="Kỳ đến hạn đúng ngày này vẫn được tính."
              error={errors.endDate}
            >
              <CustomDatePicker
                id="rec-end-date"
                inputClassName="txn-input"
                value={endDate}
                min={installmentToEdit ? undefined : nextDueDate}
                onChange={setEndDate}
                required
              />
            </FormField>
          )}
        </div>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';
import { DEFAULT_EXPENSE_CATEGORIES } from '../../utils/categories';

const getRecurringIcon = (name) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('nhà') || lower.includes('thuê') || lower.includes('trọ') || lower.includes('phòng')) return '🏠';
  if (lower.includes('internet') || lower.includes('wifi') || lower.includes('mạng')) return '🌐';
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('youtube') || lower.includes('phim')) return '🎬';
  if (lower.includes('điện') || lower.includes('nước') || lower.includes('rác')) return '⚡';
  if (lower.includes('xe') || lower.includes('xăng') || lower.includes('bảo hiểm')) return '🚗';
  if (lower.includes('điện thoại') || lower.includes('4g') || lower.includes('sim')) return '📱';
  if (lower.includes('học') || lower.includes('sách') || lower.includes('khóa')) return '📚';
  if (lower.includes('gym') || lower.includes('thể dục') || lower.includes('fitness')) return '🏋️';
  return '🔁';
};

export function RecurringModal({ isOpen, onClose }) {
  const { createInstallment } = useJarStore();
  const { expenseCategories } = useTransactionStore();
  const { addToast } = useToastStore();

  const activeExpenseCats = expenseCategories && expenseCategories.length > 0
    ? expenseCategories
    : DEFAULT_EXPENSE_CATEGORIES;

  const [name, setName] = useState('');
  const [category, setCategory] = useState(() => activeExpenseCats[0]?.name || 'Housing & Bills');
  const [amount, setAmount] = useState('');
  const [cycle, setCycle] = useState('monthly');
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  const nameInputRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    setName('');
    setCategory('Housing & Bills');
    setAmount('');
    setCycle('monthly');
    setNextDueDate(new Date().toISOString().split('T')[0]);
    setErrorMsg('');

    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setAmount(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên khoản định kỳ hoặc trả góp.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanAmount = parseInt(String(amount).replace(/\D/g, ''), 10);
    if (!cleanAmount || cleanAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền hợp lệ (> 0).');
      return;
    }

    if (!nextDueDate) {
      setErrorMsg('Vui lòng chọn ngày đến hạn thanh toán.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createInstallment({
        name: name.trim(),
        category,
        amount: cleanAmount,
        cycle,
        nextDueDate,
        icon: getRecurringIcon(name.trim())
      });

      setIsSubmitting(false);
      onClose();
      addToast({
        type: 'success',
        message: `Đã tạo khoản định kỳ "${name.trim()}" (${formatCurrency(cleanAmount)}/${cycle === 'yearly' ? 'năm' : cycle === 'quarterly' ? 'quý' : 'tháng'}).`,
        duration: 4000
      });
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Không thể tạo khoản định kỳ.');
    }
  };

  return (
    <div
      className="txn-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="txn-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header">
          <h2 id="recurring-modal-title" className="txn-modal-title">
            ➕ Thêm khoản định kỳ / trả góp
          </h2>
          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="txn-modal-body">
            {/* Name */}
            <div className="txn-field-group">
              <label htmlFor="rec-name" className="txn-label">
                <span>Tên khoản chi / gói dịch vụ</span>
              </label>
              <input
                id="rec-name"
                ref={nameInputRef}
                type="text"
                className="txn-input"
                placeholder="VD: Tiền thuê nhà, Gói Internet, Netflix, Trả góp iPhone..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            {/* Category Selection (SSOT từ categories.js) */}
            <div className="txn-field-group">
              <label htmlFor="rec-category" className="txn-label">
                <span>Danh mục chi tiêu</span>
              </label>
              <select
                id="rec-category"
                className="txn-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {activeExpenseCats.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="txn-field-group">
              <label htmlFor="rec-amount" className="txn-label">
                <span>Số tiền mỗi kỳ thanh toán</span>
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

            {/* Cycle & Next Due Date in 2 columns */}
            <div className="transfer-wallet-row">
              <div className="txn-field-group">
                <label htmlFor="rec-cycle" className="txn-label">
                  <span>Chu kỳ lặp</span>
                </label>
                <select
                  id="rec-cycle"
                  className="txn-select"
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value)}
                >
                  <option value="monthly">Hàng tháng</option>
                  <option value="quarterly">Hàng quý (3 tháng)</option>
                  <option value="yearly">Hàng năm</option>
                </select>
              </div>

              <div className="txn-field-group">
                <label htmlFor="rec-date" className="txn-label">
                  <span>Ngày đến hạn tiếp theo</span>
                </label>
                <input
                  id="rec-date"
                  type="date"
                  className="txn-input"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  required
                />
              </div>
            </div>


            {/* Error Message */}
            {errorMsg && (
              <div className="txn-error-banner" role="alert">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="txn-modal-footer">
            <button
              type="button"
              className="txn-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="txn-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Tạo khoản định kỳ'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

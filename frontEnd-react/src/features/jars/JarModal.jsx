import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';

const PRESET_COLORS = [
  '#059669', // Emerald Green
  '#3B82F6', // Royal Blue (Selected by default)
  '#7C3AED', // Vivid Purple
  '#F97316', // Orange
  '#EF4444', // Red
  '#0891B2', // Cyan / Teal
  '#4F46E5', // Indigo
  '#D97706', // Amber / Gold
  '#EC4899'  // Pink / Magenta
];

export function JarModal({ isOpen, onClose, jarToEdit = null }) {
  const { createJar, updateJar } = useJarStore();
  const { addToast } = useToastStore();

  const isEditing = Boolean(jarToEdit);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const modalRef = useRef(null);
  const nameInputRef = useRef(null);

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    if (jarToEdit) {
      setName(jarToEdit.name || '');
      setTarget(jarToEdit.target ? Number(jarToEdit.target).toLocaleString('vi-VN') : '');
      setInitialAmount(jarToEdit.current ? Number(jarToEdit.current).toLocaleString('vi-VN') : '');
      setTargetDate(jarToEdit.targetDate ? jarToEdit.targetDate.slice(0, 10) : '');
      setColor(jarToEdit.color || '#3B82F6');
      setErrorMsg('');
    } else {
      setName('');
      setTarget('');
      setInitialAmount('');
      setTargetDate('');
      setColor('#3B82F6');
      setErrorMsg('');
    }

    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, jarToEdit]);

  // Numeric Calculations for Realtime Summary
  const cleanTarget = useMemo(() => {
    return target ? parseInt(String(target).replace(/\D/g, ''), 10) || 0 : 0;
  }, [target]);

  const cleanCurrent = useMemo(() => {
    return initialAmount ? parseInt(String(initialAmount).replace(/\D/g, ''), 10) || 0 : 0;
  }, [initialAmount]);

  const progress = useMemo(() => {
    if (!cleanTarget || cleanTarget <= 0) return 0;
    const ratio = Math.round((cleanCurrent / cleanTarget) * 100);
    return Math.min(100, Math.max(0, ratio));
  }, [cleanCurrent, cleanTarget]);

  const remainingAmount = useMemo(() => {
    return Math.max(0, cleanTarget - cleanCurrent);
  }, [cleanTarget, cleanCurrent]);

  const daysRemainingText = useMemo(() => {
    if (!targetDate) return '-- ngày còn lại';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Đã quá hạn';
    if (diffDays === 0) return 'Hôm nay';
    return `${diffDays} ngày còn lại`;
  }, [targetDate]);

  if (!isOpen) return null;

  // Format currency display as typing
  const handleTargetChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setTarget('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setTarget(num.toLocaleString('vi-VN'));
  };

  const handleInitialAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setInitialAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setInitialAmount(num.toLocaleString('vi-VN'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên hũ tiết kiệm.');
      nameInputRef.current?.focus();
      return;
    }

    if (!cleanTarget || cleanTarget <= 0) {
      setErrorMsg('Mục tiêu tiết kiệm phải lớn hơn 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateJar(jarToEdit.id, {
          name: name.trim(),
          category: jarToEdit.category || 'Mục tiêu chung',
          target: cleanTarget,
          current: cleanCurrent,
          targetDate: targetDate || null,
          icon: jarToEdit.icon || '🫙',
          color: color || '#3B82F6'
        });
        setIsSubmitting(false);
        onClose();
        addToast({
          type: 'success',
          message: `Đã cập nhật thông tin hũ "${name.trim()}".`,
          duration: 4000
        });
      } else {
        await createJar({
          name: name.trim(),
          category: 'Mục tiêu chung',
          target: cleanTarget,
          current: cleanCurrent,
          targetDate: targetDate || null,
          icon: '🫙',
          color: color || '#3B82F6'
        });
        setIsSubmitting(false);
        onClose();
        addToast({
          type: 'success',
          message: `Đã tạo hũ "${name.trim()}" với mục tiêu ${formatCurrency(cleanTarget)}.`,
          duration: 4000
        });
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Lỗi khi lưu thông tin hũ.');
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
        className="txn-modal-card jar-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jar-modal-title"
      >
        {/* Header: Title + Subtitle + Close */}
        <div className="jar-modal-header">
          <div className="jar-modal-title-group">
            <h2 id="jar-modal-title" className="jar-modal-title">
              {isEditing ? 'Chỉnh sửa hũ tiết kiệm' : 'Tạo hũ tiết kiệm mới'}
            </h2>
            <p className="jar-modal-subtitle">
              {isEditing
                ? 'Cập nhật mục tiêu và hành trình tích lũy của bạn 💪'
                : 'Thiết lập mục tiêu và bắt đầu hành trình tích lũy của bạn 💪'}
            </p>
          </div>
          <button
            type="button"
            className="txn-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
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
          <div className="jar-modal-body">
            {/* 1. Tên hũ tiết kiệm */}
            <div className="jar-field-group">
              <label htmlFor="jar-name" className="jar-field-label">
                Tên hũ tiết kiệm
              </label>
              <div className="jar-name-input-wrapper">
                <input
                  id="jar-name"
                  ref={nameInputRef}
                  type="text"
                  className="jar-text-input"
                  placeholder="VD: Mua xe máy, Du lịch Nhật Bản, Quỹ khẩn cấp..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  required
                />
                <span className="jar-char-counter" aria-hidden="true">
                  {name.length}/40
                </span>
              </div>
            </div>

            {/* 2. Hai cột: Mục tiêu mong muốn & Ngày dự kiến hoàn thành */}
            <div className="jar-form-grid-2col">
              {/* Cột trái: Mục tiêu mong muốn */}
              <div className="jar-field-group">
                <label htmlFor="jar-target" className="jar-field-label">
                  Mục tiêu mong muốn
                </label>
                <div className="jar-adornment-input-box">
                  <span className="jar-input-leading-icon" aria-hidden="true">
                    {/* Target 🎯 Icon in Emerald Green */}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                  </span>
                  <input
                    id="jar-target"
                    type="text"
                    inputMode="numeric"
                    className="jar-number-input"
                    placeholder="0"
                    value={target}
                    onChange={handleTargetChange}
                    required
                  />
                  <span className="jar-currency-badge">
                    <span>VND</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Cột phải: Ngày dự kiến hoàn thành */}
              <div className="jar-field-group">
                <label htmlFor="jar-deadline" className="jar-field-label">
                  Ngày dự kiến hoàn thành
                </label>
                <div className="jar-adornment-input-box">
                  <span className="jar-input-leading-icon" aria-hidden="true">
                    {/* Calendar 📅 Icon in Violet */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </span>
                  <input
                    id="jar-deadline"
                    type="date"
                    className="jar-date-input"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 3. Số tiền bạn đã có (tùy chọn) - Chiếm 50% hàng */}
            <div className="jar-form-grid-2col">
              <div className="jar-field-group">
                <label htmlFor="jar-initial" className="jar-field-label">
                  Số tiền bạn đã có (tùy chọn)
                </label>
                <div className="jar-adornment-input-box">
                  <span className="jar-input-leading-icon" aria-hidden="true">
                    {/* Wallet/Card 💳 Icon in Emerald Green */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                  </span>
                  <input
                    id="jar-initial"
                    type="text"
                    inputMode="numeric"
                    className="jar-number-input"
                    placeholder="0"
                    value={initialAmount}
                    onChange={handleInitialAmountChange}
                  />
                  <span className="jar-currency-badge">
                    <span>VND</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  Số tiền hiện có sẽ được cộng vào hũ khi tạo.
                </span>
              </div>
              <div aria-hidden="true" />
            </div>

            {/* 4. Card "Bạn còn cần tiết kiệm" (Realtime Summary) */}
            <div className="jar-summary-card" aria-live="polite">
              <div className="jar-summary-card__header">
                <span className="jar-summary-card__title">Bạn còn cần tiết kiệm</span>
                <span className="jar-summary-card__days-pill">
                  {daysRemainingText}
                </span>
              </div>

              <div className="jar-summary-card__metrics">
                <div className="jar-summary-card__left">
                  <div className="jar-summary-card__coin-badge" aria-hidden="true">
                    $
                  </div>
                  <strong className="jar-summary-card__amount">
                    {remainingAmount.toLocaleString('vi-VN')} VND
                  </strong>
                </div>
                <strong className="jar-summary-card__pct">
                  {progress}%
                </strong>
              </div>

              {/* Progress Bar Track */}
              <div className="jar-summary-card__track" aria-hidden="true">
                <div
                  className="jar-summary-card__fill"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: progress > 0 ? (color || '#4361EE') : '#4361EE'
                  }}
                />
              </div>

              <div className="jar-summary-card__footer">
                <span>Đã đạt {progress}% mục tiêu</span>
                <span>Cần thêm {remainingAmount.toLocaleString('vi-VN')} VND</span>
              </div>
            </div>

            {/* 5. Chọn màu sắc cho hũ */}
            <div className="jar-field-group">
              <label className="jar-field-label">
                Chọn màu sắc cho hũ
              </label>
              <div className="jar-color-presets" role="radiogroup" aria-label="Chọn màu sắc cho hũ">
                {PRESET_COLORS.map((hex) => {
                  const isSelected = color === hex;
                  return (
                    <button
                      key={hex}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`jar-color-circle ${isSelected ? 'is-selected' : ''}`}
                      style={{
                        backgroundColor: hex,
                        color: hex
                      }}
                      onClick={() => setColor(hex)}
                      aria-label={`Màu ${hex}`}
                    >
                      {isSelected && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Tip / Guidance Banner */}
            <div className="jar-tip-banner" role="note">
              <div className="jar-tip-icon-box" aria-hidden="true">
                {/* Lightbulb 💡 Vector Icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </div>
              <div className="jar-tip-content">
                <span className="jar-tip-title">Mẹo nhỏ</span>
                <span className="jar-tip-text">
                  Hãy chọn mục tiêu cụ thể và ngày hoàn thành để duy trì động lực nhé!
                </span>
              </div>
            </div>

            {/* Error Message if any */}
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

          {/* Footer: Hủy & Tạo hũ mới */}
          <div className="jar-modal-footer">
            <button
              type="button"
              className="jar-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="jar-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  {/* Floppy Disk 💾 Icon matching Ảnh 4 */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>{isEditing ? 'Cập nhật hũ' : 'Tạo hũ mới'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useJarStore } from '../../stores/useJarStore';
import { useToastStore } from '../../stores/useToastStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';

const PRESET_ICONS = [
  '🫙', '✈️', '🚗', '🏠', '💻', '🎓', '💍', '🏖️',
  '🎮', '🎁', '🛡️', '👶', '🏍️', '📱', '🏥', '📚'
];

const PRESET_COLORS = [
  '#078A59', // Emerald Mint
  '#2563EB', // Royal Blue
  '#7C3AED', // Vivid Purple
  '#EA580C', // Deep Orange
  '#DC2626', // Crimson Red
  '#0891B2', // Cyan Teal
  '#4F46E5', // Indigo
  '#D97706', // Amber Gold
  '#EC4899', // Pink Rose
  '#475569'  // Slate
];

export function JarModal({ isOpen, onClose, jarToEdit = null }) {
  const { createJar, updateJar } = useJarStore();
  const { addToast } = useToastStore();

  const isEditing = Boolean(jarToEdit);

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [icon, setIcon] = useState('🫙');
  const [color, setColor] = useState('#078A59');
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
      setInitialAmount('');
      setTargetDate(jarToEdit.targetDate ? jarToEdit.targetDate.slice(0, 10) : '');
      setIcon(jarToEdit.icon || '🫙');
      setColor(jarToEdit.color || '#078A59');
      setErrorMsg('');
    } else {
      setName('');
      setTarget('');
      setInitialAmount('');
      setTargetDate('');
      setIcon('🫙');
      setColor('#078A59');
      setErrorMsg('');
    }

    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, jarToEdit]);

  if (!isOpen) return null;

  const handleTargetChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setTarget('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setTarget(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleInitialAmountChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setInitialAmount('');
      return;
    }
    const num = parseInt(rawVal, 10);
    setInitialAmount(num ? num.toLocaleString('vi-VN') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên hũ tiết kiệm.');
      nameInputRef.current?.focus();
      return;
    }

    const cleanTarget = target ? parseInt(String(target).replace(/\D/g, ''), 10) : 0;
    if (!cleanTarget || cleanTarget <= 0) {
      setErrorMsg('Mục tiêu tiết kiệm phải lớn hơn 0.');
      return;
    }

    const cleanInitial = initialAmount ? parseInt(String(initialAmount).replace(/\D/g, ''), 10) : 0;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateJar(jarToEdit.id, {
          name: name.trim(),
          target: cleanTarget,
          targetDate: targetDate || null,
          icon: icon || '🫙',
          color: color || '#078A59'
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
          target: cleanTarget,
          current: cleanInitial,
          targetDate: targetDate || null,
          icon: icon || '🫙',
          color: color || '#078A59'
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
        className="txn-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jar-modal-title"
      >
        {/* Header */}
        <div className="txn-modal-header">
          <h2 id="jar-modal-title" className="txn-modal-title">
            {isEditing ? 'Chỉnh sửa hũ tiết kiệm' : 'Tạo hũ tiết kiệm mới'}
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
            {/* Jar Name */}
            <div className="txn-field-group">
              <label htmlFor="jar-name" className="txn-label">
                <span>Tên hũ tiết kiệm</span>
              </label>
              <input
                id="jar-name"
                ref={nameInputRef}
                type="text"
                className="txn-input"
                placeholder="VD: Mua xe máy, Du lịch Nhật Bản, Quỹ khẩn cấp..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
              />
            </div>

            {/* Target Amount */}
            <div className="txn-field-group">
              <label htmlFor="jar-target" className="txn-label">
                <span>Mục tiêu mong muốn</span>
              </label>
              <div className="txn-amount-box">
                <input
                  id="jar-target"
                  type="text"
                  inputMode="numeric"
                  className="txn-amount-input"
                  placeholder="0"
                  value={target}
                  onChange={handleTargetChange}
                  required
                />
                <span className="txn-amount-suffix">VNĐ</span>
              </div>
            </div>

            {/* Initial Amount (Only when creating) */}
            {!isEditing && (
              <div className="txn-field-group">
                <label htmlFor="jar-initial" className="txn-label">
                  <span>Số tiền ban đầu trong hũ (tùy chọn)</span>
                </label>
                <div className="txn-amount-box">
                  <input
                    id="jar-initial"
                    type="text"
                    inputMode="numeric"
                    className="txn-amount-input"
                    placeholder="0"
                    value={initialAmount}
                    onChange={handleInitialAmountChange}
                  />
                  <span className="txn-amount-suffix">VNĐ</span>
                </div>
              </div>
            )}

            {/* Target Date */}
            <div className="txn-field-group">
              <label htmlFor="jar-deadline" className="txn-label">
                <span>Ngày dự kiến hoàn thành (tùy chọn)</span>
              </label>
              <input
                id="jar-deadline"
                type="date"
                className="txn-input"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            {/* Icon Picker */}
            <div className="txn-field-group">
              <label className="txn-label">
                <span>Biểu tượng hũ</span>
              </label>
              <div className="wallet-icon-presets">
                {PRESET_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`wallet-icon-btn ${icon === emoji ? 'active' : ''}`}
                    onClick={() => setIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette */}
            <div className="txn-field-group">
              <label className="txn-label">
                <span>Màu nhận diện</span>
              </label>
              <div className="wallet-color-presets">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`wallet-color-dot ${color === hex ? 'active' : ''}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => setColor(hex)}
                    aria-label={`Màu ${hex}`}
                  />
                ))}
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
              ) : isEditing ? (
                'Cập nhật hũ'
              ) : (
                'Tạo hũ mới'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

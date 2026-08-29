import React, { useState, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency } from '../../utils/formatters';

export function FinancialTipsModal({ isOpen, onClose, initialTopic = 'smart' }) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen);

  const [topic, setTopic] = useState(initialTopic); // 'smart' | '50-30-20'
  const [customIncome, setCustomIncome] = useState('15000000');

  if (!isOpen) return null;

  const numericIncome = parseInt(String(customIncome).replace(/\D/g, ''), 10) || 0;
  const needs50 = Math.round(numericIncome * 0.5);
  const wants30 = Math.round(numericIncome * 0.3);
  const savings20 = Math.round(numericIncome * 0.2);

  const handleIncomeChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    setCustomIncome(rawVal);
  };

  return (
    <div
      className="modal-backdrop-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="financial-tips-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Kiến thức tài chính"
      >
        {/* Header */}
        <div className="financial-tips-header">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setTopic('smart')}
              className={`financial-tips-tab-btn ${topic === 'smart' ? 'active' : ''}`}
            >
              🎯 Tại sao cần mục tiêu?
            </button>
            <button
              type="button"
              onClick={() => setTopic('50-30-20')}
              className={`financial-tips-tab-btn ${topic === '50-30-20' ? 'active' : ''}`}
            >
              📊 Quy tắc 50/30/20
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="financial-tips-close-btn"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="financial-tips-body">
          {topic === 'smart' ? (
            <>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Biến Ước Mơ Thành Mục Tiêu Tài Chính Cụ Thể
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Khi tiền tiết kiệm không có mục tiêu rõ ràng, nó rất dễ bị chi tiêu vào những khoản mua sắm bốc đồng.
                  Tạo các <strong>Hũ chi tiêu</strong> giúp bạn gán ý nghĩa cho từng đồng tiền bạn kiếm được.
                </p>
              </div>

              {/* SMART Pillars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '13px', marginBottom: '2px' }}>
                    S - Cụ thể (Specific)
                  </strong>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Thay vì "tiết kiệm tiền", hãy đặt tên hũ rõ ràng: "Quỹ khẩn cấp 6 tháng", "Mua xe máy mới", "Du lịch Đà Lạt".
                  </span>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '13px', marginBottom: '2px' }}>
                    M - Đo lường được (Measurable)
                  </strong>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Luôn thiết lập con số mục tiêu chính xác (ví dụ: 15.000.000 đ) để theo dõi tỷ lệ phần trăm dâng lên mỗi ngày.
                  </span>
                </div>

                <div style={{ padding: '12px 14px', background: 'var(--surface-subtle)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--primary)', display: 'block', fontSize: '13px', marginBottom: '2px' }}>
                    T - Có thời hạn (Time-bound)
                  </strong>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Gán ngày đến hạn (Target Date) giúp CaltDHy tính toán chính xác mỗi tháng bạn cần nạp bao nhiêu tiền để về đích đúng hẹn.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Quy Tắc Quản Trị Dòng Tiền 50/30/20
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Đây là phương pháp phân bổ tài chính kinh điển giúp cân bằng giữa cuộc sống hiện tại và mục tiêu tương lai.
                </p>
              </div>

              {/* Interactive Calculator */}
              <div
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Thu nhập ròng hàng tháng của bạn (VND):
                  </label>
                  <input
                    type="text"
                    value={numericIncome ? numericIncome.toLocaleString('vi-VN') : ''}
                    onChange={handleIncomeChange}
                    placeholder="Nhập mức thu nhập..."
                    className="financial-tips-input"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* 50/30/20 Distribution Visual Bar */}
                <div style={{ height: '10px', borderRadius: '99px', display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: '50%', background: '#3B82F6' }} title="50% Thiết yếu" />
                  <div style={{ width: '30%', background: '#F59E0B' }} title="30% Mong muốn" />
                  <div style={{ width: '20%', background: '#10B981' }} title="20% Tiết kiệm" />
                </div>

                {/* 3 Columns Output */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: '#3B82F6', fontWeight: 700, display: 'block' }}>50% Thiết yếu</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(needs50)}
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Nhà cửa, ăn uống, hóa đơn
                    </span>
                  </div>

                  <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 700, display: 'block' }}>30% Mong muốn</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(wants30)}
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Giải trí, mua sắm, ăn ngoài
                    </span>
                  </div>

                  <div style={{ background: 'var(--surface)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700, display: 'block' }}>20% Tích lũy hũ</span>
                    <strong style={{ fontSize: '13.5px', color: '#10B981', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(savings20)}
                    </strong>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Nạp vào các hũ chi tiêu
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="financial-tips-footer">
          <div />
          <button
            type="button"
            onClick={onClose}
            className="financial-tips-ack-btn"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

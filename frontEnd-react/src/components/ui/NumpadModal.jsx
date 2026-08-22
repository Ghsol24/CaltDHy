import React, { useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';

export function NumpadModal() {
  const { isNumpadOpen, closeNumpadModal } = useSpendingStore();
  const { addTransaction } = useTransactionStore();

  const [val, setVal] = useState('');
  const [desc, setDesc] = useState('Nạp nhanh');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isNumpadOpen) return null;

  const handleNumClick = (digit) => {
    if (val.length >= 12) return;
    setVal((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setVal((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setVal('');
  };

  const handleSubmit = async () => {
    const num = Number(val);
    if (!num || num <= 0) return;

    setIsSubmitting(true);
    try {
      await addTransaction({
        type: 'income',
        amount: num,
        category: 'Salary',
        date: new Date().toISOString().split('T')[0],
        desc: desc || 'Nạp nhanh'
      });
      setIsSubmitting(false);
      setVal('');
      closeNumpadModal();
    } catch (_) {
      setIsSubmitting(false);
    }
  };

  const formattedDisplay = val
    ? new Intl.NumberFormat('vi-VN').format(Number(val)) + ' đ'
    : '0 đ';

  return (
    <div
      className="modal-overlay open"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target.className.includes('modal-overlay')) closeNumpadModal();
      }}
    >
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '360px',
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '24px',
          position: 'relative'
        }}
      >
        <div className="screw screw-tl"></div>
        <div className="screw screw-tr"></div>
        <div className="screw screw-bl"></div>
        <div className="screw screw-br"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--txt)', margin: 0 }}>
            💰 NẠP NHANH SỐ DƯ
          </h3>
          <button className="btn-ghost" onClick={closeNumpadModal}>✕</button>
        </div>

        {/* Display */}
        <div
          style={{
            background: 'var(--recessed)',
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'right',
            fontFamily: 'var(--font-mono)',
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--green)',
            marginBottom: '16px',
            border: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          {formattedDisplay}
        </div>

        {/* Numpad Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'].map((btn) => (
            <button
              key={btn}
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (btn === '⌫') handleBackspace();
                else handleNumClick(btn);
              }}
              style={{
                padding: '14px',
                fontSize: '18px',
                fontWeight: '600',
                borderRadius: '8px',
                background: 'var(--recessed)'
              }}
            >
              {btn}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleClear}
            style={{ flex: 1, padding: '10px' }}
          >
            XÓA
          </button>
          <button
            type="button"
            className="btn-cta"
            onClick={handleSubmit}
            disabled={!val || isSubmitting}
            style={{ flex: 2, padding: '10px', background: 'var(--green)' }}
          >
            {isSubmitting ? 'ĐANG NẠP...' : 'XÁC NHẬN NẠP'}
          </button>
        </div>
      </div>
    </div>
  );
}

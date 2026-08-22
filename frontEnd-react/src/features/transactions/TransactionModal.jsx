import React, { useEffect, useState } from 'react';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../utils/categories';

export function TransactionModal() {
  const { isAddTxnOpen, closeAddTxnModal } = useSpendingStore();
  const { addTransaction, updateTransaction, editingTransaction, closeEditTransaction } = useTransactionStore();

  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const isEditing = Boolean(editingTransaction);

  const categories = type === 'expense' ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES;

  // Auto select first category on type change
  useEffect(() => {
    if (!editingTransaction && categories.length > 0) {
      setCategory(categories[0].name);
    }
  }, [type, editingTransaction, categories]);

  useEffect(() => {
    if (!editingTransaction) return;
    setType(editingTransaction.type);
    setAmount(String(editingTransaction.amount));
    setCategory(editingTransaction.category);
    setDate(editingTransaction.date);
    setDesc(editingTransaction.desc || '');
  }, [editingTransaction]);

  if (!isAddTxnOpen && !isEditing) return null;

  const close = () => {
    closeAddTxnModal();
    closeEditTransaction();
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền hợp lệ lớn hơn 0.');
      return;
    }
    if (!category) {
      setErrorMsg('Vui lòng chọn danh mục.');
      return;
    }

    setIsSubmitting(true);
    try {
      const transactionData = {
        type,
        amount: numAmount,
        category,
        date,
        desc
      };
      if (isEditing) await updateTransaction(editingTransaction.id, transactionData);
      else await addTransaction(transactionData);
      setIsSubmitting(false);
      setAmount('');
      setDesc('');
      close();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Lỗi thêm giao dịch.');
    }
  };

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
        if (e.target.className.includes('modal-overlay')) close();
      }}
    >
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '24px',
          position: 'relative',
          boxShadow: 'var(--sh-float)'
        }}
      >
        <div className="screw screw-tl"></div>
        <div className="screw screw-tr"></div>
        <div className="screw screw-bl"></div>
        <div className="screw screw-br"></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--txt)', margin: 0 }}>
            {isEditing ? '✏️ CHỈNH SỬA GIAO DỊCH' : '➕ GHI GIAO DỊCH MỚI'}
          </h2>
          <button
            className="btn-ghost"
            onClick={close}
            style={{ fontSize: '16px', padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Type Switcher */}
          <div style={{ display: 'flex', background: 'var(--recessed)', borderRadius: '8px', padding: '4px' }}>
            <button
              type="button"
              className={`btn-ghost ${type === 'expense' ? 'active' : ''}`}
              onClick={() => setType('expense')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                fontWeight: '600',
                background: type === 'expense' ? 'var(--accent)' : 'transparent',
                color: type === 'expense' ? '#fff' : 'var(--muted)'
              }}
            >
              💸 Chi tiêu
            </button>
            <button
              type="button"
              className={`btn-ghost ${type === 'income' ? 'active' : ''}`}
              onClick={() => setType('income')}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '6px',
                fontWeight: '600',
                background: type === 'income' ? 'var(--green)' : 'transparent',
                color: type === 'income' ? '#fff' : 'var(--muted)'
              }}
            >
              💵 Thu nhập
            </button>
          </div>

          {/* Amount Field */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              SỐ TIỀN (VNĐ)
            </label>
            <input
              type="number"
              className="finput"
              placeholder="VD: 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 14px', fontSize: '16px', fontWeight: '600' }}
            />
          </div>

          {/* Category Selection Grid */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
              DANH MỤC
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
              {categories.map((cat) => (
                <button
                  type="button"
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: category === cat.name ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                    background: category === cat.name ? 'rgba(255,75,114,0.15)' : 'var(--recessed)',
                    color: 'var(--txt)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              NGÀY GIAO DỊCH
            </label>
            <input
              type="date"
              className="finput"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 14px' }}
            />
          </div>

          {/* Note / Description */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
              GHI CHÚ / DIỄN GIẢI
            </label>
            <input
              type="text"
              className="finput"
              placeholder="VD: Cà phê với đồng nghiệp"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{ width: '100%', padding: '10px 14px' }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--accent)', fontSize: '13px', textAlign: 'center' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            className="btn-cta"
            disabled={isSubmitting}
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
          >
            {isSubmitting ? 'ĐANG LƯU...' : isEditing ? 'CẬP NHẬT GIAO DỊCH' : 'LƯU GIAO DỊCH'}
          </button>
        </form>
      </div>
    </div>
  );
}

import React from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { getCategoryIcon } from '../../utils/categories';

export function TransactionList() {
  const { transactions, filters, deleteTransaction, openEditTransaction, isLoading } = useTransactionStore();
  const { confirm } = useConfirmStore();

  // Apply filters
  const filtered = transactions.filter((t) => {
    if (filters.type !== 'all' && t.type !== filters.type) return false;
    if (filters.category !== 'all' && t.category !== filters.category) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchDesc = (t.desc || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCat) return false;
    }
    return true;
  });

  // Group by date
  const grouped = filtered.reduce((acc, txn) => {
    const d = txn.date || 'Không xác định';
    if (!acc[d]) acc[d] = [];
    acc[d].push(txn);
    return acc;
  }, {});

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleDelete = (id, desc) => {
    confirm({
      title: 'Xóa giao dịch',
      message: `Bạn có chắc chắn muốn xóa giao dịch "${desc || 'này'}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa giao dịch',
      cancelText: 'Hủy',
      confirmVariant: 'danger',
      onConfirm: () => {
        deleteTransaction(id);
      },
    });
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
        <span className="spinner" style={{ display: 'inline-block', marginBottom: '8px' }}></span>
        <p>Đang tải dữ liệu giao dịch...</p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div
        className="chassis-frame"
        style={{ padding: '32px', textAlign: 'center', marginTop: '12px' }}
      >
        <div className="chassis-frame__screw cf-screw--tl"></div>
        <div className="chassis-frame__screw cf-screw--tr"></div>
        <div className="chassis-frame__screw cf-screw--bl"></div>
        <div className="chassis-frame__screw cf-screw--br"></div>
        <div className="chassis-frame__inner">
          <p style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '13px', margin: 0 }}>
            // CHƯA CÓ GIAO DỊCH NÀO TRONG HỆ THỐNG
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Object.entries(grouped).map(([dateStr, items]) => (
        <div key={dateStr} className="date-group">
          {/* Group Header */}
          <div
            className="date-group-header"
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--muted)',
              marginBottom: '8px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}
          >
            🗓️ {dateStr}
          </div>

          {/* Transaction Cards */}
          <div className="txn-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((txn) => {
              const icon = getCategoryIcon(txn.category, txn.type);
              const isIncome = txn.type === 'income';

              return (
                <div
                  key={txn.id}
                  className="chassis-frame"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 'auto'
                  }}
                >
                  <div className="chassis-frame__screw cf-screw--tl"></div>
                  <div className="chassis-frame__screw cf-screw--tr"></div>
                  <div className="chassis-frame__screw cf-screw--bl"></div>
                  <div className="chassis-frame__screw cf-screw--br"></div>

                  {/* Left: Icon & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: isIncome ? 'rgba(16,185,129,0.1)' : 'rgba(255,71,87,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}
                    >
                      {icon}
                    </div>

                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--txt)' }}>
                        {txn.category}
                      </div>
                      {txn.desc && (
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          {txn.desc}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount & actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        fontWeight: '700',
                        fontSize: '15px',
                        fontFamily: 'var(--font-mono)',
                        color: isIncome ? 'var(--green)' : 'var(--accent)'
                      }}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(txn.amount)}
                    </div>

                    <button
                      className="btn-ghost"
                      onClick={() => openEditTransaction(txn)}
                      title="Chỉnh sửa giao dịch"
                      style={{ padding: '4px 8px', fontSize: '14px', color: 'var(--muted)', opacity: 0.7 }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => handleDelete(txn.id, txn.desc || txn.category)}
                      title="Xóa giao dịch"
                      style={{
                        padding: '4px 8px',
                        fontSize: '14px',
                        color: 'var(--muted)',
                        opacity: 0.7
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import { useTransactionStore } from '../../stores/useTransactionStore';

export function TransactionFilter() {
  const { filters, setFilter, resetFilters } = useTransactionStore();

  return (
    <div className="filter-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
      {/* Search Input */}
      <div className="iw" style={{ flex: 1, minWidth: '200px' }}>
        <input
          type="text"
          className="finput"
          placeholder="Tìm kiếm giao dịch (ghi chú, danh mục...)"
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          style={{ padding: '8px 12px', fontSize: '13px' }}
        />
      </div>

      {/* Type Filter Buttons */}
      <div className="segmented-control" style={{ display: 'flex', background: 'var(--recessed)', borderRadius: '6px', padding: '2px' }}>
        <button
          className={`btn-ghost ${filters.type === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('type', 'all')}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }}
        >
          Tất cả
        </button>
        <button
          className={`btn-ghost ${filters.type === 'expense' ? 'active' : ''}`}
          onClick={() => setFilter('type', 'expense')}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', color: filters.type === 'expense' ? 'var(--accent)' : 'inherit' }}
        >
          Chi tiêu
        </button>
        <button
          className={`btn-ghost ${filters.type === 'income' ? 'active' : ''}`}
          onClick={() => setFilter('type', 'income')}
          style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', color: filters.type === 'income' ? 'var(--green)' : 'inherit' }}
        >
          Thu nhập
        </button>
      </div>

      {/* Reset Filter Button */}
      {(filters.search || filters.type !== 'all' || filters.category !== 'all') && (
        <button
          className="btn-ghost"
          onClick={resetFilters}
          style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--muted)' }}
        >
          ✕ Xóa lọc
        </button>
      )}
    </div>
  );
}

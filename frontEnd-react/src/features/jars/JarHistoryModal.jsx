import React, { useState, useMemo, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatCurrency, formatDate } from '../../utils/formatters';

export function JarHistoryModal({ isOpen, onClose, jars = [] }) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen);

  const [filterType, setFilterType] = useState('all'); // 'all' | 'deposit' | 'withdraw'
  const [selectedJarId, setSelectedJarId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Aggregate all transactions from all jars
  const allActivities = useMemo(() => {
    const list = [];
    jars.forEach((jar) => {
      const history = Array.isArray(jar.history) ? jar.history : [];
      history.forEach((h) => {
        list.push({
          ...h,
          jarId: jar.id,
          jarName: jar.name,
          jarColor: jar.color || '#5356F1',
          jarIcon: jar.icon || '🫙',
          jarCategory: jar.category || 'Mục tiêu chung'
        });
      });
    });
    return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [jars]);

  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (selectedJarId !== 'all' && item.jarId !== selectedJarId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const reasonMatch = (item.reason || '').toLowerCase().includes(query);
        const nameMatch = (item.jarName || '').toLowerCase().includes(query);
        return reasonMatch || nameMatch;
      }
      return true;
    });
  }, [allActivities, filterType, selectedJarId, searchQuery]);

  const totalDeposited = useMemo(() => {
    return filteredActivities
      .filter((a) => a.type === 'deposit')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [filteredActivities]);

  const totalWithdrawn = useMemo(() => {
    return filteredActivities
      .filter((a) => a.type === 'withdraw')
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [filteredActivities]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="jar-history-modal-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Toàn bộ lịch sử hoạt động hũ chi tiêu"
      >
        {/* Header */}
        <div className="jar-history-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📜</span>
            <h3 className="jar-history-title">
              Lịch sử hoạt động hũ chi tiêu
            </h3>
          </div>
          <button
            type="button"
            className="jar-history-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)' }}>
          {/* Summary Row */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: '11px', color: '#059669', display: 'block', fontWeight: 600 }}>Tổng tiền nạp</span>
              <strong style={{ fontSize: '15px', color: '#059669', fontFamily: 'var(--font-mono)' }}>
                +{formatCurrency(totalDeposited)}
              </strong>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <span style={{ fontSize: '11px', color: '#DC2626', display: 'block', fontWeight: 600 }}>Tổng tiền rút</span>
              <strong style={{ fontSize: '15px', color: '#DC2626', fontFamily: 'var(--font-mono)' }}>
                −{formatCurrency(totalWithdrawn)}
              </strong>
            </div>
          </div>

          {/* Filter Controls Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Type buttons */}
            <div className="jar-history-tab-group">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'deposit', label: '+ Nạp tiền' },
                { id: 'withdraw', label: '− Rút tiền' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setFilterType(btn.id)}
                  className={`jar-history-tab-btn ${filterType === btn.id ? 'active' : ''}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Jar select */}
            <select
              value={selectedJarId}
              onChange={(e) => setSelectedJarId(e.target.value)}
              className="jar-history-select"
            >
              <option value="all">Tất cả các hũ</option>
              {jars.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search input */}
          <input
            type="text"
            placeholder="Tìm theo lý do hoặc tên hũ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="jar-history-search-input"
          />
        </div>

        {/* Transaction list */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--surface)' }}>
          {filteredActivities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Không có giao dịch nào khớp với bộ lọc.
            </div>
          ) : (
            filteredActivities.map((act, index) => {
              const isDeposit = act.type === 'deposit';
              return (
                <div
                  key={act.id || index}
                  className="jar-history-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 800,
                        background: isDeposit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isDeposit ? '#10B981' : '#EF4444'
                      }}
                    >
                      {isDeposit ? '+' : '−'}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {isDeposit ? 'Nạp vào' : 'Rút từ'} <strong>"{act.jarName}"</strong>
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--surface-subtle)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {act.jarCategory}
                        </span>
                      </div>
                      {act.reason && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {act.reason}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {act.date ? formatDate(act.date, 'full') : '--'}
                      </span>
                    </div>
                  </div>

                  <strong
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: isDeposit ? '#10B981' : '#EF4444'
                    }}
                  >
                    {isDeposit ? '+' : '−'}{formatCurrency(act.amount)}
                  </strong>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="jar-history-footer">
          <div />
          <button
            type="button"
            onClick={onClose}
            className="jar-detail-btn-deposit"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

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
        style={{
          background: '#FFFFFF',
          borderRadius: '18px',
          boxShadow: '0 20px 48px rgba(15, 23, 42, 0.16)',
          width: '94vw',
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #E2E8F0'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAFBFD'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📜</span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
              Lịch sử hoạt động hũ chi tiêu
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF' }}>
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
            <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'deposit', label: '+ Nạp tiền' },
                { id: 'withdraw', label: '− Rút tiền' }
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setFilterType(btn.id)}
                  style={{
                    border: 'none',
                    background: filterType === btn.id ? '#FFFFFF' : 'transparent',
                    color: filterType === btn.id ? '#5356F1' : '#64748B',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: filterType === btn.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Jar select */}
            <select
              value={selectedJarId}
              onChange={(e) => setSelectedJarId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                color: '#334155',
                background: '#FFFFFF',
                outline: 'none'
              }}
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
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              fontSize: '12.5px',
              background: '#F8FAFC',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Transaction list */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredActivities.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              Không có giao dịch nào khớp với bộ lọc.
            </div>
          ) : (
            filteredActivities.map((act, index) => {
              const isDeposit = act.type === 'deposit';
              return (
                <div
                  key={act.id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px'
                  }}
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
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                          {isDeposit ? 'Nạp vào' : 'Rút từ'} <strong>"{act.jarName}"</strong>
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#F1F5F9',
                            color: '#64748B'
                          }}
                        >
                          {act.jarCategory}
                        </span>
                      </div>
                      {act.reason && (
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                          {act.reason}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
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
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', background: '#FAFBFD' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#5356F1',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

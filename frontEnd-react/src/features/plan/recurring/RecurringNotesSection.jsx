import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';

export function RecurringNotesSection({ note, setNote }) {
  return (
    <div className="recurring-form-section">
      <div className="recurring-section-header">
        <Icon name="fileText" className="section-header-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        <span className="section-header-title">Thông tin bổ sung</span>
      </div>
    
      <div className="recurring-section-content">
        <div className="txn-field-group">
          <label htmlFor="rec-note" className="txn-label">
            <span>Ghi chú gói cước / Hợp đồng (Tùy chọn)</span>
          </label>
          <input
            id="rec-note"
            type="text"
            className="txn-input modal-themed-input"
            placeholder="VD: Gói Family 6 người, Trả góp kỳ 3/12, HĐ 24 tháng..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />
        </div>
      </div>
    </div>
  );
}

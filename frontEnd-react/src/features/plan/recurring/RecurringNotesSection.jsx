import React, { useEffect, useState } from 'react';
import { Icon } from '../../../components/ui/AppIcons';

/**
 * Ghi chú là phần tùy chọn nên gập mặc định (FORM-10); tự mở khi đã có ghi chú.
 * Ngày kết thúc đã nằm ở "Có kỳ hạn" trong phần lịch thanh toán nên không lặp lại ở đây.
 */
export function RecurringNotesSection({ note, setNote }) {
  const [open, setOpen] = useState(Boolean(note));
  // Ghi chú có sẵn (sửa một khoản đã có ghi chú, hoặc gợi ý nhà cung cấp tự điền) thì không giấu đi.
  useEffect(() => { if (note) setOpen(true); }, [note]);
  return (
    <div className="recurring-form-section">
      <button
        type="button"
        className="recurring-section-header recurring-notes-toggle"
        aria-expanded={open}
        aria-controls="rec-notes-content"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="fileText" className="section-header-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
        <span className="section-header-title">{open ? 'Thông tin bổ sung' : 'Thêm ghi chú'}</span>
        <span className="recurring-notes-chevron" aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>

      {open && (
        <div id="rec-notes-content" className="recurring-section-content">
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
      )}
    </div>
  );
}

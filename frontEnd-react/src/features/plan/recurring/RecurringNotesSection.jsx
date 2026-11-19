import React, { useEffect, useState } from 'react';
import { FormField } from '../../../components/ui/FormField';

/**
 * Ghi chú là phần tùy chọn nên gập mặc định (FORM-10); tự mở khi đã có ghi chú.
 * Ngày kết thúc đã nằm ở "Có kỳ hạn" trong phần lịch thanh toán nên không lặp lại ở đây.
 */
export function RecurringNotesSection({ note, setNote }) {
  const [open, setOpen] = useState(Boolean(note));
  // Ghi chú có sẵn (sửa một khoản đã có ghi chú, hoặc gợi ý nhà cung cấp tự điền) thì không giấu đi.
  useEffect(() => { if (note) setOpen(true); }, [note]);
  return (
    <>
      <button
        type="button"
        className="recurring-notes-toggle"
        aria-expanded={open}
        aria-controls="rec-notes-content"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{open ? 'Thông tin bổ sung' : 'Thêm ghi chú'}</span>
        <span className="recurring-notes-chevron" aria-hidden="true">{open ? '⌄' : '›'}</span>
      </button>

      {open && (
        <FormField id="rec-notes-content" label="Ghi chú gói cước / Hợp đồng" htmlFor="rec-note" optional>
          <input
            id="rec-note"
            type="text"
            className="txn-input modal-themed-input"
            placeholder="VD: Gói Family 6 người, Trả góp kỳ 3/12, HĐ 24 tháng..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />
        </FormField>
      )}
    </>
  );
}

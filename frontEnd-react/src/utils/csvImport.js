// Đọc file CSV (sao kê ngân hàng, bảng tính) thành các dòng giao dịch thu/chi để gửi tới
// POST /api/spending/import. Mọi thứ chạy trên trình duyệt; server kiểm tra lại từng dòng.

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_FILE_BYTES = 1024 * 1024;

const normalizeHeader = (value) => String(value || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/** Tách CSV thành mảng dòng, mỗi dòng là mảng ô. Tự nhận dấu phân cách , ; hoặc tab. */
export function parseCsv(text) {
  const source = String(text || '').replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', '\t', ','].reduce((best, candidate) => (
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best), ',');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += char;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some((value) => value !== ''));
}

/**
 * Số tiền VND nguyên dương kèm dấu, hoặc null nếu không đọc chắc chắn được.
 * Nhận "1.234.567", "1,234,567", "1.234.567,00", "-50000", "(50.000)", "50.000 ₫".
 * Từ chối phần lẻ khác 0 và các dạng viết tắt như "50k" thay vì đoán.
 */
export function parseVndAmount(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) { negative = true; value = value.slice(1, -1); }
  value = value.replace(/vn[dđ]|₫|đ/gi, '').replace(/[\s ]/g, '');
  if (/^[+-]/.test(value)) { negative = negative || value[0] === '-'; value = value.slice(1); }
  else if (/-$/.test(value)) { negative = true; value = value.slice(0, -1); }
  if (!/^\d[\d.,]*$/.test(value)) return null;

  const separators = value.replace(/\d/g, '');
  let integerPart = value;
  let fraction = '';
  const splitAt = (index) => { integerPart = value.slice(0, index); fraction = value.slice(index + 1); };
  if (separators.includes('.') && separators.includes(',')) {
    splitAt(Math.max(value.lastIndexOf('.'), value.lastIndexOf(',')));
  } else if (separators.length === 1) {
    const index = value.search(/[.,]/);
    // "1.234" là một nghìn hai trăm ba mươi tư; "1.5" hay "12,50" là phần lẻ.
    if (value.length - index - 1 !== 3) splitAt(index);
  }
  if (fraction && !/^0+$/.test(fraction)) return null;
  const groups = integerPart.split(/[.,]/);
  if (groups.length > 1 && (groups[0].length > 3 || groups.slice(1).some((group) => group.length !== 3))) return null;
  const amount = Number(groups.join(''));
  if (!Number.isSafeInteger(amount) || amount === 0) return null;
  return negative ? -amount : amount;
}

/** 'YYYY-MM-DD' từ "2026-09-21", "21/09/2026", "21-9-26", có thể kèm giờ. Luôn hiểu ngày trước tháng. */
export function parseCsvDate(raw) {
  const value = String(raw ?? '').trim().split(/[\sT]/)[0];
  let year; let month; let day;
  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/);
    if (!match) return null;
    [, day, month, year] = match;
    if (year.length === 2) year = `20${year}`;
  }
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

const COLUMN_HINTS = {
  date: ['ngay giao dich', 'ngay', 'date', 'transaction date', 'thoi gian', '日期', '交易日期'],
  desc: ['mo ta', 'dien giai', 'noi dung', 'description', 'desc', 'details', 'memo', 'ghi chu', 'note', '摘要', '描述', '备注'],
  category: ['danh muc', 'category', 'phan loai', '分类'],
  debit: ['ghi no', 'no', 'debit', 'chi', 'so tien chi', 'rut', 'withdrawal', 'money out', '支出'],
  credit: ['ghi co', 'co', 'credit', 'thu', 'so tien thu', 'nop', 'deposit', 'money in', '收入'],
  amount: ['so tien', 'amount', 'gia tri', 'value', '金额'],
};

/** Đoán cột nào là gì từ dòng tiêu đề. Giá trị -1 nghĩa là chưa tìm thấy. */
export function guessColumns(headers) {
  const names = headers.map(normalizeHeader);
  const taken = new Set();
  const find = (hints) => {
    for (const exact of [true, false]) {
      for (const hint of hints) {
        const index = names.findIndex((name, i) => !taken.has(i) && (exact ? name === hint : name.includes(hint)));
        if (index !== -1) { taken.add(index); return index; }
      }
    }
    return -1;
  };
  const mapping = { date: find(COLUMN_HINTS.date), desc: find(COLUMN_HINTS.desc), category: find(COLUMN_HINTS.category) };
  mapping.debit = find(COLUMN_HINTS.debit);
  mapping.credit = find(COLUMN_HINTS.credit);
  mapping.amount = find(COLUMN_HINTS.amount);
  // Một cột số tiền có dấu là đủ; chỉ dùng cặp ghi nợ / ghi có khi có cả hai.
  if (mapping.debit === -1 || mapping.credit === -1) {
    if (mapping.amount === -1) mapping.amount = mapping.debit !== -1 ? mapping.debit : mapping.credit;
    mapping.debit = -1; mapping.credit = -1;
  } else mapping.amount = -1;
  return mapping;
}

/**
 * Ghép dòng CSV với ánh xạ cột thành giao dịch.
 * `signMeaning` áp dụng cho một cột số tiền: 'negativeIsExpense' (mặc định, số âm là chi, số dương
 * là thu), 'allExpense' hoặc 'allIncome'. Trả về các dòng hợp lệ và danh sách lỗi theo số dòng trong file.
 */
export function buildImportRows(dataRows, mapping, {
  signMeaning = 'negativeIsExpense', expenseCategory = 'Other Expense', incomeCategory = 'Other Income',
  today, firstLine = 2,
} = {}) {
  const valid = [];
  const errors = [];
  const cellAt = (cells, index) => (index >= 0 ? (cells[index] ?? '') : '');
  dataRows.forEach((cells, offset) => {
    const line = firstLine + offset;
    const date = parseCsvDate(cellAt(cells, mapping.date));
    if (!date) { errors.push({ line, reason: 'date' }); return; }
    if (today && date > today) { errors.push({ line, reason: 'future' }); return; }

    let type; let amount;
    if (mapping.debit >= 0 && mapping.credit >= 0) {
      const debitRaw = cellAt(cells, mapping.debit); const creditRaw = cellAt(cells, mapping.credit);
      const debit = debitRaw && !/^0+([.,]0+)?$/.test(debitRaw) ? parseVndAmount(debitRaw) : 0;
      const credit = creditRaw && !/^0+([.,]0+)?$/.test(creditRaw) ? parseVndAmount(creditRaw) : 0;
      if (debit === null || credit === null || (debit && credit) || (!debit && !credit)) { errors.push({ line, reason: 'amount' }); return; }
      type = debit ? 'expense' : 'income';
      amount = Math.abs(debit || credit);
    } else {
      const signed = parseVndAmount(cellAt(cells, mapping.amount));
      if (signed === null) { errors.push({ line, reason: 'amount' }); return; }
      type = signMeaning === 'allIncome' ? 'income' : signMeaning === 'allExpense' ? 'expense' : signed < 0 ? 'expense' : 'income';
      amount = Math.abs(signed);
    }
    const category = cellAt(cells, mapping.category).slice(0, 50) || (type === 'income' ? incomeCategory : expenseCategory);
    valid.push({ line, date, type, amount, category, desc: cellAt(cells, mapping.desc).slice(0, 200) });
  });
  return { valid, errors };
}

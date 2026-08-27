/**
 * CaltDHy v2 — Formatters
 * Cung cấp các hàm format tiền tệ, ngày tháng, phần trăm chuẩn tiếng Việt (vi-VN).
 */

/**
 * Format số tiền sang định dạng tiền tệ vi-VN không có số lẻ (vd: 2.670.000 đ).
 * @param {number|string} val - Giá trị số tiền
 * @param {Object} [options]
 * @param {boolean} [options.showSign=false] - Có hiển thị dấu +/- không
 * @param {boolean} [options.isIncome=false] - Là thu nhập (true) hay chi tiêu (false)
 * @returns {string} Chuỗi tiền tệ đã format
 */
export function formatCurrency(val, { showSign = false, isIncome = false } = {}) {
  const num = Number(val);
  if (isNaN(num)) {
    return '0 đ';
  }

  const absNum = Math.abs(Math.round(num));
  const formattedAbs = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(absNum) + ' đ';

  if (!showSign) {
    if (num < 0) {
      return `−${formattedAbs}`;
    }
    return formattedAbs;
  }

  // showSign === true
  if (num === 0) {
    return formattedAbs;
  }

  if (num < 0 || (!isIncome && num > 0)) {
    return `−${formattedAbs}`;
  }

  return `+${formattedAbs}`;
}

const VI_WEEKDAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo Giờ Địa Phương (Local Time) của người dùng.
 * Tránh hoàn toàn lỗi lệch ngày do toISOString() chuyển sang UTC.
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} Chuỗi định dạng 'YYYY-MM-DD'
 */
export function getLocalDateString(d = new Date()) {
  const dateObj = d instanceof Date ? d : parseDate(d) || new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Lấy chuỗi tháng YYYY-MM theo Giờ Địa Phương (Local Time) của người dùng.
 * Tránh lỗi đầu tháng bị thụt lùi về tháng cũ do UTC.
 * @param {Date|string|number} [d=new Date()]
 * @returns {string} Chuỗi định dạng 'YYYY-MM'
 */
export function getLocalMonthString(d = new Date()) {
  const dateObj = d instanceof Date ? d : parseDate(d) || new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse input date to Date object theo đúng giờ địa phương nếu chuỗi là YYYY-MM-DD.
 * @param {Date|string|number} dateInput
 * @returns {Date|null}
 */
export function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    return dateInput;
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-').map(Number);
    const localD = new Date(y, m - 1, d);
    return isNaN(localD.getTime()) ? null : localD;
  }
  const parsed = new Date(dateInput);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format ngày tháng theo các kiểu chuẩn CaltDHy v2:
 * - 'full': Thứ Hai, 24 tháng 8, 2026
 * - 'short': 24 thg 8, 2026
 * - 'compact': 24/08/2026
 * - 'month': Tháng 8, 2026
 *
 * @param {Date|string|number} date - Đối tượng Date hoặc chuỗi ngày
 * @param {'full'|'short'|'compact'|'month'} [format='full'] - Kiểu format
 * @returns {string}
 */
export function formatDate(date, format = 'full') {
  const d = parseDate(date);
  if (!d) return '';

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const weekday = VI_WEEKDAYS[d.getDay()];

  switch (format) {
    case 'full':
      return `${weekday}, ${day} tháng ${month}, ${year}`;
    case 'short':
      return `${day} thg ${month}, ${year}`;
    case 'compact': {
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `${dd}/${mm}/${year}`;
    }
    case 'month':
      return `Tháng ${month}, ${year}`;
    default:
      return `${day} thg ${month}, ${year}`;
  }
}

/**
 * Format ngày tương đối: 'Hôm nay', 'Hôm qua' hoặc format short.
 * @param {Date|string|number} dateStr
 * @returns {string}
 */
export function formatRelativeDate(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hôm nay';
  }
  if (diffDays === 1) {
    return 'Hôm qua';
  }

  return formatDate(d, 'short');
}

/**
 * Format phần trăm làm tròn (vd: 75%).
 * @param {number|string} val
 * @returns {string}
 */
export function formatPercent(val) {
  const num = Number(val);
  if (isNaN(num)) return '0%';
  return `${Math.round(num)}%`;
}

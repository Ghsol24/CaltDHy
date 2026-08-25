import React from 'react';
import { formatCurrency } from '../../utils/formatters';

/**
 * MoneyAmount Primitive Component
 * Hiển thị số tiền chuẩn hóa phong cách CaltDHy v2 với hỗ trợ color indicator và typography scale.
 *
 * @param {Object} props
 * @param {number|string} props.amount - Giá trị số tiền
 * @param {'income'|'expense'|'neutral'} [props.type='neutral'] - Loại giao dịch/dòng tiền
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|'hero'} [props.size='md'] - Kích thước chữ
 * @param {boolean} [props.showSign=false] - Hiển thị dấu +/- trước số tiền
 * @param {string} [props.className='']
 */
export function MoneyAmount({
  amount,
  type = 'neutral',
  size = 'md',
  showSign = false,
  className = '',
}) {
  const isIncome = type === 'income';
  const formatted = formatCurrency(amount, {
    showSign,
    isIncome,
  });

  return (
    <span
      className={`money-amount money-amount--${type} money-amount--${size} ${className}`}
    >
      {formatted}
    </span>
  );
}

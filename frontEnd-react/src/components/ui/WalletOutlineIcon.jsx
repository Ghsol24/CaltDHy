import React from 'react';

/**
 * Helper: Render Outline/Line SVG icon based on wallet type.
 * Chuẩn 100% SVG Pure Outline / Stroke Only (fill="none", stroke="currentColor").
 * Tuyệt đối không dùng emoji, không dùng filled icon nhiều màu mè.
 *
 * @param {Object} props
 * @param {'cash'|'bank'|'credit'|'e-wallet'|string} [props.type='cash'] - Loại ví
 * @param {number} [props.size=20] - Kích thước pixel icon
 * @param {string} [props.color='currentColor'] - Màu stroke
 * @param {string} [props.className=''] - Class name CSS bổ sung
 */
export function WalletOutlineIcon({ type, size = 20, color = 'currentColor', className = '' }) {
  if (type === 'bank') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="6" y1="18" x2="6" y2="11" />
        <line x1="10" y1="18" x2="10" y2="11" />
        <line x1="14" y1="18" x2="14" y2="11" />
        <line x1="18" y1="18" x2="18" y2="11" />
        <polygon points="12 2 20 7 4 7" />
      </svg>
    );
  }

  if (type === 'credit') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    );
  }

  if (type === 'e-wallet') {
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    );
  }

  // default / cash
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

export default WalletOutlineIcon;

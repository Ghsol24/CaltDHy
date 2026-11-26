import React from 'react';

// Logo CaltDHy: chuột trong ví, màu cố định ở mọi theme. Đây là bản "small" (16–32px):
// nét dày hơn, bỏ mũi cho khỏi nhoè. Bản đầy đủ nằm ở public/brand/caltdhy-logo-full.svg.
// Không có gradient/id nên vẽ nhiều lần trên cùng trang (Sidebar + Topbar) vẫn an toàn.
// `data-brand-mark` (truyền qua props) là đích bay của màn loading đăng nhập.
export function BrandMark({ className = 'tb-logo-icon', ...rest }) {
  return (
    <span className={className} {...rest}>
      <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">
        <rect width="512" height="512" rx="116" fill="#105440" />
        <g transform="translate(256 256) scale(1.08) translate(-256 -256)" stroke="#10281C"
          strokeWidth="18.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M104 226V214Q104 192 128 192H350Q373 192 373 215V244H104Z" fill="#0B3D2E" />
          <path d="M151.5 242Q154.5 198 165.5 171.5A48 48 0 1 1 213.3 127.8Q250.5 113.5 287.7 127.8A48 48 0 1 1 335.5 171.5Q346.5 198 349.5 242Z"
            fill="#F5F1E3" />
          <circle cx="211.5" cy="193" r="14.5" fill="#10281C" stroke="none" />
          <circle cx="289.5" cy="193" r="14.5" fill="#10281C" stroke="none" />
          <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z"
            fill="#54B48C" />
          <path d="M337 298H396Q410 298 410 312V364Q410 378 396 378H337A40 40 0 0 1 337 298Z" fill="#358867" />
          <circle cx="337" cy="338" r="27.5" fill="#F5BA3E" stroke="none" />
        </g>
      </svg>
    </span>
  );
}

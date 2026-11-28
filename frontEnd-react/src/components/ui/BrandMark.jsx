import React, { useId } from 'react';

// Logo CaltDHy: chuột trong ví, màu cố định ở mọi theme.
// - variant="small" (mặc định, 16–36px): nét dày hơn, bỏ mũi để luôn sắc nét ở cỡ nhỏ.
// - variant="full" (44px+): chi tiết đầy đủ (gradient nền, mũi chuột, bóng cài ví, viền sáng đồng xu).
// `data-brand-mark` (truyền qua props) là đích bay của màn loading đăng nhập.
export function BrandMark({ className = 'tb-logo-icon', variant = 'small', ...rest }) {
  const uid = useId();

  if (variant === 'full') {
    const bgId = `caltdhy-bg-${uid}`;
    const clipId = `caltdhy-clip-${uid}`;
    return (
      <span className={className} {...rest}>
        <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={bgId} x1="64" y1="24" x2="448" y2="496" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#135E47" />
              <stop offset="100%" stopColor="#0E4D3A" />
            </linearGradient>
            <clipPath id={clipId}>
              <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z" />
            </clipPath>
          </defs>
          <rect width="512" height="512" rx="116" fill={`url(#${bgId})`} />
          <path d="M104 226V214Q104 192 128 192H350Q373 192 373 215V244H104Z" fill="#0B3D2E" stroke="#10281C" strokeWidth="10.5" strokeLinejoin="round" />
          <path d="M151.5 242Q154.5 198 165.5 171.5A48 48 0 1 1 213.3 127.8Q250.5 113.5 287.7 127.8A48 48 0 1 1 335.5 171.5Q346.5 198 349.5 242Z" fill="#F5F1E3" stroke="#10281C" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="211.5" cy="189" r="9.4" fill="#10281C" />
          <circle cx="289.5" cy="189" r="9.4" fill="#10281C" />
          <path d="M239 204.5Q250.5 200.5 262 204.5Q263.4 207 259.2 212.8Q253.8 219 250.5 219Q247.2 219 241.8 212.8Q237.6 207 239 204.5Z" fill="#10281C" />
          <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z" fill="#54B48C" />
          <g clipPath={`url(#${clipId})`}>
            <path d="M337 314H404V388H337A37 37 0 0 1 337 314Z" fill="#2F7F60" fillOpacity="0.42" />
          </g>
          <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z" fill="none" stroke="#10281C" strokeWidth="10.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M337 302H396Q408 302 408 314V362Q408 374 396 374H337A36 36 0 0 1 337 302Z" fill="#398F6C" stroke="#10281C" strokeWidth="10.5" strokeLinejoin="round" />
          <circle cx="337" cy="338" r="23" fill="#F0B43B" />
          <circle cx="337" cy="338" r="16" stroke="#FCE394" strokeWidth="2.5" strokeOpacity="0.8" />
        </svg>
      </span>
    );
  }

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

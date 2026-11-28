import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

// Màn hình tải có nhận diện thương hiệu CaltDHy (dùng lại đúng CSS của public/theme-bootstrap.css
// để quá trình chuyển từ cold-start HTML sang kiểm tra phiên không bị giật bố cục).
export function BrandLoadingState({ label }) {
  const { t } = useTranslation();
  const statusText = label || t('common.loadingData');

  return (
    <div className="calt-boot-splash" role="status" aria-live="polite">
      <div className="calt-boot-stage" aria-hidden="true">
        <span className="calt-boot-wave" />
        <span className="calt-boot-wave calt-boot-wave--2" />
        <span className="calt-boot-core">
          <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">
            <rect width="512" height="512" rx="116" fill="#105440" />
            <g transform="translate(256 256) scale(1.06) translate(-256 -256)" stroke="#10281C" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
              <path d="M104 226V214Q104 192 128 192H350Q373 192 373 215V244H104Z" fill="#0B3D2E" />
              <path d="M151.5 242Q154.5 198 165.5 171.5A48 48 0 1 1 213.3 127.8Q250.5 113.5 287.7 127.8A48 48 0 1 1 335.5 171.5Q346.5 198 349.5 242Z" fill="#F5F1E3" />
              <circle cx="211.5" cy="189" r="11" fill="#10281C" stroke="none" />
              <circle cx="289.5" cy="189" r="11" fill="#10281C" stroke="none" />
              <path d="M239 204.5Q250.5 200.5 262 204.5Q263.4 207 259.2 212.8Q253.8 219 250.5 219Q247.2 219 241.8 212.8Q237.6 207 239 204.5Z" fill="#10281C" stroke="none" />
              <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z" fill="#54B48C" />
              <path d="M337 298H396Q410 298 410 312V364Q410 378 396 378H337A40 40 0 0 1 337 298Z" fill="#358867" />
              <circle cx="337" cy="338" r="24" fill="#F5BA3E" stroke="none" />
            </g>
          </svg>
        </span>
      </div>
      <div className="calt-boot-wordmark" aria-hidden="true">
        Calt<span>D</span>Hy
      </div>
      <div className="calt-boot-track" aria-hidden="true">
        <div className="calt-boot-bar" />
      </div>
      <p className="calt-boot-status">{statusText}</p>
    </div>
  );
}

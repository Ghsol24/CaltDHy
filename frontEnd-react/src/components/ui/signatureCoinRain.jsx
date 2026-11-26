import React, { useId, useMemo } from 'react';
import { CATCH, LEFT_SLOT, POCKET } from './signatureCoinMotion';

// Màn loading đăng nhập "Mưa xu": chuột trong ví hứng xu rơi.
//
// Quy tắc hiệu năng (đừng phá): mọi thứ chuyển động là một lớp riêng và CHỈ đổi
// `transform`/`opacity`. Trình duyệt giao các thay đổi này cho luồng đồ hoạ (compositor),
// nên vẫn mượt khi JavaScript đang bận tải trang Home ngay sau đăng nhập.
// Không animate top/left/width, bóng đổ hay filter.
//
// Toạ độ hình vẽ theo khung 512×512 của logo (public/brand/caltdhy-logo-full.svg).

const INK = '#10281C';
const CREAM = '#F5F1E3';

function Coin({ x, y }) {
  return (
    <>
      <circle cx={x} cy={y} r="32" fill="#F0B43B" stroke={INK} strokeWidth="7.5" />
      <circle cx={x} cy={y} r="20" fill="none" stroke="#FCE394" strokeWidth="3.5" />
    </>
  );
}

// Tay 3 ngón ngắn, đầu tròn: viền đậm vẽ trước, phần kem vẽ sau cho liền một khối.
function Hand({ fingers }) {
  return (
    <>
      <g stroke={INK} strokeLinecap="round" fill="none">
        <path d="M340 250L462 206" strokeWidth="51" />
        <path d={fingers} strokeWidth="43" />
      </g>
      <circle cx="462" cy="206" r="36.5" fill={INK} />
      <g stroke={CREAM} strokeLinecap="round" fill="none">
        <path d="M340 250L462 206" strokeWidth="30" />
        <path d={fingers} strokeWidth="22" />
      </g>
      <circle cx="462" cy="206" r="26" fill={CREAM} />
    </>
  );
}

function Layer({ name, children }) {
  return (
    <div className={`signature-login__layer signature-login__layer--${name}`} data-layer={name}>
      <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">{children}</svg>
    </div>
  );
}

// Thứ tự lớp = thứ tự trước/sau: xu "ngẫu nhiên" lọt sau đầu chuột, xu "thẳng" rơi trước đầu,
// tay và xu đang cầm nằm sau mặt trước của ví nên thụt vào là khuất.
export const CoinRainScene = React.memo(function CoinRainScene({ characterRef }) {
  const gradientId = `signature-tile-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <div className="signature-login__scene" aria-hidden="true">
      <div className="signature-login__ground" />
      <div ref={characterRef} className="signature-login__character">
        <div className="signature-login__body" data-layer="body">
          <Layer name="tile">
            <defs>
              <linearGradient id={gradientId} x1="64" y1="24" x2="448" y2="496" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#135E47" />
                <stop offset="1" stopColor="#0E4D3A" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="116" fill={`url(#${gradientId})`} />
          </Layer>
          <Layer name="back">
            <path d="M104 226V214Q104 192 128 192H350Q373 192 373 215V244H104Z" fill="#0B3D2E"
              stroke={INK} strokeWidth="10.5" strokeLinejoin="round" />
          </Layer>
          <Layer name="coinC"><Coin x={POCKET[0]} y={POCKET[1]} /></Layer>
          <Layer name="mouse">
            <path d="M151.5 242Q154.5 198 165.5 171.5A48 48 0 1 1 213.3 127.8Q250.5 113.5 287.7 127.8A48 48 0 1 1 335.5 171.5Q346.5 198 349.5 242Z"
              fill={CREAM} stroke={INK} strokeWidth="10.5" strokeLinejoin="round" />
            <circle cx="211.5" cy="189" r="9.4" fill={INK} />
            <circle cx="289.5" cy="189" r="9.4" fill={INK} />
            <path d="M239 204.5Q250.5 200.5 262 204.5Q263.4 207 259.2 212.8Q253.8 219 250.5 219Q247.2 219 241.8 212.8Q237.6 207 239 204.5Z" fill={INK} />
          </Layer>
          <Layer name="coinB"><Coin x={LEFT_SLOT[0]} y={LEFT_SLOT[1]} /></Layer>
          <Layer name="held"><Coin x={CATCH[0]} y={CATCH[1]} /></Layer>
          <Layer name="closed"><Hand fingers="M462 206L474 178M462 206L489 189M462 206L494 210" /></Layer>
          <Layer name="open"><Hand fingers="M462 206L458 162M462 206L493 175M462 206L506 210" /></Layer>
          <Layer name="front">
            <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z"
              fill="#54B48C" stroke={INK} strokeWidth="10.5" strokeLinejoin="round" />
            <path d="M337 302H396Q408 302 408 314V362Q408 374 396 374H337A36 36 0 0 1 337 302Z"
              fill="#398F6C" stroke={INK} strokeWidth="10.5" strokeLinejoin="round" />
          </Layer>
          <Layer name="clasp">
            <circle cx="337" cy="338" r="23" fill="#F0B43B" />
            <circle cx="337" cy="338" r="16" fill="none" stroke="#FCE394" strokeWidth="2.5" strokeOpacity=".8" />
          </Layer>
          <Layer name="ring"><circle cx="337" cy="338" r="30" fill="none" stroke="#FCE394" strokeWidth="8" /></Layer>
          <Layer name="coinA"><Coin x={CATCH[0]} y={CATCH[1]} /></Layer>
          <Layer name="spark"><circle cx={CATCH[0]} cy={CATCH[1]} r="40" fill="none" stroke="#FCE394" strokeWidth="6" /></Layer>
        </div>
        <span className="signature-login__plus" data-layer="plus">+1</span>
      </div>
    </div>
  );
});

// ── Xu nền: rơi chậm, nhỏ, mờ ở hai bên màn hình; mỗi lượt rơi đổi chỗ ngẫu nhiên. ──
const DROPS = [
  { duration: 3400, opacity: 0.72 },
  { duration: 4100, opacity: 0.6 },
  { duration: 4800, opacity: 0.5 },
  { duration: 5600, opacity: 0.42 },
];

function pickDropX() {
  // Tránh cột giữa (chữ, ví, thanh tiến độ). Màn hẹp thì dạt hẳn ra mép.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
  const [from, to] = narrow ? [2, 16] : [3, 27];
  const x = from + Math.random() * (to - from);
  return Math.random() < 0.5 ? x : 100 - x;
}
const pickDropSize = () => Math.round(18 + Math.random() * 14);

export function AmbientCoins() {
  const drops = useMemo(() => DROPS.map((drop) => ({
    ...drop, x: pickDropX(), size: pickDropSize(), delay: -Math.round(Math.random() * drop.duration),
  })), []);
  const reposition = (event) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.style.left = `${pickDropX()}%`;
    event.currentTarget.style.setProperty('--drop-size', `${pickDropSize()}px`);
  };
  return (
    <div className="signature-login__rain" aria-hidden="true">
      {drops.map((drop, index) => (
        <span key={index} className="signature-login__drop" onAnimationIteration={reposition}
          style={{ left: `${drop.x}%`, opacity: drop.opacity, '--drop-size': `${drop.size}px`,
            animationDuration: `${drop.duration}ms`, animationDelay: `${drop.delay}ms` }}>
          <span className="signature-login__drop-spin" style={{ animationDuration: `${Math.round(drop.duration / 6)}ms` }}>
            <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
              <circle cx="40" cy="40" r="32" fill="#F0B43B" stroke={INK} strokeWidth="7.5" />
              <circle cx="40" cy="40" r="20" fill="none" stroke="#FCE394" strokeWidth="3.5" />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}

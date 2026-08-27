import React from 'react';

/**
 * JarGlassGraphic — Vector SVG 3D Glass Jar illustration with dynamic liquid level
 * and percentage badge, matching the reference design.
 *
 * @param {number} percent - Completion percentage (0 - 100)
 * @param {string} color - Accent color for jar liquid & badge
 * @param {string} icon - Emoji or icon to show inside jar
 * @param {number} width - Render width in px (default 80)
 * @param {number} height - Render height in px (default 96)
 */
export function JarGlassGraphic({
  percent = 0,
  color = '#5356F1',
  icon = '🫙',
  width = 84,
  height = 100
}) {
  const clampedPercent = Math.max(0, Math.min(100, Number(percent) || 0));

  // Liquid height within the glass jar body (y from 32 to 92 -> total inner height = 60)
  const innerHeight = 60;
  const liquidH = Math.round((clampedPercent / 100) * innerHeight);
  const liquidY = 92 - liquidH;

  return (
    <div
      className="jar-glass-graphic-wrapper"
      style={{
        position: 'relative',
        width,
        height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      aria-hidden="true"
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Jar Body Clip Path for Liquid */}
          <clipPath id={`jar-clip-${clampedPercent}-${color.replace('#', '')}`}>
            <path d="M22 36C22 34 24 32 26 32H74C76 32 78 34 78 36V82C78 90 72 96 64 96H36C28 96 22 90 22 82V36Z" />
          </clipPath>

          {/* Liquid Gradient */}
          <linearGradient id={`liquid-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>

          {/* Glass Reflection Gradient */}
          <linearGradient id="glass-reflection" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.3" />
          </linearGradient>

          {/* Lid Metallic Gradient */}
          <linearGradient id="lid-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
        </defs>

        {/* Jar Soft Drop Shadow */}
        <ellipse cx="50" cy="98" rx="30" ry="7" fill="rgba(15, 23, 42, 0.08)" />

        {/* 1. Jar Glass Back Body */}
        <path
          d="M22 36C22 34 24 32 26 32H74C76 32 78 34 78 36V82C78 90 72 96 64 96H36C28 96 22 90 22 82V36Z"
          fill="#F8FAFC"
          fillOpacity="0.75"
        />

        {/* 2. Liquid Layer (Clipped to Jar Body) */}
        {liquidH > 0 && (
          <g clipPath={`url(#jar-clip-${clampedPercent}-${color.replace('#', '')})`}>
            {/* Liquid Fill */}
            <rect
              x="20"
              y={liquidY}
              width="60"
              height={liquidH + 6}
              fill={`url(#liquid-grad-${color.replace('#', '')})`}
            />

            {/* Liquid Top Wave / Surface Curve */}
            <ellipse
              cx="50"
              cy={liquidY}
              rx="28"
              ry="4"
              fill="#FFFFFF"
              fillOpacity="0.35"
            />

            {/* Rising Bubbles */}
            {liquidH > 18 && (
              <>
                <circle cx="36" cy={liquidY + 12} r="2" fill="#FFFFFF" fillOpacity="0.5" />
                <circle cx="62" cy={liquidY + 16} r="2.5" fill="#FFFFFF" fillOpacity="0.4" />
                <circle cx="48" cy={liquidY + 24} r="1.5" fill="#FFFFFF" fillOpacity="0.6" />
              </>
            )}
          </g>
        )}

        {/* 3. Center Icon / Emoji Inside Jar */}
        <text
          x="50"
          y="70"
          fontSize="22"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {icon || '🫙'}
        </text>

        {/* 4. Glass Highlights & Outer Outline */}
        <path
          d="M22 36C22 34 24 32 26 32H74C76 32 78 34 78 36V82C78 90 72 96 64 96H36C28 96 22 90 22 82V36Z"
          fill="url(#glass-reflection)"
          stroke="#CBD5E1"
          strokeWidth="2"
        />

        {/* Left Vertical Glass Light Reflection Stripe */}
        <path
          d="M26 38C26 38 27 55 27 75C27 82 28 86 32 90"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />

        {/* 5. Jar Neck & Ring */}
        <path
          d="M28 26C28 24.5 29.5 23 31 23H69C70.5 23 72 24.5 72 26V32H28V26Z"
          fill="#F1F5F9"
          stroke="#CBD5E1"
          strokeWidth="1.5"
        />

        {/* 6. Jar Lid */}
        <rect
          x="26"
          y="18"
          width="48"
          height="7"
          rx="3.5"
          fill="url(#lid-grad)"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />
        {/* Lid Groove Lines */}
        <line x1="38" y1="20" x2="38" y2="23" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
        <line x1="50" y1="20" x2="50" y2="23" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
        <line x1="62" y1="20" x2="62" y2="23" stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" />
      </svg>

      {/* Floating Percentage Badge on top-right */}
      <span
        style={{
          position: 'absolute',
          top: '2px',
          right: '-4px',
          background: '#FFFFFF',
          color: color || '#5356F1',
          border: `1.5px solid ${color || '#5356F1'}33`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          borderRadius: '99px',
          padding: '2px 7px',
          fontSize: '11px',
          fontWeight: 800,
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '-0.02em',
          lineHeight: 1.2
        }}
      >
        {clampedPercent}%
      </span>
    </div>
  );
}

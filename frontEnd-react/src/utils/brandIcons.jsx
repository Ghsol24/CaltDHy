import React from 'react';

/**
 * Render Brand Logo SVG Icon Component
 */
export function BrandLogoIcon({ brandKey, size = 48, className = '' }) {
  switch (brandKey) {
    case 'netflix':
      return (
        <div
          className={`brand-icon-tile brand-netflix ${className}`}
          style={{ width: size, height: size }}
          title="Netflix"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} fill="none">
            <rect width="48" height="48" rx="8" fill="#141414" />
            <path
              d="M16 11V37C17.3 36.8 19.3 36.5 20.6 36.3V19.7L27.6 35.1C29 34.8 30.6 34.5 32 34.3V11H27.4V27.6L20.6 12.3H16V11Z"
              fill="#E50914"
            />
          </svg>
        </div>
      );

    case 'spotify':
      return (
        <div
          className={`brand-icon-tile brand-spotify ${className}`}
          style={{ width: size, height: size }}
          title="Spotify"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} fill="none">
            <circle cx="24" cy="24" r="22" fill="#1DB954" />
            <path
              d="M33.2 21.3C26.5 17.3 15.4 17 9 18.9C8 19.2 7 18.6 6.7 17.6C6.4 16.6 7 15.6 8 15.3C15.4 13.1 27.7 13.4 35.4 18C36.3 18.5 36.6 19.7 36 20.6C35.5 21.4 34.1 21.8 33.2 21.3ZM32.9 26.2C32.4 27 31.4 27.2 30.6 26.7C25.1 23.3 16.5 22.3 10 24.3C9.1 24.5 8.2 24 7.9 23.2C7.7 22.3 8.2 21.4 9 21.1C16.5 18.9 26 20 32.4 23.9C33.1 24.4 33.4 25.4 32.9 26.2ZM30.4 31C30 31.6 29.2 31.8 28.6 31.4C24 28.6 17.8 27.9 10.4 29.6C9.7 29.8 9 29.3 8.8 28.6C8.6 27.9 9.1 27.2 9.8 27C17.9 25.2 24.8 26 29.9 29.2C30.6 29.6 30.7 30.4 30.4 31Z"
              fill="#121212"
            />
          </svg>
        </div>
      );

    case 'youtube':
      return (
        <div
          className={`brand-icon-tile brand-youtube ${className}`}
          style={{ width: size, height: size }}
          title="YouTube"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} fill="none">
            <rect width="48" height="48" rx="8" fill="#FF0000" />
            <path d="M20 16L32 24L20 32V16Z" fill="#FFFFFF" />
          </svg>
        </div>
      );

    case 'fpt':
      return (
        <div
          className={`brand-icon-tile brand-fpt ${className}`}
          style={{ width: size, height: size }}
          title="FPT"
          aria-hidden="true"
        >
          <div className="fpt-logo-badge">
            <span className="fpt-letter fpt-f">F</span>
            <span className="fpt-letter fpt-p">P</span>
            <span className="fpt-letter fpt-t">T</span>
          </div>
        </div>
      );

    case 'apple':
      return (
        <div
          className={`brand-icon-tile brand-apple ${className}`}
          style={{ width: size, height: size }}
          title="Apple"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.65} height={size * 0.65} fill="none">
            <rect width="48" height="48" rx="8" fill="#1C1C1E" />
            <path
              d="M30.4 24.8C30.4 20.8 33.6 18.8 33.8 18.7C32 16 29.1 15.6 28.1 15.5C25.7 15.2 23.3 16.9 22 16.9C20.7 16.9 18.8 15.5 16.8 15.5C14.2 15.5 11.8 17 10.5 19.3C7.8 24 9.8 31 12.4 34.8C13.7 36.6 15.2 38.6 17.2 38.5C19.1 38.4 19.8 37.3 22.1 37.3C24.4 37.3 25.1 38.5 27.1 38.5C29.1 38.4 30.4 36.7 31.7 34.9C33.1 32.8 33.7 30.8 33.8 30.7C33.7 30.6 30.4 29.3 30.4 24.8ZM25.8 13.3C26.9 12 27.6 10.1 27.4 8.2C25.8 8.3 23.7 9.3 22.6 10.6C21.6 11.7 20.7 13.6 20.9 15.5C22.8 15.6 24.7 14.5 25.8 13.3Z"
              fill="#FFFFFF"
            />
          </svg>
        </div>
      );

    case 'chatgpt':
      return (
        <div
          className={`brand-icon-tile brand-chatgpt ${className}`}
          style={{ width: size, height: size }}
          title="ChatGPT"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} fill="none">
            <rect width="48" height="48" rx="8" fill="#10A37F" />
            <circle cx="24" cy="24" r="11" stroke="#FFFFFF" strokeWidth="2.5" fill="none" />
            <path d="M24 13V35M13 24H35" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'adobe':
      return (
        <div
          className={`brand-icon-tile brand-adobe ${className}`}
          style={{ width: size, height: size }}
          title="Adobe"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} fill="none">
            <rect width="48" height="48" rx="8" fill="#FF0000" />
            <path d="M20 14L13 34H18L20 28H28L30 34H35L28 14H20ZM22 23L24 17L26 23H22Z" fill="#FFFFFF" />
          </svg>
        </div>
      );

    case 'canva':
      return (
        <div
          className={`brand-icon-tile brand-canva ${className}`}
          style={{ width: size, height: size }}
          title="Canva"
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" width={size * 0.7} height={size * 0.7} fill="none">
            <rect width="48" height="48" rx="8" fill="#00C4CC" />
            <circle cx="24" cy="24" r="10" fill="#FFFFFF" />
            <circle cx="24" cy="24" r="7" fill="#00C4CC" />
          </svg>
        </div>
      );

    case 'electric':
      return (
        <div
          className={`brand-icon-tile brand-electric ${className}`}
          style={{ width: size, height: size }}
          title="Tiền điện"
          aria-hidden="true"
        >
          <div className="utility-icon-box utility-electric">⚡</div>
        </div>
      );

    case 'water':
      return (
        <div
          className={`brand-icon-tile brand-water ${className}`}
          style={{ width: size, height: size }}
          title="Tiền nước"
          aria-hidden="true"
        >
          <div className="utility-icon-box utility-water">💧</div>
        </div>
      );

    case 'rent':
      return (
        <div
          className={`brand-icon-tile brand-rent ${className}`}
          style={{ width: size, height: size }}
          title="Tiền nhà"
          aria-hidden="true"
        >
          <div className="utility-icon-box utility-rent">🏠</div>
        </div>
      );

    case 'installment':
      return (
        <div
          className={`brand-icon-tile brand-installment ${className}`}
          style={{ width: size, height: size }}
          title="Trả góp"
          aria-hidden="true"
        >
          <div className="utility-icon-box utility-installment">💳</div>
        </div>
      );

    case 'gym':
      return (
        <div
          className={`brand-icon-tile brand-gym ${className}`}
          style={{ width: size, height: size }}
          title="Thể thao"
          aria-hidden="true"
        >
          <div className="utility-icon-box utility-gym">🏋️</div>
        </div>
      );

    default:
      return (
        <div
          className={`brand-icon-tile brand-generic ${className}`}
          style={{ width: size, height: size }}
          aria-hidden="true"
        >
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
      );
  }
}

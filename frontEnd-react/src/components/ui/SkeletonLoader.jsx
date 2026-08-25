import React from 'react';

/**
 * SkeletonLoader Primitive Component
 * Hiển thị skeleton placeholder khi dữ liệu đang tải (loading state).
 *
 * @param {Object} props
 * @param {'card'|'text'|'avatar'|'table-row'} [props.variant='text'] - Loại skeleton
 * @param {number} [props.count=1] - Số lượng phần tử lặp lại
 * @param {string|number} [props.width] - Chiều rộng tùy chỉnh (CSS unit hoặc số px)
 * @param {string|number} [props.height] - Chiều cao tùy chỉnh (CSS unit hoặc số px)
 * @param {string} [props.className='']
 */
export function SkeletonLoader({
  variant = 'text',
  count = 1,
  width,
  height,
  className = '',
}) {
  const style = {};
  if (width !== undefined) {
    style.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height !== undefined) {
    style.height = typeof height === 'number' ? `${height}px` : height;
  }

  const items = Array.from({ length: Math.max(1, count) }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className={`skeleton-group skeleton-group--card ${className}`}>
        {items.map((key) => (
          <div
            key={key}
            className="skeleton-item skeleton-card"
            style={style}
            aria-hidden="true"
          >
            <div className="skeleton-item skeleton-avatar skeleton-avatar--sm" />
            <div className="skeleton-item skeleton-text skeleton-text--title" />
            <div className="skeleton-item skeleton-text skeleton-text--body" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={`skeleton-group skeleton-group--table-row ${className}`}>
        {items.map((key) => (
          <div
            key={key}
            className="skeleton-item skeleton-row"
            style={style}
            aria-hidden="true"
          >
            <div className="skeleton-item skeleton-avatar skeleton-avatar--xs" />
            <div className="skeleton-item skeleton-text" style={{ flex: 2 }} />
            <div className="skeleton-item skeleton-text" style={{ flex: 1 }} />
            <div className="skeleton-item skeleton-text" style={{ width: '80px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={`skeleton-group skeleton-group--inline ${className}`}>
        {items.map((key) => (
          <div
            key={key}
            className="skeleton-item skeleton-avatar"
            style={style}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // variant === 'text' (mặc định)
  return (
    <div className={`skeleton-group skeleton-group--text ${className}`}>
      {items.map((key) => (
        <div
          key={key}
          className="skeleton-item skeleton-text"
          style={style}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

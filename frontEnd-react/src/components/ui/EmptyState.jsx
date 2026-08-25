import React from 'react';

/**
 * EmptyState Primitive Component
 * Hiển thị trạng thái rỗng thân thiện, có icon/minh họa, title, description và action CTA tùy chọn.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.title='Chưa có dữ liệu']
 * @param {string} [props.description]
 * @param {string} [props.actionLabel]
 * @param {Function} [props.onAction]
 * @param {string} [props.className='']
 */
export function EmptyState({
  icon,
  title = 'Chưa có dữ liệu',
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state__icon-wrapper" aria-hidden="true">
        {icon || (
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="empty-state__default-icon"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        )}
      </div>

      <h4 className="empty-state__title">{title}</h4>

      {description && <p className="empty-state__desc">{description}</p>}

      {actionLabel && typeof onAction === 'function' && (
        <button
          type="button"
          className="btn btn--primary empty-state__action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

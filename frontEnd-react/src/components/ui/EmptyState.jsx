import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { Icon } from './AppIcons';

/**
 * EmptyState Primitive Component
 * Hiển thị trạng thái rỗng thân thiện, có icon nét rỗng (hoặc logo thương hiệu cho first-run),
 * tiêu đề, mô tả và CTA tùy chọn.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.icon]
 * @param {boolean} [props.branded=false] - Bật dấu ấn mascot CaltDHy cho trạng thái chào lần đầu.
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {string} [props.actionLabel]
 * @param {Function} [props.onAction]
 * @param {string} [props.className='']
 */
export function EmptyState({
  icon,
  branded = false,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  const { t } = useTranslation();
  return (
    <div className={`empty-state${branded ? ' empty-state--branded' : ''} ${className}`.trim()}>
      <div
        className={`empty-state__icon-wrapper${branded ? ' empty-state__icon-wrapper--branded' : ''}`}
        aria-hidden="true"
      >
        {branded ? (
          <BrandMark className="empty-state__brand-mark" />
        ) : (
          icon || (
            <Icon name="sparkle" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="empty-state__default-icon" />
          )
        )}
      </div>

      <h4 className="empty-state__title">{title || t('empty.title')}</h4>

      {description && <p className="empty-state__desc">{description}</p>}

      {actionLabel && typeof onAction === 'function' && (
        <Button variant="primary" className="empty-state__action" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

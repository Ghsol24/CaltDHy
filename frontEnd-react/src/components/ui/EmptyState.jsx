import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

import { Button } from './Button';
import { Icon } from './AppIcons';
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
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  const { t } = useTranslation();
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state__icon-wrapper" aria-hidden="true">
        {icon || (
          <Icon name="mail" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state__default-icon" />
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

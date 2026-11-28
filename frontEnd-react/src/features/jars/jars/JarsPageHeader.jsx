import React from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Icon } from '../../../components/ui/AppIcons';
import { useTranslation } from '../../../i18n/useTranslation';

/**
 * Hàng tiêu đề duy nhất của trang Hũ tiết kiệm: icon + H1 + nút phụ mở Drawer lịch sử
 * và nút chính "Tạo hũ mới".
 */
export function JarsPageHeader({
  icon = 'jarList',
  title,
  onCreate,
  onOpenHistory,
  historyOpen = false,
  hideTitle = false,
}) {
  const { t } = useTranslation();
  const hasActions = Boolean(onCreate || onOpenHistory);

  return (
    <PageHeader
      icon={icon}
      className="jars-overview-header"
      title={title}
      titleClassName="jars-hero-heading"
      hideTitle={hideTitle}
      actions={hasActions && (
        <div className="jars-header-actions">
          {onOpenHistory && (
            <button
              type="button"
              className="jars-history-trigger-btn"
              onClick={onOpenHistory}
              aria-expanded={historyOpen}
              aria-controls="jar-history-drawer"
            >
              <Icon name="history" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <span>{t('nav.history')}</span>
            </button>
          )}
          {onCreate && (
            <button type="button" className="jars-hero-cta-btn" onClick={onCreate}>
              <Icon name="plus" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <span>Tạo hũ mới</span>
            </button>
          )}
        </div>
      )}
    />
  );
}

import React from 'react';
import { PageTitleIcon } from '../../../components/ui/NavIcons';
import { Icon } from '../../../components/ui/AppIcons';

/**
 * Hàng tiêu đề của một trang Hũ: icon + H1 (đúng tên mục menu) và nút "Tạo hũ mới"
 * khi trang cần. Cùng mẫu với "Tổng quan hũ".
 */
export function JarsPageHeader({ icon, title, onCreate }) {
  return (
    <div className="jars-overview-header">
      <div className="page-title-lead">
        <PageTitleIcon name={icon} />
        <h1 className="jars-hero-heading">{title}</h1>
      </div>
      <div className="page-header-actions">
        {onCreate && (
          <button type="button" className="jars-hero-cta-btn" onClick={onCreate}>
            <Icon name="plus" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <span>Tạo hũ mới</span>
          </button>
        )}
      </div>
    </div>
  );
}

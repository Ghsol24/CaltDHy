import React from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Icon } from '../../../components/ui/AppIcons';

/**
 * Hàng tiêu đề của một trang Hũ: hàng tiêu đề dùng chung (PageHeader) với icon + H1
 * đúng tên mục menu, và nút "Tạo hũ mới" khi trang cần.
 * `hideTitle`: H1 chỉ để trình đọc màn hình (Danh sách hũ trên điện thoại, nơi dải mục
 * ở trên đã nói tên trang).
 */
export function JarsPageHeader({ icon, title, onCreate, hideTitle = false }) {
  return (
    <PageHeader
      icon={icon}
      className="jars-overview-header"
      title={title}
      titleClassName="jars-hero-heading"
      hideTitle={hideTitle}
      actions={onCreate && (
        <button type="button" className="jars-hero-cta-btn" onClick={onCreate}>
          <Icon name="plus" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <span>Tạo hũ mới</span>
        </button>
      )}
    />
  );
}

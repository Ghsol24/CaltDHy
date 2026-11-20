import React from 'react';
import { PageTitleIcon } from './NavIcons';
import './page-header.css';

/**
 * Hàng tiêu đề dùng chung của mọi trang trong app (đợt 11, 7e; X-08):
 * icon · H1 + phụ đề một dòng (hoặc `meta`, ví dụ chip trạng thái, cạnh H1) ·
 * bộ chọn kỳ · nút phụ / nút chính (nút chính đặt cuối, nằm sát mép phải).
 * Trên điện thoại bộ chọn kỳ xuống một hàng riêng rộng hết hàng.
 *
 * `hideTitle` ẩn khối icon + H1 khỏi mắt nhưng vẫn để trình đọc màn hình đọc được
 * (màn con của Phân tích trên điện thoại: chỉ còn bộ chọn tháng, trang vẫn có H1).
 *
 * `titleClassName` giữ class cũ của từng trang trên H1: `spendingRoutes.js` dùng nó
 * để đặt focus sau khi chuyển trang, và vài test trình duyệt bám vào nó.
 */
export function PageHeader({ id, icon, title, titleId, titleClassName, subtitle, meta, period, actions, className, hideTitle = false }) {
  const classes = ['page-header', hideTitle && 'page-header--title-hidden', className].filter(Boolean).join(' ');
  return (
    <div id={id} className={classes}>
      <div className="page-header__lead">
        {icon && <PageTitleIcon name={icon} />}
        <div className="page-header__titles">
          <div className="page-header__title-row">
            <h1 id={titleId} className={titleClassName ? `page-header__title ${titleClassName}` : 'page-header__title'}>{title}</h1>
            {meta}
          </div>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {period && <div className="page-header__period">{period}</div>}
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

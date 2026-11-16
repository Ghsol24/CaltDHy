import React from 'react';
import { Button } from './Button';
import { Icon } from './AppIcons';
import './error-feedback.css';

/**
 * Shown instead of a screen's numbers when its data could not be loaded, so a
 * failed request never looks like an empty account (UX audit HOME-10).
 */
export function LoadErrorBanner({ onRetry, retrying = false }) {
  return (
    <div className="load-error-banner" role="alert">
      <span className="load-error-banner__icon" aria-hidden="true">
        <Icon name="alertTriangle" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </span>
      <div className="load-error-banner__text">
        <strong>Không tải được dữ liệu</strong>
        <p>Số liệu đang được ẩn để tránh hiện sai. Kiểm tra kết nối rồi thử lại.</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} disabled={retrying}>
        {retrying ? 'Đang thử lại…' : 'Thử lại'}
      </Button>
    </div>
  );
}

import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';

export function PageSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="page-skeleton-container" role="status" aria-label={t('common.loading')}>
      {/* Top KPI Cards Skeleton */}
      <div className="page-skeleton-kpi-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card page-skeleton-card">
            <div className="skeleton-item skeleton-text skeleton-text--title" style={{ width: '40%' }} />
            <div className="skeleton-item skeleton-text" style={{ width: '70%', height: '28px', marginTop: '8px' }} />
            <div className="skeleton-item skeleton-text skeleton-text--body" style={{ width: '50%', marginTop: '4px' }} />
          </div>
        ))}
      </div>

      {/* Main Chart / Content Skeleton */}
      <div className="skeleton-card page-skeleton-main" style={{ marginTop: '24px', minHeight: '260px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="skeleton-item skeleton-text skeleton-text--title" style={{ width: '30%' }} />
          <div className="skeleton-item skeleton-text" style={{ width: '120px', height: '32px', borderRadius: '8px' }} />
        </div>
        <div className="skeleton-item" style={{ width: '100%', height: '180px', borderRadius: '8px' }} />
      </div>

      {/* Bottom List Skeleton */}
      <div className="skeleton-card page-skeleton-list" style={{ marginTop: '24px' }}>
        <div className="skeleton-item skeleton-text skeleton-text--title" style={{ width: '25%', marginBottom: '12px' }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-row" style={{ borderBottom: i === 4 ? 'none' : undefined }}>
            <div className="skeleton-item skeleton-avatar skeleton-avatar--sm" />
            <div style={{ flex: 1 }}>
              <div className="skeleton-item skeleton-text" style={{ width: '40%', marginBottom: '6px' }} />
              <div className="skeleton-item skeleton-text--body" style={{ width: '25%' }} />
            </div>
            <div className="skeleton-item skeleton-text" style={{ width: '80px', height: '18px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

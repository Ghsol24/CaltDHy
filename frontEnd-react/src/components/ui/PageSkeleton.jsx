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
            <div className="skeleton-item skeleton-text skeleton-text--title skeleton-item--box" />
            <div className="skeleton-item skeleton-text skeleton-item--box2" />
            <div className="skeleton-item skeleton-text skeleton-text--body skeleton-item--box3" />
          </div>
        ))}
      </div>

      {/* Main Chart / Content Skeleton */}
      <div className="skeleton-card page-skeleton-main skeleton-card--box">
        <div className="skeleton-card__div--layout">
          <div className="skeleton-item skeleton-text skeleton-text--title skeleton-item--box4" />
          <div className="skeleton-item skeleton-text skeleton-item--box5" />
        </div>
        <div className="skeleton-item skeleton-item--box6" />
      </div>

      {/* Bottom List Skeleton */}
      <div className="skeleton-card page-skeleton-list skeleton-card--box2">
        <div className="skeleton-item skeleton-text skeleton-text--title skeleton-item--box7" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`skeleton-row${i === 4 ? ' skeleton-row--last' : ''}`}>
            <div className="skeleton-item skeleton-avatar skeleton-avatar--sm" />
            <div className="skeleton-row__div--layout">
              <div className="skeleton-item skeleton-text skeleton-item--box8" />
              <div className="skeleton-item skeleton-text--body skeleton-item--box9" />
            </div>
            <div className="skeleton-item skeleton-text skeleton-item--box10" />
          </div>
        ))}
      </div>
    </div>
  );
}

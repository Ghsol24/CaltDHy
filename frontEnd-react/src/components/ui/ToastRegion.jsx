import React from 'react';
import { useToastStore } from '../../stores/useToastStore';
import { useTranslation } from '../../i18n/useTranslation';
import { BrandMark } from './BrandMark';
import { Icon } from './AppIcons';

function ToastIcon({ type }) {
  switch (type) {
    case 'milestone':
      return (
        <span className="toast-milestone-halo" aria-hidden="true">
          <BrandMark variant="full" className="toast-milestone-mark" />
        </span>
      );
    case 'success':
      return (
        <Icon name="checkPath" className="toast-icon toast-icon--success" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
      );
    case 'error':
      return (
        <Icon name="xCircle" className="toast-icon toast-icon--danger" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
      );
    case 'warning':
      return (
        <Icon name="alertTriangle" className="toast-icon toast-icon--warning" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      );
    case 'info':
    default:
      return (
        <Icon name="info" className="toast-icon toast-icon--info" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      );
  }
}

export function ToastRegion() {
  const { t } = useTranslation();
  const { toasts, removeToast } = useToastStore();

  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="toast-region"
      aria-label={t('toast.region')}
      tabIndex={-1}
    >
      {toasts.map((toast) => {
        const isAlert = toast.type === 'error' || toast.type === 'warning';
        const isMilestone = toast.type === 'milestone';
        return (
          <div
            key={toast.id}
            className={`toast-item toast-item--${toast.type || 'info'}`}
            role={isAlert ? 'alert' : 'status'}
            aria-live={isAlert ? 'assertive' : 'polite'}
          >
            <div className="toast-item__lead">
              <ToastIcon type={toast.type} />
              <div className="toast-item__content">
                {isMilestone && toast.badge && (
                  <span className="toast-milestone-badge">
                    <Icon name="sparkle" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />
                    <span>{toast.badge}</span>
                  </span>
                )}
                {toast.title && <p className="toast-item__title">{toast.title}</p>}
                <p className="toast-item__message">{toast.message}</p>
              </div>
            </div>

            <div className="toast-item__actions">
              {toast.action && (
                <button
                  type="button"
                  className="toast-item__action-btn"
                  onClick={() => {
                    if (typeof toast.action.onClick === 'function') {
                      toast.action.onClick();
                    }
                    removeToast(toast.id);
                  }}
                >
                  {toast.action.label || t('toast.action')}
                </button>
              )}
              <button
                type="button"
                className="toast-item__close-btn"
                onClick={() => removeToast(toast.id)}
                aria-label={t('toast.close')}
              >
                <Icon name="close" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

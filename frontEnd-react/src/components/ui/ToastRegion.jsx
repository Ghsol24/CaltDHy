import React from 'react';
import { useToastStore } from '../../stores/useToastStore';

function ToastIcon({ type }) {
  switch (type) {
    case 'success':
      return (
        <svg
          className="toast-icon toast-icon--success"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case 'error':
      return (
        <svg
          className="toast-icon toast-icon--danger"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'warning':
      return (
        <svg
          className="toast-icon toast-icon--warning"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg
          className="toast-icon toast-icon--info"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

export function ToastRegion() {
  const { toasts, removeToast } = useToastStore();

  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="toast-region"
      aria-label="Thông báo"
      tabIndex={-1}
    >
      {toasts.map((toast) => {
        const isAlert = toast.type === 'error' || toast.type === 'warning';
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
                  {toast.action.label || 'Thao tác'}
                </button>
              )}
              <button
                type="button"
                className="toast-item__close-btn"
                onClick={() => removeToast(toast.id)}
                aria-label="Đóng thông báo"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

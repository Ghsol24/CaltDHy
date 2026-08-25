import React, { useRef, useEffect, useCallback } from 'react';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export function ConfirmDialog() {
  const {
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    confirmVariant,
    handleConfirm,
    handleCancel,
  } = useConfirmStore();

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleCancel();
      }
    },
    [isOpen, handleCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="confirm-dialog-header">
          <div
            className={`confirm-dialog-icon confirm-dialog-icon--${confirmVariant || 'danger'}`}
            aria-hidden="true"
          >
            {confirmVariant === 'danger' ? (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </div>
          <h3 id="confirm-dialog-title" className="confirm-dialog-title">
            {title}
          </h3>
        </div>

        {message && (
          <p id="confirm-dialog-desc" className="confirm-dialog-message">
            {message}
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="btn btn--secondary confirm-dialog-btn"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${
              confirmVariant === 'danger' ? 'btn--danger' : 'btn--primary'
            } confirm-dialog-btn`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

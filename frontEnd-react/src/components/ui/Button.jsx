import React, { forwardRef } from 'react';

const cx = (...names) => names.filter(Boolean).join(' ');

/**
 * Text button on the shared `.btn` styles (components/ui/button.css).
 *
 * - `variant`: primary | secondary | danger | danger-outline | warning
 * - `size`: 'sm' for compact rows, 'lg' for dialog footers (42px, 44px on touch)
 * - `loading`: shows the spinner, disables the button and sets aria-busy so
 *   a second click can't send the same request twice
 * - defaults to type="button" so it never submits a form by accident
 */
export const Button = forwardRef(function Button(
  { variant = 'secondary', size, loading = false, disabled, type = 'button', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('btn', `btn--${variant}`, size && `btn--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

/**
 * Icon-only button. `label` is required: it becomes the accessible name and
 * the hover tooltip, so the control is never announced as just "button".
 * Styling stays with the caller's className.
 */
export const IconButton = forwardRef(function IconButton(
  { label, title, type = 'button', children, ...props },
  ref,
) {
  if (!label && import.meta.env?.DEV) console.warn('IconButton: `label` is required for an icon-only button.');
  return (
    <button ref={ref} type={type} aria-label={label} title={title ?? label} {...props}>
      {children}
    </button>
  );
});

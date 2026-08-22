import React, { useState } from 'react';

export const FloatingInput = ({
  id,
  type = 'text',
  label,
  value,
  onChange,
  onInput,
  isValid = false,
  autoComplete,
  required = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="fg" id={`fg_${id}`}>
      {isPassword ? (
        <div className="iw">
          <input
            id={id}
            className={`finput ${isValid ? 'valid' : ''}`}
            type={inputType}
            placeholder=" "
            value={value}
            onChange={onChange}
            onInput={onInput}
            autoComplete={autoComplete}
            required={required}
          />
          <label className="flabel" htmlFor={id}>
            {label}
          </label>
          <button
            type="button"
            className="eye-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Toggle password visibility"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {showPassword ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            className={`finput ${isValid ? 'valid' : ''}`}
            type={inputType}
            placeholder=" "
            value={value}
            onChange={onChange}
            onInput={onInput}
            autoComplete={autoComplete}
            required={required}
          />
          <label className="flabel" htmlFor={id}>
            {label}
          </label>
          <svg
            className="fg-check"
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </>
      )}
    </div>
  );
};

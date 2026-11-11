import React, { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

import { Icon } from './AppIcons';
export const FloatingInput = ({
  id,
  type = 'text',
  label,
  value,
  onChange,
  onInput,
  isValid = false,
  autoComplete,
  required = false,
  readOnly = false
}) => {
  const { t } = useTranslation();
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
            readOnly={readOnly}
          />
          <label className="flabel" htmlFor={id}>
            {label}
          </label>
          <button
            type="button"
            className="eye-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={t('auth.togglePassword')}
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
            readOnly={readOnly}
          />
          <label className="flabel" htmlFor={id}>
            {label}
          </label>
          <Icon name="check" className="fg-check" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </div>
  );
};

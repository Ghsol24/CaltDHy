import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/AppIcons';

/**
 * Custom Dropdown Filter Component (Theme-aware & accessible)
 */
export function WalletFilterDropdown({ value, options, onChange, label, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`wallet-custom-dropdown ${className} ${isOpen ? 'is-open' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="wallet-custom-dropdown-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label || selectedOption.label}
      >
        <span className="wallet-dropdown-selected-label">{selectedOption.label}</span>
        <Icon name="chevronDown" className={`wallet-dropdown-chevron ${isOpen ? 'is-rotated' : ''}`} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </button>

      {isOpen && (
        <div className="wallet-custom-dropdown-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`wallet-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="wallet-dropdown-option-label">{opt.label}</span>
                {isSelected && (
                  <Icon name="check" className="wallet-dropdown-check" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

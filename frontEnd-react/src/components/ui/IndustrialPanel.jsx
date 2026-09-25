import React from 'react';

export const IndustrialPanel = ({ children, eyebrow, title, titleHighlight, className = '' }) => {
  return (
    <div className={`module ${className}`} role="region">
      {(eyebrow || title) && (
        <div className="mod-header">
          {eyebrow && <span className="mod-eyebrow">{eyebrow}</span>}
          {title && (
            <h1 className="mod-title">
              {title} {titleHighlight && <span>{titleHighlight}</span>}
            </h1>
          )}
        </div>
      )}

      {children}
    </div>
  );
};

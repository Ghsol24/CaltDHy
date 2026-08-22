import React from 'react';

export const IndustrialPanel = ({ children, eyebrow, title, titleHighlight, showVents = true, className = '' }) => {
  return (
    <div className={`module ${className}`} role="region">
      {/* Corner screws */}
      <div className="c-screw c-tl" aria-hidden="true"></div>
      <div className="c-screw c-tr" aria-hidden="true"></div>
      <div className="c-screw c-bl" aria-hidden="true"></div>
      <div className="c-screw c-br" aria-hidden="true"></div>

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

      {showVents && (
        <div className="vents" aria-hidden="true">
          <div className="vent"></div>
          <div className="vent"></div>
          <div className="vent"></div>
          <div className="vent"></div>
          <div className="vent"></div>
        </div>
      )}

      {children}
    </div>
  );
};

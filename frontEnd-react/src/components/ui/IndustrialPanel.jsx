import React from 'react';
import { BrandMark } from './BrandMark';

export const IndustrialPanel = ({
  children,
  eyebrow,
  title,
  titleHighlight,
  subtitle = '',
  headingLevel = 'h1',
  showBrandMark = false,
  className = '',
}) => {
  const Heading = headingLevel === 'h2' ? 'h2' : 'h1';

  return (
    <div className={`module ${className}`.trim()} role="region">
      {(showBrandMark || eyebrow || title || subtitle) && (
        <div className={`mod-header${showBrandMark ? ' mod-header--branded' : ''}`}>
          {showBrandMark && (
            <div className="mod-brand-emblem" aria-hidden="true">
              <BrandMark variant="full" className="mod-brand-mark" />
            </div>
          )}
          {eyebrow && <span className="mod-eyebrow">{eyebrow}</span>}
          {title && (
            <Heading className="mod-title">
              {title} {titleHighlight && <span>{titleHighlight}</span>}
            </Heading>
          )}
          {subtitle && <p className="mod-subtitle">{subtitle}</p>}
        </div>
      )}

      {children}
    </div>
  );
};

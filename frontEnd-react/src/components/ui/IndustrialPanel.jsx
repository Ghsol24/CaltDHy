import React from 'react';

export const IndustrialPanel = ({
  children,
  eyebrow,
  title,
  titleHighlight,
  subtitle = '',
  headingLevel = 'h1',
  className = '',
}) => {
  const Heading = headingLevel === 'h2' ? 'h2' : 'h1';

  return (
    <div className={`module ${className}`.trim()} role="region">
      {(eyebrow || title || subtitle) && (
        <div className="mod-header">
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

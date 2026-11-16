import React from 'react';
import googleG from '../../assets/brand/google-g.png';
import facebookPrimary from '../../assets/brand/facebook-logo-primary.png';
import facebookSecondary from '../../assets/brand/facebook-logo-secondary.png';

// Official marks, unaltered: Google's "G" (developers.google.com sign-in branding assets) and the
// Facebook logo (Meta Brand Resource Center pack). Meta's rules: the blue primary logo on light
// surfaces, the white secondary logo on Facebook Blue. Decorative: the button text names the action.
const SOURCES = {
  google: { primary: googleG, secondary: googleG },
  facebook: { primary: facebookPrimary, secondary: facebookSecondary },
};

export function BrandLogo({ provider, variant = 'primary', size = 20 }) {
  const src = SOURCES[provider]?.[variant];
  if (!src) return null;
  return <img className={`brand-logo brand-logo--${provider}`} src={src} alt="" aria-hidden="true"
    height={size} style={{ height: size, width: 'auto' }} draggable="false" />;
}

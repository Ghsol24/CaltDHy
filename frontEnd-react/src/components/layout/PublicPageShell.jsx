import React from 'react';
import { PublicTopbar } from './PublicTopbar';

export function PublicPageShell({ children, pageTitle = '', className = '', ariaBusy = false }) {
  return (
    <div className={`auth-page ${className}`.trim()} aria-busy={ariaBusy || undefined}>
      {/* Shared soft ambient aura matching LandingPage */}
      <div className="pub-aura" aria-hidden="true">
        <div className="pub-aura-blob pub-aura-blob--primary" />
        <div className="pub-aura-blob pub-aura-blob--secondary" />
      </div>

      <PublicTopbar skipTarget="#main-content" />

      <main id="main-content" tabIndex={-1} className="auth-stage">
        {pageTitle && <h1 className="auth-hero-title">{pageTitle}</h1>}
        {children}
      </main>
    </div>
  );
}

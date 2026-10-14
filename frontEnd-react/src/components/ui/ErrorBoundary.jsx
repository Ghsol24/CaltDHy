import React from 'react';
import { normalizeLocale, translate } from '../../i18n/translations';
import '../../assets/css/error-feedback.css';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Diagnostic detail stays in developer tools, never in the fallback UI.
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    let locale = 'vi';
    try { locale = normalizeLocale(localStorage.getItem('caltdhy_lang')); } catch { /* default locale */ }
    const t = (key) => translate(locale, key);
    if (this.state.hasError) {
      return (
        <section className="display-error" role="alert" aria-labelledby="display-error-title">
          <span className="display-error__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </span>
          <h2 id="display-error-title">{t('error.displayTitle')}</h2>
          <p>{t('error.displayBody')}</p>
          <div className="display-error__actions">
            <button type="button" className="btn btn--primary" onClick={this.handleReset}>{t('common.tryAgain')}</button>
            <button type="button" className="btn btn--secondary" onClick={() => window.location.reload()}>{t('error.reload')}</button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

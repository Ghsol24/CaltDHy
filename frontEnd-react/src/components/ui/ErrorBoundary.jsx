import React from 'react';
import { normalizeLocale, translate } from '../../i18n/translations';
import './error-feedback.css';

import { Button } from './Button';
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
          <div className="display-error__emblem" aria-hidden="true">
            {/* SVG viết thẳng có chủ đích: đây là màn hình dự phòng khi tải chunk thất bại, và
                import BrandMark/AppIcons ở đây sẽ kéo thêm chunk vào bundle khởi đầu. */}
            <svg className="display-error__brand" viewBox="0 0 512 512" fill="none" focusable="false">
              <rect width="512" height="512" rx="116" fill="#105440" />
              <g transform="translate(256 256) scale(1.08) translate(-256 -256)" stroke="#10281C" strokeWidth="18.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M104 226V214Q104 192 128 192H350Q373 192 373 215V244H104Z" fill="#0B3D2E" />
                <path d="M151.5 242Q154.5 198 165.5 171.5A48 48 0 1 1 213.3 127.8Q250.5 113.5 287.7 127.8A48 48 0 1 1 335.5 171.5Q346.5 198 349.5 242Z" fill="#F5F1E3" />
                <circle cx="211.5" cy="193" r="14.5" fill="#10281C" stroke="none" />
                <circle cx="289.5" cy="193" r="14.5" fill="#10281C" stroke="none" />
                <path d="M104 214C104 229 114 238 130 238H365Q390.5 238 390.5 263V398Q390.5 436 352.5 436H142Q104 436 104 398Z" fill="#54B48C" />
                <path d="M337 298H396Q410 298 410 312V364Q410 378 396 378H337A40 40 0 0 1 337 298Z" fill="#358867" />
                <circle cx="337" cy="338" r="27.5" fill="#F5BA3E" stroke="none" />
              </g>
            </svg>
            <span className="display-error__badge">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </span>
          </div>
          <h2 id="display-error-title">{t('error.displayTitle')}</h2>
          <p>{t('error.displayBody')}</p>
          <div className="display-error__actions">
            <Button variant="primary" onClick={this.handleReset}>{t('common.tryAgain')}</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>{t('error.reload')}</Button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

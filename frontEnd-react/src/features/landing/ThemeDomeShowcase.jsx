import React, { useEffect, useRef, useState } from 'react';
import { THEME_OPTIONS } from '../../utils/themes';
import { translate } from '../../i18n/translations';
import { formatCurrency } from '../../utils/formatters';
import { switchThemeWithTransition } from '../../utils/themeTransition';
import { LandingIcon } from './LandingIcons';

// Supplemental palette tokens for the 4 simultaneous miniature workspace previews.
// Outer card chrome & stage surfaces strictly read semantic tokens from tokens.css.
const MINI_PALETTE_EXTRAS = {
  dark: {
    mutedBg: '#1A1C29',
    accentSoft: 'rgba(96, 165, 250, 0.16)',
    heroGrad: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 55%, #1D4ED8 100%)',
    success: '#10B981',
    expense: '#7D8CAD',
  },
  light: {
    mutedBg: '#F4F4F5',
    accentSoft: 'rgba(79, 70, 229, 0.10)',
    heroGrad: 'linear-gradient(135deg, #3730A3 0%, #4F46E5 55%, #6366F1 100%)',
    success: '#047857',
    expense: '#7486A6',
  },
  cream: {
    mutedBg: '#EDE4D8',
    accentSoft: '#F6E2D5',
    heroGrad: 'linear-gradient(135deg, #9A3412 0%, #C0531E 55%, #D97706 100%)',
    success: '#17642B',
    expense: '#7D7F9A',
  },
  green: {
    mutedBg: '#E2F2E9',
    accentSoft: '#D1FAE5',
    heroGrad: 'linear-gradient(135deg, #065F46 0%, #047857 52%, #10B981 100%)',
    success: '#047857',
    expense: '#6F85A3',
  },
};

const ORBIT_INTERVAL_MS = 3200;
const DRAG_THRESHOLD_PX = 48;

export function ThemeDomeShowcase({ copy, lang, theme, setTheme }) {
  const [isAutoOrbiting, setIsAutoOrbiting] = useState(false);
  const dragStartXRef = useRef(null);
  const didDragRef = useRef(false);
  const cardRefs = useRef({});

  const count = THEME_OPTIONS.length;
  const activeIndex = Math.max(0, THEME_OPTIONS.findIndex((o) => o.id === theme));

  // Reset any residual pointer tilt whenever active theme changes.
  useEffect(() => {
    Object.values(cardRefs.current).forEach((el) => {
      if (!el) return;
      el.style.removeProperty('--tilt-rx');
      el.style.removeProperty('--tilt-ry');
    });
  }, [activeIndex]);

  // Optional auto-orbit (defaults to paused; stops on reduced motion or hidden tab).
  useEffect(() => {
    if (!isAutoOrbiting) return undefined;
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setIsAutoOrbiting(false);
      return undefined;
    }

    const handleVisibility = () => {
      if (document.hidden) setIsAutoOrbiting(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const timer = window.setInterval(() => {
      const nextIdx = (activeIndex + 1) % count;
      setTheme(THEME_OPTIONS[nextIdx].id);
    }, ORBIT_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAutoOrbiting, activeIndex, count, setTheme]);

  const selectByIndex = (nextIndex, event, { withRipple = true } = {}) => {
    const wrapped = (nextIndex + count) % count;
    const target = THEME_OPTIONS[wrapped];
    if (!target) return;
    if (isAutoOrbiting) setIsAutoOrbiting(false);
    if (target.id === theme) return;
    if (withRipple) {
      switchThemeWithTransition(target.id, setTheme, event);
    } else {
      setTheme(target.id);
    }
  };

  const handleStageKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectByIndex(activeIndex + 1, null, { withRipple: false });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectByIndex(activeIndex - 1, null, { withRipple: false });
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectByIndex(0, null, { withRipple: false });
    } else if (event.key === 'End') {
      event.preventDefault();
      selectByIndex(count - 1, null, { withRipple: false });
    }
  };

  const handleViewportPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (typeof window !== 'undefined' && window.innerWidth <= 960) return;
    dragStartXRef.current = event.clientX;
    didDragRef.current = false;
  };

  const handleViewportPointerUp = (event) => {
    if (dragStartXRef.current === null) return;
    const dx = event.clientX - dragStartXRef.current;
    dragStartXRef.current = null;
    if (Math.abs(dx) >= DRAG_THRESHOLD_PX) {
      didDragRef.current = true;
      selectByIndex(activeIndex + (dx < 0 ? 1 : -1), event, { withRipple: true });
      window.setTimeout(() => {
        didDragRef.current = false;
      }, 0);
    }
  };

  const handleViewportPointerCancel = () => {
    dragStartXRef.current = null;
    didDragRef.current = false;
  };

  const handleCardPointerMove = (event, isActive) => {
    if (!isActive || event.pointerType !== 'mouse') return;
    if (typeof window === 'undefined' || window.innerWidth <= 960) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-rx', `${(-py * 7).toFixed(2)}deg`);
    el.style.setProperty('--tilt-ry', `${(px * 7).toFixed(2)}deg`);
  };

  const handleCardPointerLeave = (event) => {
    const el = event.currentTarget;
    el.style.removeProperty('--tilt-rx');
    el.style.removeProperty('--tilt-ry');
  };

  const sampleAmount = formatCurrency(15095000);

  return (
    <div className="lp-dome-stage" onKeyDown={handleStageKeyDown}>
      <div className="lp-dome-orbit-ring" aria-hidden="true" />

      <div
        className="lp-dome-viewport"
        onPointerDown={handleViewportPointerDown}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerCancel}
      >
        <div className="lp-dome-track" role="group" aria-label={copy.title}>
          {THEME_OPTIONS.map((option, index) => {
            const active = index === activeIndex;
            const pv = option.preview;
            const extra = MINI_PALETTE_EXTRAS[option.id] || MINI_PALETTE_EXTRAS.light;

            let delta = (index - activeIndex + count) % count;
            if (delta > count / 2) delta -= count;

            return (
              <div
                key={option.id}
                className="lp-dome-slot"
                data-rel={String(delta)}
              >
                <button
                  ref={(el) => { cardRefs.current[option.id] = el; }}
                  type="button"
                  className={`lp-theme-card lp-dome-card ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                  onPointerMove={(e) => handleCardPointerMove(e, active)}
                  onPointerLeave={handleCardPointerLeave}
                  onClick={(event) => {
                    if (didDragRef.current) return;
                    selectByIndex(index, event, { withRipple: true });
                  }}
                >
                  <span className="lp-dome-sheen" aria-hidden="true" />

                  {/* Enlarged miniature CaltDHy workspace preview */}
                  <div
                    className="lp-dome-mini"
                    style={{ background: pv.canvas, borderColor: pv.border }}
                    aria-hidden="true"
                  >
                    <div
                      className="lp-dome-mini-side"
                      style={{ background: pv.surface, borderColor: pv.border }}
                    >
                      <div className="lp-dome-mini-brand">
                        <span className="lp-dome-mini-sq" style={{ background: pv.accent }} />
                        <span className="lp-dome-mini-bline" style={{ background: pv.text }} />
                      </div>
                      <span className="lp-dome-mini-pill" style={{ background: extra.accentSoft }} />
                      <span className="lp-dome-mini-line" style={{ background: pv.muted, opacity: 0.42 }} />
                      <span className="lp-dome-mini-line lp-dome-mini-line--sm" style={{ background: pv.muted, opacity: 0.32 }} />
                      <span className="lp-dome-mini-line lp-dome-mini-line--md" style={{ background: pv.muted, opacity: 0.28 }} />
                      <span className="lp-dome-mini-div" style={{ background: pv.border }} />
                      <span className="lp-dome-mini-line lp-dome-mini-line--md" style={{ background: pv.accent, opacity: 0.56 }} />
                    </div>

                    <div className="lp-dome-mini-main">
                      <div className="lp-dome-mini-hero" style={{ background: extra.heroGrad }}>
                        <span className="lp-dome-mini-chip" />
                        <span className="lp-dome-mini-num">{sampleAmount}</span>
                        <div className="lp-dome-mini-hbars">
                          <span className="lp-dome-mini-hbar lp-dome-mini-hbar--lg" />
                          <span className="lp-dome-mini-hbar lp-dome-mini-hbar--sm" />
                        </div>
                      </div>

                      <div className="lp-dome-mini-grid">
                        <div
                          className="lp-dome-mini-panel"
                          style={{ background: pv.surface, borderColor: pv.border }}
                        >
                          <span className="lp-dome-mini-line lp-dome-mini-line--sm" style={{ background: pv.text, opacity: 0.72 }} />
                          <div className="lp-dome-mini-track" style={{ background: extra.mutedBg }}>
                            <span className="lp-dome-mini-fill" style={{ width: '72%', background: pv.accent }} />
                          </div>
                          <div className="lp-dome-mini-track" style={{ background: extra.mutedBg }}>
                            <span className="lp-dome-mini-fill" style={{ width: '54%', background: extra.success }} />
                          </div>
                        </div>

                        <div
                          className="lp-dome-mini-panel"
                          style={{ background: pv.surface, borderColor: pv.border }}
                        >
                          <div className="lp-dome-mini-bars">
                            <span className="lp-dome-mini-bar" style={{ height: '56%', background: extra.expense, opacity: 0.75 }} />
                            <span className="lp-dome-mini-bar" style={{ height: '82%', background: extra.success }} />
                            <span className="lp-dome-mini-bar" style={{ height: '48%', background: extra.expense, opacity: 0.75 }} />
                            <span className="lp-dome-mini-bar" style={{ height: '96%', background: pv.accent }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lp-theme-card-foot">
                    <div className="lp-theme-card-head">
                      <span className="lp-theme-card-title">
                        <LandingIcon name={option.id} size={16} />
                        <span>{translate(lang, option.labelKey)}</span>
                      </span>
                      {active && (
                        <span className="lp-theme-active-pill">
                          <LandingIcon name="check" size={12} strokeWidth={2.4} />
                          <span>{copy.activeTag}</span>
                        </span>
                      )}
                    </div>
                    <p className="lp-theme-card-desc">{copy.descriptions[option.id]}</p>
                    <div className="lp-dome-palette-row">
                      <span>{copy.tags?.[option.id]}</span>
                      <span className="lp-dome-swatches" aria-hidden="true">
                        <span className="lp-dome-swatch" style={{ background: pv.canvas }} />
                        <span className="lp-dome-swatch" style={{ background: pv.surface }} />
                        <span className="lp-dome-swatch" style={{ background: pv.accent }} />
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop Orbital Dome Controls */}
      <div className="lp-dome-controls">
        <button
          type="button"
          className="lp-dome-nav-btn"
          aria-label={copy.prevLabel}
          onClick={(e) => selectByIndex(activeIndex - 1, e, { withRipple: true })}
        >
          <LandingIcon name="chevronLeft" size={16} strokeWidth={2.1} />
        </button>

        <div className="lp-dome-dots" role="group" aria-label={copy.quickNavLabel}>
          {THEME_OPTIONS.map((option, index) => {
            const active = index === activeIndex;
            return (
              <button
                key={option.id}
                type="button"
                className={`lp-dome-dot-btn ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={(e) => selectByIndex(index, e, { withRipple: true })}
              >
                <LandingIcon name={option.id} size={13} />
                <span>{translate(lang, option.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="lp-dome-nav-btn"
          aria-label={copy.nextLabel}
          onClick={(e) => selectByIndex(activeIndex + 1, e, { withRipple: true })}
        >
          <LandingIcon name="chevronRight" size={16} strokeWidth={2.1} />
        </button>

        <button
          type="button"
          className="lp-dome-play-btn"
          onClick={() => setIsAutoOrbiting((prev) => !prev)}
        >
          <LandingIcon name={isAutoOrbiting ? 'pause' : 'play'} size={13} strokeWidth={2} />
          <span>{isAutoOrbiting ? copy.autoPlayStop : copy.autoPlayStart}</span>
        </button>
      </div>
    </div>
  );
}

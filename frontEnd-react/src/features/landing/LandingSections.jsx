import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { THEME_OPTIONS } from '../../utils/themes';
import { translate } from '../../i18n/translations';
import { formatCurrency } from '../../utils/formatters';
import { switchThemeWithTransition } from '../../utils/themeTransition';
import { LandingIcon } from './LandingIcons';
import { WalletCoinShowcase } from './WalletCoinShowcase';
import { buildSampleCalendar } from './landingSample';

const FLOW_BARS = [
  { inH: 66, outH: 42 },
  { inH: 72, outH: 50 },
  { inH: 68, outH: 38 },
  { inH: 82, outH: 48 },
  { inH: 76, outH: 44 },
  { inH: 92, outH: 34 },
];

export function LandingSections({
  copy,
  lang,
  theme,
  setTheme,
  isAuthenticated,
  isInviteOnly,
  onPrefetchLogin,
  onPrefetchSignup,
}) {
  const f = copy.features;
  const sampleMonths = useMemo(() => buildSampleCalendar(lang).months, [lang]);
  const th = copy.themes;
  const sec = copy.security;
  const dev = copy.devices;
  const faq = copy.faq;
  const cta = copy.finalCta;

  return (
    <>
      {/* ── SECTION 2: CORE CAPABILITY BENTO GRID ── */}
      <section id="features" className="lp-section lp-section--features">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-eyebrow">{f.eyebrow}</p>
            <h2 className="lp-section-title">{f.title}</h2>
            <p className="lp-section-sub">{f.subtitle}</p>
          </div>

          <div className="lp-bento-grid">
            {/* Card 1: Multi-wallet & fast ledger (wide) */}
            <article className="lp-bento-card lp-bento-card--wide">
              <div className="lp-bento-copy">
                <span className="lp-feature-icon">
                  <LandingIcon name="wallet" size={19} />
                </span>
                <h3 className="lp-bento-title">{f.wallets.title}</h3>
                <p className="lp-bento-desc">{f.wallets.desc}</p>
                <div className="lp-chip-row">
                  <span className="lp-meta-chip">{f.wallets.chip1}</span>
                  <span className="lp-meta-chip">{f.wallets.chip2}</span>
                </div>
              </div>
              <div className="lp-bento-visual" aria-hidden="true">
                <div className="lp-mini-ledger">
                  <div className="lp-mini-row">
                    <span className="lp-mini-dot lp-mini-dot--in" />
                    <span className="lp-mini-label">{f.wallets.tx1}</span>
                    <span className="lp-mini-amount is-pos">
                      {formatCurrency(18000000, { showSign: true, isIncome: true })}
                    </span>
                  </div>
                  <div className="lp-mini-row">
                    <span className="lp-mini-dot lp-mini-dot--out" />
                    <span className="lp-mini-label">{f.wallets.tx2}</span>
                    <span className="lp-mini-amount is-neg">
                      {formatCurrency(85000, { showSign: true })}
                    </span>
                  </div>
                  <div className="lp-mini-row">
                    <span className="lp-mini-dot lp-mini-dot--swap" />
                    <span className="lp-mini-label">{f.wallets.tx3}</span>
                    <span className="lp-mini-pill">{f.wallets.transferTag}</span>
                  </div>
                </div>
              </div>
            </article>

            {/* Card 2: Smart budgets & forecast (wide) */}
            <article className="lp-bento-card lp-bento-card--wide">
              <div className="lp-bento-copy">
                <span className="lp-feature-icon">
                  <LandingIcon name="budgets" size={19} />
                </span>
                <h3 className="lp-bento-title">{f.budgets.title}</h3>
                <p className="lp-bento-desc">{f.budgets.desc}</p>
                <div className="lp-chip-row">
                  <span className="lp-meta-chip">{f.budgets.warnTag}</span>
                </div>
              </div>
              <div className="lp-bento-visual" aria-hidden="true">
                <div className="lp-mini-budget">
                  <div className="lp-mini-budget-top">
                    <span className="lp-muted-caption">{f.budgets.dailyTag}</span>
                    <strong className="lp-mini-big">{formatCurrency(88000)}</strong>
                  </div>
                  <div className="lp-track lp-track--lg">
                    <span className="lp-fill lp-fill--success" style={{ width: '65%' }} />
                    <span className="lp-today-marker" style={{ left: '45%' }} />
                  </div>
                  <div className="lp-mini-budget-foot">
                    <span>0%</span>
                    <span>{f.budgets.todayTick} · 65%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </article>

            {/* Card 3: Savings jars */}
            <article className="lp-bento-card">
              <div className="lp-bento-copy">
                <span className="lp-feature-icon">
                  <LandingIcon name="jars" size={19} />
                </span>
                <h3 className="lp-bento-title">{f.jars.title}</h3>
                <p className="lp-bento-desc">{f.jars.desc}</p>
              </div>
              <div className="lp-bento-visual" aria-hidden="true">
                <div className="lp-mini-jars">
                  <div className="lp-mini-jar-item">
                    <div className="lp-mini-jar-top">
                      <span>{f.jars.jar1}</span>
                      <strong>68%</strong>
                    </div>
                    <div className="lp-track"><span className="lp-fill lp-fill--success" style={{ width: '68%' }} /></div>
                  </div>
                  <div className="lp-mini-jar-item">
                    <div className="lp-mini-jar-top">
                      <span>{f.jars.jar2}</span>
                      <strong>85%</strong>
                    </div>
                    <div className="lp-track"><span className="lp-fill lp-fill--info" style={{ width: '85%' }} /></div>
                  </div>
                  <span className="lp-mini-inline-note">
                    <LandingIcon name="swap" size={13} />
                    <span>{f.jars.badge}</span>
                  </span>
                </div>
              </div>
            </article>

            {/* Card 4: Recurring bills and income */}
            <article className="lp-bento-card">
              <div className="lp-bento-copy">
                <span className="lp-feature-icon">
                  <LandingIcon name="calendar" size={19} />
                </span>
                <h3 className="lp-bento-title">{f.debts.title}</h3>
                <p className="lp-bento-desc">{f.debts.desc}</p>
              </div>
              <div className="lp-bento-visual" aria-hidden="true">
                <div className="lp-mini-bills">
                  <div className="lp-mini-bill-card">
                    <div>
                      <span className="lp-mini-label">{f.debts.billLabel}</span>
                      <span className="lp-mini-sub">{formatCurrency(780000)}</span>
                    </div>
                    <span className="lp-tone-pill lp-tone-pill--primary">{f.debts.billAction}</span>
                  </div>
                  <div className="lp-mini-debt-strip">
                    <LandingIcon name="check" size={14} />
                    <span>{f.debts.incomeLabel}</span>
                  </div>
                </div>
              </div>
            </article>

            {/* Card 5: Cash flow analytics & reports */}
            <article className="lp-bento-card">
              <div className="lp-bento-copy">
                <span className="lp-feature-icon">
                  <LandingIcon name="chartLine" size={19} />
                </span>
                <h3 className="lp-bento-title">{f.analytics.title}</h3>
                <p className="lp-bento-desc">{f.analytics.desc}</p>
              </div>
              <div className="lp-bento-visual" aria-hidden="true">
                <div className="lp-mini-chart">
                  <div className="lp-mini-bars">
                    {FLOW_BARS.map((pair, idx) => (
                      <div key={sampleMonths[idx]} className="lp-mini-bar-col">
                        <div className="lp-mini-bar-pair">
                          <span className="lp-bar lp-bar--in" style={{ height: `${pair.inH}%` }} />
                          <span className="lp-bar lp-bar--out" style={{ height: `${pair.outH}%` }} />
                        </div>
                        <span className="lp-mini-month">{sampleMonths[idx]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="lp-chip-row">
                    <span className="lp-meta-chip">{f.analytics.chip2}</span>
                    <span className="lp-meta-chip">{f.analytics.chip3}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── SECTION 2B: SCROLL-REACTIVE WALLET & COINS SHOWCASE ── */}
      <WalletCoinShowcase copy={copy} />

      {/* ── SECTION 3: INTERACTIVE 4-THEME SHOWCASE ── */}
      <section id="themes" className="lp-section lp-section--themes">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-eyebrow">{th.eyebrow}</p>
            <h2 className="lp-section-title">{th.title}</h2>
            <p className="lp-section-sub">{th.subtitle}</p>
          </div>

          <div className="lp-theme-grid" role="group" aria-label={th.title}>
            {THEME_OPTIONS.map((option) => {
              const active = theme === option.id;
              const pv = option.preview;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`lp-theme-card ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                  onClick={(event) => switchThemeWithTransition(option.id, setTheme, event)}
                >
                  {/* Live miniature surface preview using exact verified palette colors */}
                  <div
                    className="lp-theme-thumb"
                    style={{ background: pv.canvas, borderColor: pv.border }}
                    aria-hidden="true"
                  >
                    <div
                      className="lp-theme-thumb-sidebar"
                      style={{ background: pv.surface, borderColor: pv.border }}
                    >
                      <span className="lp-thumb-dot" style={{ background: pv.accent }} />
                      <span className="lp-thumb-line" style={{ background: pv.muted, opacity: 0.4 }} />
                      <span className="lp-thumb-line" style={{ background: pv.muted, opacity: 0.25 }} />
                    </div>
                    <div className="lp-theme-thumb-main">
                      <div className="lp-thumb-hero" style={{ background: pv.accent }} />
                      <div
                        className="lp-thumb-card"
                        style={{ background: pv.surface, borderColor: pv.border }}
                      >
                        <span className="lp-thumb-bar" style={{ background: pv.text, opacity: 0.75 }} />
                        <span className="lp-thumb-bar lp-thumb-bar--sm" style={{ background: pv.muted, opacity: 0.45 }} />
                      </div>
                    </div>
                  </div>

                  <div className="lp-theme-card-foot">
                    <div className="lp-theme-card-head">
                      <span className="lp-theme-card-title">
                        <LandingIcon name={option.id} size={15} />
                        <span>{translate(lang, option.labelKey)}</span>
                      </span>
                      {active && (
                        <span className="lp-theme-active-pill">
                          <LandingIcon name="check" size={12} strokeWidth={2.4} />
                          <span>{th.activeTag}</span>
                        </span>
                      )}
                    </div>
                    <p className="lp-theme-card-desc">{th.descriptions[option.id]}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FINANCIAL PRECISION & SECURITY ── */}
      <section id="security" className="lp-section lp-section--security">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-eyebrow">{sec.eyebrow}</p>
            <h2 className="lp-section-title">{sec.title}</h2>
            <p className="lp-section-sub">{sec.subtitle}</p>
          </div>

          <div className="lp-security-grid">
            {sec.cards.map((card) => (
              <article key={card.title} className="lp-security-card">
                <span className="lp-feature-icon lp-feature-icon--lg">
                  <LandingIcon name={card.icon} size={20} />
                </span>
                <h3 className="lp-security-title">{card.title}</h3>
                <p className="lp-security-desc">{card.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: DESKTOP & MOBILE PWA SHOWCASE ── */}
      <section id="devices" className="lp-section lp-section--devices">
        <div className="lp-container">
          <div className="lp-device-panel">
            <div className="lp-device-copy">
              <p className="lp-eyebrow">{dev.eyebrow}</p>
              <h2 className="lp-section-title lp-section-title--left">{dev.title}</h2>
              <p className="lp-section-sub lp-section-sub--left">{dev.subtitle}</p>
              <ul className="lp-check-list">
                {dev.points.map((point) => (
                  <li key={point} className="lp-check-item">
                    <span className="lp-check-badge" aria-hidden="true">
                      <LandingIcon name="check" size={13} strokeWidth={2.4} />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-device-stage" aria-hidden="true">
              {/* Desktop mini silhouette */}
              <div className="lp-desk-frame">
                <div className="lp-desk-bar">
                  <span className="lp-desk-tag">
                    <LandingIcon name="monitor" size={13} />
                    {dev.desktopTag}
                  </span>
                  <span className="lp-kbd-pill">⌘ K</span>
                </div>
                <div className="lp-desk-body">
                  <div className="lp-desk-rail">
                    <span className="lp-rail-item is-active" />
                    <span className="lp-rail-item" />
                    <span className="lp-rail-item" />
                    <span className="lp-rail-item" />
                  </div>
                  <div className="lp-desk-content">
                    <div className="lp-desk-hero-mini">
                      <span>{formatCurrency(15095000)}</span>
                    </div>
                    <div className="lp-desk-row">
                      <span className="lp-desk-box" />
                      <span className="lp-desk-box" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Overlapping phone PWA frame */}
              <div className="lp-phone-frame">
                <div className="lp-phone-notch" />
                <div className="lp-phone-head">
                  <LandingIcon name="smartphone" size={12} />
                  <span>{dev.mobileTag}</span>
                </div>
                <div className="lp-phone-hero">
                  <span className="lp-phone-hero-lbl">{dev.mobileHeroLabel}</span>
                  <strong className="lp-phone-hero-val">{formatCurrency(15095000)}</strong>
                </div>
                <div className="lp-phone-rows">
                  <span className="lp-phone-row-bar" />
                  <span className="lp-phone-row-bar lp-phone-row-bar--short" />
                </div>
                <div className="lp-phone-dock">
                  <span className="lp-phone-dot is-active" />
                  <span className="lp-phone-dot" />
                  <span className="lp-phone-plus">+</span>
                  <span className="lp-phone-dot" />
                  <span className="lp-phone-dot" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: COMMON QUESTIONS (ACCESSIBLE NATIVE ACCORDION) ── */}
      <section id="faq" className="lp-section lp-section--faq" aria-labelledby="lp-faq-heading">
        <div className="lp-container">
          <div className="lp-faq-grid">
            <div className="lp-faq-intro">
              <span className="lp-code-pill">{faq.pill}</span>
              <h2 id="lp-faq-heading" className="lp-section-title lp-section-title--left">
                {faq.title}
              </h2>
              <p className="lp-section-sub lp-section-sub--left">{faq.subtitle}</p>
            </div>

            <div className="lp-faq-list">
              {faq.items.map((item) => (
                <details key={item.q} className="lp-faq-item">
                  <summary className="lp-faq-summary">
                    <span className="lp-faq-question">{item.q}</span>
                    <span className="lp-faq-chevron" aria-hidden="true">
                      <LandingIcon name="chevronDown" size={16} strokeWidth={2} />
                    </span>
                  </summary>
                  <div className="lp-faq-answer">
                    <p>{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: SCULPTURAL FINAL CTA WITH CIRCULAR HALO ── */}
      <section className="lp-section lp-section--cta">
        <div className="lp-container">
          <div className="lp-cta-stage">
            <div className="lp-cta-halo" aria-hidden="true">
              <svg className="lp-cta-halo-emblem" viewBox="80 80 352 372" fill="none" focusable="false">
                <path
                  d="M 151.5 242 Q 154.5 198 165.5 171.5 A 48 48 0 1 1 213.3 127.8 Q 250.5 113.5 287.7 127.8 A 48 48 0 1 1 335.5 171.5 Q 346.5 198 349.5 242"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 104 214 C 104 229 114 238 130 238 L 365 238 Q 390.5 238 390.5 263 L 390.5 398 Q 390.5 436 352.5 436 L 142 436 Q 104 436 104 398 Z"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="lp-cta-content">
              <h2 className="lp-cta-title">{isAuthenticated ? cta.titleAuth : cta.title}</h2>
              <p className="lp-cta-sub">{isAuthenticated ? cta.subtitleAuth : cta.subtitle}</p>
              <div className="lp-cta-actions">
                {isAuthenticated ? (
                  <Link to="/spending/home" className="lp-btn lp-btn--primary lp-btn--lg">
                    <span>{cta.openApp}</span>
                    <LandingIcon name="arrowRight" size={16} strokeWidth={2.1} />
                  </Link>
                ) : (
                  <>
                    <Link
                      to={isInviteOnly ? '/login' : '/signup'}
                      className="lp-btn lp-btn--primary lp-btn--lg"
                      onPointerEnter={isInviteOnly ? onPrefetchLogin : onPrefetchSignup}
                      onFocus={isInviteOnly ? onPrefetchLogin : onPrefetchSignup}
                      onTouchStart={isInviteOnly ? onPrefetchLogin : onPrefetchSignup}
                    >
                      <span>{isInviteOnly ? cta.secondary : cta.primary}</span>
                      <LandingIcon name="arrowRight" size={16} strokeWidth={2.1} />
                    </Link>
                    <Link
                      to={isInviteOnly ? '/signup' : '/login'}
                      className="lp-btn lp-btn--secondary lp-btn--lg"
                      onPointerEnter={isInviteOnly ? onPrefetchSignup : onPrefetchLogin}
                      onFocus={isInviteOnly ? onPrefetchSignup : onPrefetchLogin}
                      onTouchStart={isInviteOnly ? onPrefetchSignup : onPrefetchLogin}
                    >
                      <span>{isInviteOnly ? copy.hero.ctaInviteSignup : cta.secondary}</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

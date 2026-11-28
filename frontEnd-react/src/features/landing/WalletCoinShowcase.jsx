import React, { useEffect, useRef, useState } from 'react';
import { LandingIcon } from './LandingIcons';

/**
 * 7 CaltDHy money streams arranged in a symmetric parabolic arc above the wallet.
 * Each tile knows its tucked offset (inside the wallet behind the frosted front)
 * and left-to-right stagger delay, matching Liner's crisp bidirectional fold-in/out motion.
 */
const COIN_SLOTS = [
  { id: 'cash', icon: 'wallet', tx: '234px', ty: '82px', rot: '-18deg', delay: '0ms', reverseDelay: '180ms' },
  { id: 'bank', icon: 'precision', tx: '190px', ty: '174px', rot: '-12deg', delay: '70ms', reverseDelay: '140ms' },
  { id: 'jars', icon: 'jars', tx: '116px', ty: '246px', rot: '-6deg', delay: '140ms', reverseDelay: '95ms' },
  { id: 'income', icon: 'coin', tx: '0px', ty: '278px', rot: '0deg', delay: '210ms', reverseDelay: '50ms', featured: true },
  { id: 'budgets', icon: 'budgets', tx: '-116px', ty: '246px', rot: '6deg', delay: '280ms', reverseDelay: '95ms' },
  { id: 'recurring', icon: 'calendar', tx: '-190px', ty: '174px', rot: '12deg', delay: '350ms', reverseDelay: '140ms' },
  { id: 'reports', icon: 'chartLine', tx: '-234px', ty: '82px', rot: '18deg', delay: '420ms', reverseDelay: '180ms' },
];

const INK = '#10281C';
const CREAM = '#F5F1E3';

function GoldCoinEmblem() {
  return (
    <svg viewBox="0 0 40 40" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="16" fill="#F0B43B" stroke={INK} strokeWidth="2.6" />
      <circle cx="20" cy="20" r="10.5" stroke="#FCE394" strokeWidth="1.8" />
      <path d="M16.5 22.8c.7 1 1.9 1.6 3.5 1.6 2 0 3.3-1 3.3-2.5 0-1.4-1-2.1-3.3-2.5-2.2-.4-3.2-1.1-3.2-2.4 0-1.4 1.3-2.4 3.1-2.4 1.4 0 2.5.5 3.1 1.3M20 12.2v15.6" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

export function WalletCoinShowcase({ copy }) {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [manualState, setManualState] = useState(null); // null = follow scroll; true/false = user clicked toggle
  const w = copy.walletScene;

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setInView(true);
      return undefined;
    }

    // Bidirectional threshold observer (no once: true) so coins fan out when entering
    // and smoothly suck back into the mouse's wallet when scrolling past or back up.
    // A tap overrides scrolling until the section actually enters or leaves view;
    // crossing the in-between thresholds must not undo it.
    let wasVisible = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        if (visible === wasVisible) return;
        wasVisible = visible;
        setInView(visible);
        setManualState(null);
      },
      { threshold: [0, 0.2, 0.35, 0.55] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const expanded = manualState !== null ? manualState : inView;

  const handleToggle = () => {
    setManualState((prev) => (prev !== null ? !prev : !inView));
  };

  return (
    <section
      id="wallet-flow"
      ref={sectionRef}
      className={`lp-section lp-section--wallet ${expanded ? 'is-expanded' : 'is-tucked'}`}
      aria-labelledby="lp-wallet-heading"
    >
      <div className="lp-container">
        <div className="lp-wallet-head">
          <span className="lp-code-pill">{w.pill}</span>
          <h2 id="lp-wallet-heading" className="lp-section-title">
            {w.title}
          </h2>
          <p className="lp-section-sub">{w.subtitle}</p>
        </div>

        {/* Interactive Scroll-Driven Mascot Wallet & 7-Coin Arc Stage */}
        <div className="lp-wallet-stage">
          {/* Parabolic Arc of 7 Coins / Money Streams (z-index sits between wallet back & front!) */}
          <div className="lp-coin-arc" aria-hidden="true">
            {COIN_SLOTS.map((slot, index) => (
              <div
                key={slot.id}
                className={`lp-coin-node lp-coin-node--${index} ${slot.featured ? 'lp-coin-node--featured' : ''}`}
                style={{
                  '--coin-tx': slot.tx,
                  '--coin-ty': slot.ty,
                  '--coin-rot': slot.rot,
                  '--coin-delay': expanded ? slot.delay : slot.reverseDelay,
                }}
              >
                <span className="lp-coin-tile">
                  <span className="lp-coin-rim" />
                  {slot.featured ? (
                    <GoldCoinEmblem />
                  ) : (
                    <LandingIcon name={slot.icon} size={21} strokeWidth={1.9} />
                  )}
                </span>
                <span className="lp-coin-label">{w.coins[slot.id]}</span>
              </div>
            ))}
          </div>

          {/* CaltDHy Layered Mascot Wallet (exact paths from public/brand/caltdhy-logo-full.svg) */}
          <button
            type="button"
            className="lp-mascot-wallet"
            onClick={handleToggle}
            aria-pressed={expanded}
            aria-label={expanded ? w.actionPull : w.actionBurst}
          >
            {/* Suction Ripple Ring when mouse pulls coins back into the wallet */}
            <span className="lp-suction-ring" aria-hidden="true" />

            {/* Layer 1: Recessed Dark Wallet Back Pocket */}
            <svg
              className="lp-wallet-layer lp-wallet-layer--back"
              viewBox="80 80 352 372"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 104 226 L 104 214 Q 104 192 128 192 L 350 192 Q 373 192 373 215 L 373 244 L 104 244 Z"
                fill="#0B3D2E"
                stroke={INK}
                strokeWidth="10"
                strokeLinejoin="round"
              />
            </svg>

            {/* Layer 2: CaltDHy Cream Mouse Mascot peeking & inhaling/pulling coins */}
            <svg
              className="lp-wallet-layer lp-wallet-layer--mouse"
              viewBox="80 80 352 372"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 151.5 242 Q 154.5 198 165.5 171.5 A 48 48 0 1 1 213.3 127.8 Q 250.5 113.5 287.7 127.8 A 48 48 0 1 1 335.5 171.5 Q 346.5 198 349.5 242 Z"
                fill={CREAM}
                stroke={INK}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Cute rosy inner ears */}
              <circle cx="177" cy="145" r="18" fill="#E8D8C3" />
              <circle cx="324" cy="145" r="18" fill="#E8D8C3" />
              {/* Eyes & Rounded-Triangle Nose */}
              <circle cx="211.5" cy="189" r="9.4" fill={INK} />
              <circle cx="289.5" cy="189" r="9.4" fill={INK} />
              <circle cx="214.5" cy="186" r="2.8" fill="#FFFFFF" />
              <circle cx="292.5" cy="186" r="2.8" fill="#FFFFFF" />
              <path
                d="M 239 204.5 Q 250.5 200.5 262 204.5 Q 263.4 207 259.2 212.8 Q 253.8 219 250.5 219 Q 247.2 219 241.8 212.8 Q 237.6 207 239 204.5 Z"
                fill={INK}
              />
              {/* Subtle "O" inhale mouth visible while pulling coins back into the wallet */}
              <circle className="lp-mouse-inhale" cx="250.5" cy="224" r="5.6" fill={INK} />
            </svg>

            {/* Layer 3: Frosted Translucent Pocket Glass Overlay (blurs coins sliding behind!) */}
            <div className="lp-wallet-frost" aria-hidden="true" />

            {/* Layer 4: Wallet Front Body + Clasp + Golden Coin Button */}
            <svg
              className="lp-wallet-layer lp-wallet-layer--front"
              viewBox="80 80 352 372"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M 104 214 C 104 229 114 238 130 238 L 365 238 Q 390.5 238 390.5 263 L 390.5 398 Q 390.5 436 352.5 436 L 142 436 Q 104 436 104 398 Z"
                fill="rgba(84, 180, 140, 0.66)"
                stroke={INK}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Stitched ledger detail lines near bottom */}
              <line x1="138" y1="398" x2="352" y2="398" stroke="#1E6B4F" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.45" />
              <line x1="158" y1="414" x2="332" y2="414" stroke="#1E6B4F" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.3" />
              {/* Clasp Tab */}
              <path
                d="M 337 302 L 396 302 Q 408 302 408 314 L 408 362 Q 408 374 396 374 L 337 374 A 36 36 0 0 1 337 302 Z"
                fill="#398F6C"
                stroke={INK}
                strokeWidth="10"
                strokeLinejoin="round"
              />
              {/* Golden Clasp Coin */}
              <g className="lp-wallet-clasp-coin">
                <circle cx="337" cy="338" r="23" fill="#F0B43B" stroke={INK} strokeWidth="5" />
                <circle cx="337" cy="338" r="15" stroke="#FCE394" strokeWidth="2.5" strokeOpacity="0.85" />
              </g>
            </svg>
          </button>
        </div>
        <p className="lp-wallet-hint" aria-hidden="true">{w.hint}</p>
      </div>
    </section>
  );
}

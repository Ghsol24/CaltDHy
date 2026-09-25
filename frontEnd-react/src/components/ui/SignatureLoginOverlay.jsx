import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from '../../i18n/useTranslation';
import { useSignatureLoginStore } from '../../stores/useSignatureLoginStore';
import '../../assets/css/signature-loader.css';

const CONNECT_MS = 1000;
const VERIFY_MS = 1400;
const ASYMPTOTE_TAU_MS = 12000;
const SNAP_MS = 250;
const FLIGHT_MS = 420;
const BAR_COUNT = 9;

function progressAt(elapsed) {
  if (elapsed < CONNECT_MS) return 33 * elapsed / CONNECT_MS;
  if (elapsed < CONNECT_MS + VERIFY_MS) {
    return 33 + 37 * (elapsed - CONNECT_MS) / VERIFY_MS;
  }
  const waiting = elapsed - CONNECT_MS - VERIFY_MS;
  return Math.min(99, 70 + 29.9 * (1 - Math.exp(-waiting / ASYMPTOTE_TAU_MS)));
}

function RunnerScene({ cubeRef }) {
  return (
    <div className="signature-login__scene" aria-hidden="true">
      <svg className="signature-login__svg" viewBox="0 0 640 300" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="signature-bar-gradient" x1="0" y1="1" x2="0" y2="0">
            <stop className="signature-login__gradient-start" offset="0" />
            <stop className="signature-login__gradient-end" offset="1" />
          </linearGradient>
          <linearGradient id="signature-bar-side" x1="0" y1="0" x2="1" y2="0">
            <stop className="signature-login__side-start" offset="0" />
            <stop className="signature-login__side-end" offset="1" />
          </linearGradient>
        </defs>
        <path className="signature-login__floor" d="M26 251H614" />
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <g className="signature-login__bar" key={index}
            style={{ animationDelay: `${-0.4 - index * 0.8}s`,
              '--static-x': `${(index - 4) * 62}px`,
              '--static-height': 1 - Math.abs(index - 4) * 0.18 }}>
            <rect x="298" y="125" width="39" height="125" rx="7" fill="url(#signature-bar-gradient)" />
            <path d="M337 132Q337 125 330 125L344 131Q350 134 350 140V241Q350 249 343 250H337Z"
              fill="url(#signature-bar-side)" />
            <path d="M302 125H331Q337 125 337 132H298Q298 125 302 125Z"
              className="signature-login__bar-top" />
          </g>
        ))}
        <ellipse className="signature-login__landing-glow" cx="320" cy="125" rx="35" ry="8" />
        {Array.from({ length: 6 }, (_, index) => (
          <circle className="signature-login__particle" key={index} cx="320" cy="124" r="2.3"
            style={{ '--particle-x': `${Math.round(Math.cos(index * Math.PI / 3) * 48)}px`,
              '--particle-y': `${Math.round(Math.sin(index * Math.PI / 3) * 28 - 15)}px` }} />
        ))}
      </svg>
      <div className="signature-login__ghost signature-login__ghost--first">C</div>
      <div className="signature-login__ghost signature-login__ghost--second">C</div>
      <div ref={cubeRef} className="signature-login__cube">C</div>
    </div>
  );
}

function SignatureLoginAttempt({ attemptId, state, startedAt }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const close = useSignatureLoginStore((store) => store.close);
  const [progress, setProgress] = useState(0);
  const [arriving, setArriving] = useState(false);
  const [exiting, setExiting] = useState(false);
  const progressRef = useRef(0);
  const snapPhaseRef = useRef('idle');
  const cubeRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    overlayRef.current?.focus();
    const route = document.querySelector('.auth-page');
    if (route) route.inert = true;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (route) route.inert = false;
      document.body.style.overflow = priorOverflow;
    };
  }, []);

  useEffect(() => {
    if (state !== 'pending') return undefined;
    const update = () => {
      const next = progressAt(Math.max(0, performance.now() - startedAt));
      progressRef.current = next;
      setProgress(next);
    };
    update();
    const timer = window.setInterval(update, 80);
    return () => window.clearInterval(timer);
  }, [state, startedAt]);

  useEffect(() => {
    if (state !== 'failure') return undefined;
    setExiting(true);
    const timer = window.setTimeout(() => close(attemptId), 180);
    return () => window.clearTimeout(timer);
  }, [state, attemptId, close]);

  useEffect(() => {
    if (state !== 'success' || snapPhaseRef.current !== 'idle') return undefined;
    snapPhaseRef.current = 'running';
    const from = progressRef.current;
    let frame = null;
    let completed = false;
    const started = performance.now();
    const step = (now) => {
      const fraction = Math.min(1, (now - started) / SNAP_MS);
      const eased = 1 - (1 - fraction) ** 3;
      const next = from + (100 - from) * eased;
      progressRef.current = next;
      setProgress(next);
      if (fraction < 1) frame = requestAnimationFrame(step);
      else {
        completed = true;
        snapPhaseRef.current = 'done';
        navigate('/spending/home', { replace: true });
      }
    };
    if (document.hidden) {
      progressRef.current = 100;
      setProgress(100);
      completed = true;
      snapPhaseRef.current = 'done';
      navigate('/spending/home', { replace: true });
    } else {
      frame = requestAnimationFrame(step);
    }
    return () => {
      if (!completed) {
        if (frame !== null) cancelAnimationFrame(frame);
        snapPhaseRef.current = 'idle';
      }
    };
  }, [state, navigate]);

  useEffect(() => {
    if (state !== 'success' || !location.pathname.startsWith('/spending')) return undefined;
    const cubeNode = cubeRef.current;
    let observer = null;
    let fallbackTimer = null;
    let closeTimer = null;
    let animationEndHandler = null;
    let target = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (target) target.style.opacity = '';
      if (cubeRef.current) cubeRef.current.style.visibility = 'hidden';
      setExiting(true);
      closeTimer = window.setTimeout(() => close(attemptId), 180);
    };

    const findTarget = () => {
      const cube = cubeNode;
      const icon = document.querySelector('.topbar .tb-logo-link .tb-logo-icon');
      if (!cube || !icon) return;
      observer?.disconnect();
      window.clearTimeout(fallbackTimer);
      target = icon;
      if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }

      const scene = cube.parentElement.getBoundingClientRect();
      const destination = icon.getBoundingClientRect();
      const dx = destination.left + destination.width / 2 - scene.left - scene.width / 2;
      const dy = destination.top + destination.height / 2 - scene.top - scene.height * .2 - cube.offsetHeight / 2;
      const scale = destination.width / cube.offsetWidth;
      target.style.opacity = '0';
      cube.style.setProperty('--signature-start-transform', getComputedStyle(cube).transform);
      cube.style.setProperty('--signature-arrival-x', `${dx}px`);
      cube.style.setProperty('--signature-arrival-y', `${dy}px`);
      cube.style.setProperty('--signature-arrival-scale', String(scale));
      animationEndHandler = (event) => {
        if (event.animationName === 'signature-cube-arrival') finish();
      };
      cube.addEventListener('animationend', animationEndHandler);
      setArriving(true);
      fallbackTimer = window.setTimeout(finish, FLIGHT_MS + 160);
    };

    findTarget();
    if (!target) {
      observer = new MutationObserver(findTarget);
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
      fallbackTimer = window.setTimeout(finish, 2000);
    }
    return () => {
      observer?.disconnect();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(closeTimer);
      if (animationEndHandler) cubeNode?.removeEventListener('animationend', animationEndHandler);
      if (target) target.style.opacity = '';
    };
  }, [state, location.pathname, attemptId, close]);

  const complete = state === 'success';
  const message = complete ? t('auth.signatureSuccess')
    : progress < 33 ? t('auth.signatureConnecting') : t('auth.signatureVerifying');
  const shownProgress = complete && progress >= 99.95 ? '100'
    : progress < 70 ? String(Math.floor(progress)) : progress.toFixed(1);

  return (
    <div ref={overlayRef} className={`signature-login${complete ? ' is-success' : ''}${arriving ? ' is-arriving' : ''}${exiting ? ' is-exiting' : ''}`}
      role="dialog" aria-modal="true" aria-label={t('auth.signatureTitle')} tabIndex={-1}
      onKeyDown={(event) => { if (event.key === 'Tab') event.preventDefault(); }}>
      <div className="signature-login__content">
        <header className="signature-login__header">
          <h1>{t('auth.signatureTitle')}</h1>
          <p>{t('auth.signatureSubtitle')}</p>
          <div className="signature-login__beats" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
          </div>
        </header>

        <RunnerScene cubeRef={cubeRef} />

        <div className="signature-login__progress-wrap">
          <div className="signature-login__progress-caption">
            <span role="status" aria-live="polite">{message}</span>
            <strong aria-hidden="true">{shownProgress}%</strong>
          </div>
          <div className="signature-login__progress-track" role="progressbar"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.floor(progress)}
            aria-valuetext={`${message} ${shownProgress}%`}>
            <span className="signature-login__progress-fill" style={{ '--signature-progress': progress / 100 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignatureLoginOverlay() {
  const attemptId = useSignatureLoginStore((store) => store.attemptId);
  const state = useSignatureLoginStore((store) => store.state);
  const startedAt = useSignatureLoginStore((store) => store.startedAt);
  if (state === 'idle') return null;
  return <SignatureLoginAttempt key={attemptId} attemptId={attemptId}
    state={state} startedAt={startedAt} />;
}

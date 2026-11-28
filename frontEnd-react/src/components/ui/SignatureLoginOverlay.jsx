import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from '../../i18n/useTranslation';
import { useSignatureLoginStore } from '../../stores/useSignatureLoginStore';
import { AmbientCoins, CoinRainScene } from './signatureCoinRain';
import { flyToMark, hideInWallet, landOnMark, lockWallet, startCoinRain } from './signatureCoinMotion';
import './signature-loader.css';

const CONNECT_MS = 1000;
const VERIFY_MS = 1400;
const ASYMPTOTE_TAU_MS = 12000;
const SNAP_MS = 250;
const FLIGHT_MS = 640;
// Đăng nhập nhanh vẫn kịp thấy chuột hứng và bỏ đồng xu đầu tiên vào ví.
const MIN_SHOW_MS = 1000;

function progressAt(elapsed) {
  if (elapsed < CONNECT_MS) return 33 * elapsed / CONNECT_MS;
  if (elapsed < CONNECT_MS + VERIFY_MS) {
    return 33 + 37 * (elapsed - CONNECT_MS) / VERIFY_MS;
  }
  const waiting = elapsed - CONNECT_MS - VERIFY_MS;
  return Math.min(99, 70 + 29.9 * (1 - Math.exp(-waiting / ASYMPTOTE_TAU_MS)));
}

const motionOff = () => document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const COPY_KEYS = {
  login: { title: 'auth.signatureTitle', connecting: 'auth.signatureConnecting', verifying: 'auth.signatureVerifying', success: 'auth.signatureSuccess' },
  signup: { title: 'auth.signatureTitleNew', connecting: 'auth.signatureCreating', verifying: 'auth.signaturePreparing', success: 'auth.signatureSuccessNew' },
};

function SignatureLoginAttempt({ attemptId, state, startedAt, kind }) {
  const { t } = useTranslation();
  const keys = COPY_KEYS[kind] || COPY_KEYS.login;
  const navigate = useNavigate();
  const location = useLocation();
  const close = useSignatureLoginStore((store) => store.close);
  const [progress, setProgress] = useState(0);
  const [arriving, setArriving] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [quiet] = useState(motionOff);
  const progressRef = useRef(0);
  const snapPhaseRef = useRef('idle');
  const characterRef = useRef(null);
  const backdropRef = useRef(null);
  const overlayRef = useRef(null);
  const rainRef = useRef(null);
  const lockRef = useRef(null);

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

  // Mưa xu chạy từ lúc mở overlay; "giảm chuyển động" thì giữ tư thế nghỉ đứng yên.
  useEffect(() => {
    if (quiet || !characterRef.current) return undefined;
    const rain = startCoinRain(characterRef.current);
    rainRef.current = rain;
    return () => {
      rain.stop();
      rainRef.current = null;
    };
  }, [quiet]);

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
    let cancelled = false;
    let timer = null;
    const leave = () => {
      if (cancelled) return;
      setExiting(true);
      timer = window.setTimeout(() => close(attemptId), 180);
    };
    const rain = rainRef.current;
    if (rain && !motionOff()) rain.freeze().then(() => hideInWallet(rain.layer)).then(leave);
    else leave();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, attemptId, close]);

  useEffect(() => {
    if (state !== 'success' || snapPhaseRef.current !== 'idle') return undefined;
    snapPhaseRef.current = 'running';
    const from = progressRef.current;
    let frame = null;
    let completed = false;
    const skipMotion = motionOff();
    const delay = Math.max(0, MIN_SHOW_MS - SNAP_MS - (performance.now() - startedAt));
    const started = performance.now() + delay;
    let timer = null;
    const done = () => {
      completed = true;
      snapPhaseRef.current = 'done';
      // Chuột thụt vào và khoá ví trong lúc trang Home đang được dựng phía sau.
      const rain = rainRef.current;
      if (rain && !skipMotion) lockRef.current = rain.freeze().then(() => lockWallet(rain.layer));
      navigate('/spending/home', { replace: true });
    };
    const step = (now) => {
      const fraction = Math.min(1, (now - started) / SNAP_MS);
      const eased = 1 - (1 - fraction) ** 3;
      const next = from + (100 - from) * eased;
      progressRef.current = next;
      setProgress(next);
      if (fraction < 1) frame = requestAnimationFrame(step);
      else done();
    };
    if (skipMotion) {
      progressRef.current = 100;
      setProgress(100);
      done();
    } else {
      timer = window.setTimeout(() => { frame = requestAnimationFrame(step); }, delay);
    }
    return () => {
      window.clearTimeout(timer);
      if (!completed) {
        if (frame !== null) cancelAnimationFrame(frame);
        snapPhaseRef.current = 'idle';
      }
    };
  }, [state, startedAt, navigate]);

  useEffect(() => {
    if (state !== 'success' || !location.pathname.startsWith('/spending')) return undefined;
    let observer = null;
    let fallbackTimer = null;
    let closeTimer = null;
    let target = null;
    let finished = false;
    let cancelled = false;
    let landed = false;

    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      if (target) {
        target.style.opacity = '';
        if (landed) landOnMark(target);
      }
      if (characterRef.current) characterRef.current.style.visibility = 'hidden';
      setExiting(true);
      closeTimer = window.setTimeout(() => close(attemptId), 180);
    };
    const fly = async () => {
      await (lockRef.current ?? Promise.resolve());
      if (cancelled || finished || !characterRef.current) return;
      target.style.opacity = '0';
      setArriving(true);
      await flyToMark({ character: characterRef.current, layer: rainRef.current.layer,
        backdrop: backdropRef.current, mark: target, duration: FLIGHT_MS });
      landed = true;
      finish();
    };

    const findTarget = () => {
      // Logo đang hiển thị: trong sidebar trên máy tính, trên topbar ở điện thoại (đợt 15b).
      const icon = [...document.querySelectorAll('[data-brand-mark]')]
        .find((node) => node.getClientRects().length > 0);
      if (!icon || !characterRef.current) return;
      observer?.disconnect();
      window.clearTimeout(fallbackTimer);
      target = icon;
      if (motionOff() || !rainRef.current) {
        finish();
        return;
      }
      // Lưới an toàn: khoá ví + bay không bao giờ giữ người dùng quá lâu.
      fallbackTimer = window.setTimeout(finish, 1200 + FLIGHT_MS + 600);
      fly();
    };

    findTarget();
    if (!target) {
      observer = new MutationObserver(findTarget);
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
      fallbackTimer = window.setTimeout(finish, 2000);
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(closeTimer);
      if (target) target.style.opacity = '';
    };
  }, [state, location.pathname, attemptId, close]);

  const complete = state === 'success';
  const message = complete ? t(keys.success)
    : progress < 33 ? t(keys.connecting) : t(keys.verifying);
  const shownProgress = complete && progress >= 99.95 ? '100'
    : progress < 70 ? String(Math.floor(progress)) : progress.toFixed(1);

  return (
    <div ref={overlayRef} className={`signature-login${complete ? ' is-success' : ''}${state === 'failure' ? ' is-failure' : ''}${arriving ? ' is-arriving' : ''}${exiting ? ' is-exiting' : ''}`}
      role="dialog" aria-modal="true" aria-label={t(keys.title)} tabIndex={-1}
      onKeyDown={(event) => { if (event.key === 'Tab') event.preventDefault(); }}>
      <div ref={backdropRef} className="signature-login__backdrop" aria-hidden="true" />
      {!quiet && <AmbientCoins />}
      <div className="signature-login__content">
        <header className="signature-login__header">
          <h1>{t(keys.title)}</h1>
          <div className="signature-login__beats" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
          </div>
        </header>

        <CoinRainScene characterRef={characterRef} />

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
  const kind = useSignatureLoginStore((store) => store.kind);
  if (state === 'idle') return null;
  // Keep the full-screen layer independent of route layout and stacking contexts.
  return createPortal(<SignatureLoginAttempt key={attemptId} attemptId={attemptId}
    state={state} startedAt={startedAt} kind={kind} />, document.body);
}

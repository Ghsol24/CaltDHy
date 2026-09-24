import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useSpendingStore } from '../../stores/useSpendingStore';
import { buildSpendingPath, getSpendingRouteMeta, parseSpendingPath } from '../../navigation/spendingRoutes';
import { useTranslation } from '../../i18n/useTranslation';

function focusRouteContent(route) {
  const { focus } = getSpendingRouteMeta(route);
  const startedAt = performance.now();
  let frameId;

  const findAndFocus = () => {
    const target = document.querySelector(focus);
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      if (route.subTab) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      target.focus({ preventScroll: true });
      return;
    }
    if (performance.now() - startedAt < 2000) frameId = requestAnimationFrame(findAndFocus);
  };

  frameId = requestAnimationFrame(findAndFocus);
  return () => cancelAnimationFrame(frameId);
}

export function SpendingRouteSync() {
  const { t, lang } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const route = parseSpendingPath(location.pathname);
  const routeRevision = useSpendingStore((state) => state.routeRevision);
  const syncFromRoute = useSpendingStore((state) => state.syncFromRoute);
  const applyingLocation = useRef(false);

  useEffect(() => {
    if (!route) return undefined;
    const canonicalPath = buildSpendingPath({
      activeView: route.view,
      planSubTab: route.view === 'plan' ? route.subTab : 'overview',
      analyticsSubTab: route.view === 'analytics' ? route.subTab : 'overview',
      jarsSubTab: route.view === 'jars' ? route.subTab : 'goals'
    });
    if (canonicalPath !== location.pathname) {
      navigate(canonicalPath, { replace: true });
      return undefined;
    }
    applyingLocation.current = true;
    syncFromRoute(route.view, route.subTab);
    const meta = getSpendingRouteMeta(route);
    document.title = `${t(meta.titleKey)} – CaltDHy`;
    const stopFocus = focusRouteContent(route);
    const timerId = window.setTimeout(() => { applyingLocation.current = false; }, 0);
    return () => {
      stopFocus();
      window.clearTimeout(timerId);
      applyingLocation.current = false;
    };
  }, [location.pathname, navigate, route?.view, route?.subTab, syncFromRoute, t, lang]);

  useEffect(() => {
    if (applyingLocation.current || routeRevision === 0) return;
    const state = useSpendingStore.getState();
    const nextPath = buildSpendingPath(state);
    if (nextPath !== location.pathname) {
      navigate(nextPath, { replace: state.routeMode === 'replace' });
    }
  }, [routeRevision, location.pathname, navigate]);

  if (!route) return <Navigate to="/spending/home" replace />;
  return null;
}

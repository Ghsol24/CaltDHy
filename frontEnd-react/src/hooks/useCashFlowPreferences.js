import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useSpendingStore } from '../stores/useSpendingStore';
import { sessionEpoch, sessionChangedError } from '../services/sessionRuntime';
import {
  cashFlowEntryView, normalizeCashFlowPreferences, sameCashFlowView, updateCashFlowView,
} from '../utils/cashFlowPreferences';

const ownerKey = () => `${sessionEpoch()}:${useAuthStore.getState().user?.id || ''}`;

function initialRuntime(owner, preferences, active) {
  const saved = normalizeCashFlowPreferences(preferences?.cashFlow);
  return {
    owner, active, view: cashFlowEntryView(preferences), committedView: cashFlowEntryView(preferences),
    lastUsed: saved.lastUsed, pinnedDefault: saved.pinnedDefault,
    committedLastUsed: saved.lastUsed, committedDefault: saved.pinnedDefault,
    fallback: cashFlowEntryView({ analyticsExcludeRecurring: preferences?.analyticsExcludeRecurring }),
    lastRevision: 0, pinRevision: 0, viewRevision: 0, pending: 0,
  };
}

const snapshot = runtime => ({
  owner: runtime.owner, view: runtime.view, pinnedDefault: runtime.pinnedDefault,
  saving: runtime.pending > 0,
});

/** Persist intentional view choices only; chart drilldown belongs to the caller. */
export function useCashFlowPreferences({ active = true } = {}) {
  const user = useAuthStore(state => state.user);
  const owner = `${sessionEpoch()}:${user?.id || ''}`;
  const runtimeRef = useRef(null);
  if (!runtimeRef.current) runtimeRef.current = initialRuntime(owner, user?.preferences, active);
  const [state, setState] = useState(() => snapshot(runtimeRef.current));
  const mountedRef = useRef(false);

  const publish = useCallback(runtime => {
    if (!mountedRef.current || runtimeRef.current !== runtime || ownerKey() !== runtime.owner) return;
    if (runtime.active) {
      useSpendingStore.getState().setAnalyticsExcludeRecurring(runtime.view.excludeRecurring);
    }
    setState(snapshot(runtime));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let runtime = runtimeRef.current;
    if (runtime.owner !== owner) {
      runtime = initialRuntime(owner, user?.preferences, active);
      runtimeRef.current = runtime;
    } else if (active && !runtime.active) {
      // A fresh entry applies the pinned default before the last deliberate choice.
      runtime.view = runtime.pinnedDefault || runtime.lastUsed || runtime.fallback;
      runtime.committedView = runtime.committedDefault || runtime.committedLastUsed || runtime.fallback;
      runtime.viewRevision += 1;
    }
    runtime.active = active;
    publish(runtime);
  }, [owner, active, user?.preferences, publish]);

  const currentRuntime = useCallback(() => {
    const runtime = runtimeRef.current;
    if (runtime.owner !== owner || ownerKey() !== owner || !useAuthStore.getState().user?.id) {
      throw sessionChangedError();
    }
    return runtime;
  }, [owner]);

  const save = useCallback(async (runtime, update, success, failure) => {
    runtime.pending += 1;
    publish(runtime);
    try {
      const result = await useAuthStore.getState().updatePreferences(update);
      if (runtimeRef.current === runtime && ownerKey() === runtime.owner) success(result.preferences);
      return result;
    } catch (error) {
      if (runtimeRef.current === runtime && ownerKey() === runtime.owner) failure();
      throw error;
    } finally {
      runtime.pending -= 1;
      publish(runtime);
    }
  }, [publish]);

  const setView = useCallback(async update => {
    const runtime = currentRuntime();
    const next = updateCashFlowView(runtime.view, update);
    if (sameCashFlowView(runtime.view, next)) return;
    const revision = ++runtime.lastRevision;
    const viewRevision = ++runtime.viewRevision;
    runtime.view = next;
    runtime.lastUsed = next;
    return save(runtime, {
      analyticsExcludeRecurring: next.excludeRecurring,
      cashFlow: { lastUsed: next },
    }, preferences => {
      runtime.committedLastUsed = normalizeCashFlowPreferences(preferences.cashFlow).lastUsed || next;
      runtime.committedView = runtime.committedLastUsed;
    }, () => {
      if (runtime.lastRevision !== revision) return;
      runtime.lastUsed = runtime.committedLastUsed;
      if (runtime.viewRevision === viewRevision) {
        runtime.view = runtime.committedView;
      }
    });
  }, [currentRuntime, save]);

  const pinDefault = useCallback(async viewOverride => {
    const runtime = currentRuntime();
    // A caller may be inspecting a temporary chart drilldown. Pin its visible
    // mode in one write, leaving the last deliberate view and current view intact.
    const next = viewOverride === undefined ? { ...runtime.view }
      : updateCashFlowView(runtime.view, viewOverride);
    if (sameCashFlowView(runtime.pinnedDefault, next)) return;
    const revision = ++runtime.pinRevision;
    runtime.pinnedDefault = next;
    return save(runtime, { cashFlow: { pinnedDefault: next } }, () => {
      runtime.committedDefault = next;
    }, () => {
      if (runtime.pinRevision === revision) runtime.pinnedDefault = runtime.committedDefault;
    });
  }, [currentRuntime, save]);

  const clearDefault = useCallback(async () => {
    const runtime = currentRuntime();
    if (!runtime.pinnedDefault) return;
    const previousView = runtime.view;
    const revision = ++runtime.pinRevision;
    const viewRevision = ++runtime.viewRevision;
    runtime.pinnedDefault = null;
    runtime.view = runtime.lastUsed || runtime.fallback;
    return save(runtime, { cashFlow: { pinnedDefault: null } }, () => {
      runtime.committedDefault = null;
      runtime.committedView = runtime.committedLastUsed || runtime.fallback;
    }, () => {
      if (runtime.pinRevision !== revision) return;
      runtime.pinnedDefault = runtime.committedDefault;
      if (runtime.viewRevision === viewRevision) runtime.view = previousView;
    });
  }, [currentRuntime, save]);

  // Avoid one render of the previous account's preferences during a session switch.
  const visible = state.owner === owner ? state : snapshot(initialRuntime(owner, user?.preferences, active));
  return { view: visible.view, pinnedDefault: visible.pinnedDefault, saving: visible.saving,
    setView, pinDefault, clearDefault };
}

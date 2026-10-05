import { create } from 'zustand';
import { authService } from '../services/authService';
import { apiFetch, clearApiSession } from '../services/api';
import { invalidateSession, sessionEpoch, assertSession, sessionChangedError } from '../services/sessionRuntime';
import { normalizeCashFlowPreferences, isCashFlowView } from '../utils/cashFlowPreferences';
import { useTransactionStore } from './useTransactionStore';
import { useWalletStore } from './useWalletStore';
import { useJarStore } from './useJarStore';
import { useSpendingStore } from './useSpendingStore';
import { useToastStore } from './useToastStore';
import { useConfirmStore } from './useConfirmStore';

const EVENT_KEY = 'caltdhy_session_event';
const LOGOUT_KEY = 'caltdhy_logout_pending';
let preferencesQueue = Promise.resolve();
const storage = {
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
  remove: key => { try { localStorage.removeItem(key); } catch {} }
};
function hydrateUserPreferences(user) {
  useSpendingStore.getState().hydrateAnalyticsExcludeRecurring(
    user?.preferences?.analyticsExcludeRecurring
  );
}
function clearPrivateState() {
  invalidateSession(); clearApiSession();
  preferencesQueue = Promise.resolve();
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('caltdhy_') && !['caltdhy_theme', 'caltdhy_lang', 'caltdhy_curr', EVENT_KEY, LOGOUT_KEY].includes(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
  useConfirmStore.getState().closeConfirm();
  for (const store of [useTransactionStore, useWalletStore, useJarStore, useSpendingStore, useToastStore, useConfirmStore]) {
    store.setState(store.getInitialState(), true);
  }
}
const broadcast = () => storage.set(EVENT_KEY, crypto.randomUUID());
let initialization;
export const useAuthStore = create((set, get) => ({
  user: null, isAuthenticated: false, isLoading: false, status: 'checking', error: null,
  initialize: async () => {
    const epoch = sessionEpoch();
    if (initialization?.epoch === epoch) return initialization.promise;
    const current = { epoch };
    current.promise = (async () => {
      try {
        if (storage.get(LOGOUT_KEY)) {
          await apiFetch('/api/auth/logout', { method: 'POST' });
          assertSession(epoch);
          set({ status: 'anonymous', user: null, isAuthenticated: false });
          return;
        }
        const data = await apiFetch('/api/auth/session');
        assertSession(epoch);
        hydrateUserPreferences(data.user);
        set({ user: data.user, isAuthenticated: true, status: 'authenticated', error: null });
      } catch (error) {
        if (sessionEpoch() !== epoch) return;
        hydrateUserPreferences(null);
        set({ user: null, isAuthenticated: false, status: 'anonymous',
          error: error.status === 401 ? null : error.message });
      } finally { if (initialization === current) initialization = null; }
    })();
    initialization = current;
    return current.promise;
  },
  login: async (email, password, { signal } = {}) => {
    clearPrivateState();
    const epoch = sessionEpoch();
    set({ user: null, isAuthenticated: false, status: 'checking', isLoading: true, error: null });
    try {
      const data = await authService.login({ email, password }, { signal });
      assertSession(epoch);
      if (signal?.aborted) throw new DOMException('Login cancelled', 'AbortError');
      storage.remove(LOGOUT_KEY);
      hydrateUserPreferences(data.user);
      set({ user: data.user, isAuthenticated: true, status: 'authenticated', isLoading: false });
      broadcast();
      return { success: true, user: data.user };
    } catch (error) {
      if (epoch === sessionEpoch()) set({ status: 'anonymous', isLoading: false, error: error.message });
      throw error;
    }
  },
  register: async (name, email, password, inviteToken) => {
    clearPrivateState();
    const epoch = sessionEpoch();
    set({ user: null, isAuthenticated: false, status: 'checking', isLoading: true });
    try {
      const data = await authService.register({ name, email, password, inviteToken });
      assertSession(epoch);
      storage.remove(LOGOUT_KEY);
      hydrateUserPreferences(data.user);
      set({ user: data.user, isAuthenticated: true, status: 'authenticated', isLoading: false });
      broadcast();
      return { success: true, user: data.user };
    } catch (error) {
      if (epoch === sessionEpoch()) set({ status: 'anonymous', isLoading: false, error: error.message });
      throw error;
    }
  },
  logout: async () => {
    storage.set(LOGOUT_KEY, '1');
    clearPrivateState();
    initialization = null;
    const epoch = sessionEpoch();
    set({ user: null, isAuthenticated: false, status: 'anonymous', isLoading: false, error: null });
    broadcast();
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); }
    catch {
      if (sessionEpoch() === epoch) {
        set({ error: 'Đã khóa dữ liệu trên thiết bị. Cần kết nối mạng để thu hồi phiên trên server.' });
      }
    }
    // Keep the local logout barrier until a deliberate, successful login.
  },
  expire: () => {
    clearPrivateState();
    initialization = null;
    set({ user: null, isAuthenticated: false, status: 'anonymous', isLoading: false });
  },
  updateProfile: async profileData => {
    const epoch = sessionEpoch();
    set({ isLoading: true });
    try {
      const data = await authService.updateProfile(profileData);
      assertSession(epoch);
      set({ user: data.user, isLoading: false });
      broadcast();
      return { success: true, user: data.user };
    } catch (error) {
      if (epoch === sessionEpoch()) set({ isLoading: false });
      throw error;
    }
  },
  updatePreferences: preferencesUpdate => {
    const epoch = sessionEpoch();
    const userId = get().user?.id;
    const update = structuredClone(preferencesUpdate);
    const operation = preferencesQueue.catch(() => {}).then(async () => {
      assertSession(epoch);
      if (!userId || get().user?.id !== userId) throw sessionChangedError();
      const data = await authService.updatePreferences(update);
      assertSession(epoch);
      if (get().user?.id !== userId) throw sessionChangedError();
      const received = data.preferences;
      const cashFlow = received?.cashFlow;
      if (typeof received?.analyticsExcludeRecurring !== 'boolean' ||
          (cashFlow !== undefined && (!cashFlow || Array.isArray(cashFlow) ||
            Object.keys(cashFlow).length !== 2 ||
            !Object.prototype.hasOwnProperty.call(cashFlow, 'lastUsed') ||
            !Object.prototype.hasOwnProperty.call(cashFlow, 'pinnedDefault') ||
            (cashFlow.lastUsed !== null && !isCashFlowView(cashFlow.lastUsed)) ||
            (cashFlow.pinnedDefault !== null && !isCashFlowView(cashFlow.pinnedDefault))))) {
        throw new Error('Invalid preferences response.');
      }
      const preferences = { ...(get().user?.preferences || {}), ...received,
        ...(cashFlow !== undefined ? { cashFlow: normalizeCashFlowPreferences(cashFlow) } : {}) };
      set((state) => state.user?.id === userId ? { user: { ...state.user, preferences } } : state);
      hydrateUserPreferences({ preferences });
      return { success: true, preferences };
    });
    preferencesQueue = operation;
    return operation;
  }
}));
clearPrivateState();
window.addEventListener('storage', event => {
  if (![EVENT_KEY, LOGOUT_KEY].includes(event.key)) return;
  useAuthStore.getState().expire();
  if (!storage.get(LOGOUT_KEY)) {
    useAuthStore.setState({ status: 'checking' });
    void useAuthStore.getState().initialize();
  }
});

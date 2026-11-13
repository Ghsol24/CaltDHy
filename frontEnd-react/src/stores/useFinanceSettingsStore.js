import { create } from 'zustand';
import { extrasService as spendingService } from '../services/extrasService';
import { sessionEpoch, scopedSet } from '../services/sessionRuntime';
import { useAuthStore } from './useAuthStore';

const EMPTY = { savedFilters: [], budget: { totalLimit: 0, weeklyLimit: 0, rollover: false } };
let request = null;

/** Saved history filters and advanced budget options (one small document per account). */
export const useFinanceSettingsStore = create((storeSet, get) => ({
  ...EMPTY, loaded: false,
  load: async ({ force = false } = {}) => {
    if (get().loaded && !force) return;
    const epoch = sessionEpoch();
    if (request?.epoch === epoch) return request.promise;
    const promise = spendingService.getSettings().then((response) => {
      scopedSet(epoch, storeSet)({ ...response.data, loaded: true });
    }).catch(() => {}).finally(() => { if (request?.promise === promise) request = null; });
    request = { epoch, promise };
    return promise;
  },
  saveFilters: async (filters) => {
    const epoch = sessionEpoch();
    const response = await spendingService.saveFilters(filters.map(({ name, criteria }) => ({ name, criteria })));
    scopedSet(epoch, storeSet)({ ...response.data, loaded: true });
  }
}));

// Another account must never see these; the store loads on demand, so it resets itself on sign-out.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) { request = null; useFinanceSettingsStore.setState({ ...EMPTY, loaded: false }); }
});

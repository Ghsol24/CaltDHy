import { create } from 'zustand';

const initialState = {
  attemptId: 0,
  state: 'idle',
  startedAt: 0,
};

export const useSignatureLoginStore = create((set, get) => ({
  ...initialState,
  begin: () => {
    const attemptId = get().attemptId + 1;
    set({ attemptId, state: 'pending', startedAt: performance.now() });
    return attemptId;
  },
  succeed: (attemptId) => {
    if (get().attemptId === attemptId && get().state === 'pending') {
      set({ state: 'success' });
    }
  },
  fail: (attemptId) => {
    if (get().attemptId === attemptId && get().state === 'pending') {
      set({ state: 'failure' });
    }
  },
  close: (attemptId) => {
    if (get().attemptId === attemptId) set({ state: 'idle', startedAt: 0 });
  },
}));

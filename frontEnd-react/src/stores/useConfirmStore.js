import { create } from 'zustand';

/** An imperative confirmation that keeps async work inside the dialog. */
export const useConfirmStore = create((set, get) => ({
  isOpen: false,
  isConfirming: false,
  error: null,
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  confirmVariant: 'danger',
  _resolver: null,
  _onConfirm: null,
  _onCancel: null,

  confirm: ({
    title = '',
    message = '',
    confirmText = '',
    cancelText = '',
    confirmVariant = 'danger',
    onConfirm,
    onCancel,
  } = {}) => {
    // Do not replace an unresolved confirmation or orphan its caller.
    if (get().isOpen) return Promise.resolve(false);
    return new Promise((resolve) => {
      set({
        isOpen: true,
        isConfirming: false,
        error: null,
        title,
        message,
        confirmText,
        cancelText,
        confirmVariant,
        _resolver: resolve,
        _onConfirm: onConfirm || null,
        _onCancel: onCancel || null,
      });
    });
  },

  handleConfirm: async () => {
    const request = get();
    if (!request.isOpen || request.isConfirming) return false;
    set({ isConfirming: true, error: null });
    try {
      if (request._onConfirm) await request._onConfirm();
      if (get()._resolver !== request._resolver) return false;
      set({ isOpen: false, isConfirming: false, error: null, _resolver: null, _onConfirm: null, _onCancel: null });
      request._resolver?.(true);
      return true;
    } catch (error) {
      if (get()._resolver === request._resolver) {
        set({ isConfirming: false, error: error?.message || true });
      }
      return false;
    }
  },

  handleCancel: () => {
    const request = get();
    if (!request.isOpen || request.isConfirming) return;
    set({ isOpen: false, isConfirming: false, error: null, _resolver: null, _onConfirm: null, _onCancel: null });
    try { request._onCancel?.(); } finally { request._resolver?.(false); }
  },

  closeConfirm: () => get().handleCancel(),
}));

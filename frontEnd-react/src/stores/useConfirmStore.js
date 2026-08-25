import { create } from 'zustand';

/**
 * Confirm Dialog Store cho CaltDHy v2.
 * Cung cấp API imperative xác nhận hành động nguy hiểm hoặc quan trọng.
 */
export const useConfirmStore = create((set) => ({
  isOpen: false,
  title: 'Xác nhận thao tác',
  message: '',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy',
  confirmVariant: 'danger', // 'danger' | 'primary'
  _resolver: null,

  /**
   * Mở dialog xác nhận, trả về Promise<boolean>
   * @param {Object} options
   * @param {string} [options.title='Xác nhận thao tác']
   * @param {string} [options.message='']
   * @param {string} [options.confirmText='Xác nhận']
   * @param {string} [options.cancelText='Hủy']
   * @param {'danger'|'primary'} [options.confirmVariant='danger']
   * @param {Function} [options.onConfirm]
   * @param {Function} [options.onCancel]
   * @returns {Promise<boolean>}
   */
  confirm: ({
    title = 'Xác nhận thao tác',
    message = '',
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    confirmVariant = 'danger',
    onConfirm,
    onCancel,
  } = {}) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        confirmVariant,
        _resolver: (result) => {
          if (result && typeof onConfirm === 'function') {
            onConfirm();
          } else if (!result && typeof onCancel === 'function') {
            onCancel();
          }
          resolve(result);
        },
      });
    });
  },

  handleConfirm: () => {
    set((state) => {
      if (state._resolver) state._resolver(true);
      return { isOpen: false, _resolver: null };
    });
  },

  handleCancel: () => {
    set((state) => {
      if (state._resolver) state._resolver(false);
      return { isOpen: false, _resolver: null };
    });
  },

  closeConfirm: () => {
    set((state) => {
      if (state._resolver) state._resolver(false);
      return { isOpen: false, _resolver: null };
    });
  },
}));

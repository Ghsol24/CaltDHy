import { create } from 'zustand';

/**
 * Toast Notification Store cho CaltDHy v2.
 * Quản lý danh sách toast notifications hiển thị trên màn hình.
 */
export const useToastStore = create((set, get) => ({
  toasts: [],

  /**
   * Thêm một thông báo toast mới
   * @param {Object|string} toast - Cấu hình toast hoặc chuỗi message
   * @param {'success'|'error'|'warning'|'info'} [toast.type='success']
   * @param {string} toast.message
   * @param {Object} [toast.action] - Action button { label: string, onClick: () => void }
   * @param {number} [toast.duration=4000] - Thời gian tự ẩn (ms)
   * @returns {string} id của toast
   */
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const toastObj =
      typeof toast === 'string'
        ? { id, message: toast, type: 'success', duration: 4000 }
        : {
            id,
            message: toast.message || '',
            type: toast.type || 'success',
            action: toast.action || null,
            duration: toast.duration ?? 4000,
          };

    set((state) => ({
      toasts: [...state.toasts, toastObj],
    }));

    if (toastObj.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, toastObj.duration);
    }

    return id;
  },

  /**
   * Xóa một thông báo toast theo ID
   * @param {string} id
   */
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  /**
   * Xóa toàn bộ toast đang hiển thị
   */
  clearToasts: () => {
    set({ toasts: [] });
  },
}));

import { create } from 'zustand';

const toastTimers = new Map();

function clearToastTimer(id) {
  const timer = toastTimers.get(id);
  if (timer) clearTimeout(timer);
  toastTimers.delete(id);
}

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
   * @param {string} [toast.dedupeKey] - Replace an existing toast with the same key
   * @param {number} [toast.duration=4000] - Thời gian tự ẩn (ms)
   * @returns {string} id của toast
   */
  addToast: (toast) => {
    const input = typeof toast === 'string' ? { message: toast } : toast;
    const dedupeKey = input?.dedupeKey || null;
    const existing = dedupeKey
      ? get().toasts.find((item) => item.dedupeKey === dedupeKey)
      : null;
    const id = existing?.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const toastObj =
      typeof toast === 'string'
        ? { id, message: toast, type: 'success', duration: 4000 }
        : {
            id,
            message: toast.message || '',
            type: toast.type || 'success',
            action: toast.action || null,
            duration: toast.duration ?? 4000,
            dedupeKey,
          };

    set((state) => ({
      toasts: existing
        ? state.toasts.map((item) => (item.id === id ? toastObj : item))
        : [...state.toasts, toastObj],
    }));

    clearToastTimer(id);
    if (toastObj.duration > 0) {
      const timer = setTimeout(() => {
        get().removeToast(id);
      }, toastObj.duration);
      toastTimers.set(id, timer);
    }

    return id;
  },

  /**
   * Xóa một thông báo toast theo ID
   * @param {string} id
   */
  removeToast: (id) => {
    clearToastTimer(id);
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  /**
   * Xóa toàn bộ toast đang hiển thị
   */
  clearToasts: () => {
    for (const id of toastTimers.keys()) clearToastTimer(id);
    set({ toasts: [] });
  },
}));

/* ============================================================
   FOCUS TRAP — CaltDHy
   Đảm bảo focus không thoát ra ngoài modal khi đang mở.
   WCAG 2.1 AA — 2.1.2 No Keyboard Trap
   ============================================================ */

'use strict';

(function (global) {
  const FOCUSABLE_SELECTORS = [
    'a[href]:not([disabled])',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /**
   * Bật focus trap cho một modal element.
   * Trả về hàm cleanup để gọi khi đóng modal.
   *
   * @param {HTMLElement} modalEl - Element cần trap focus
   * @param {Object}      opts
   * @param {boolean}     [opts.autoFocus=true] - Auto-focus element đầu tiên
   * @returns {Function} cleanup — gọi khi đóng modal
   */
  function trapFocus(modalEl, opts) {
    if (!modalEl) return function () {};

    var options = Object.assign({ autoFocus: true }, opts || {});

    function getFocusable() {
      return Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTORS))
        .filter(function (el) {
          return !el.closest('[hidden]') && getComputedStyle(el).display !== 'none';
        });
    }

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;

      var focusable = getFocusable();
      if (focusable.length === 0) { e.preventDefault(); return; }

      var first = focusable[0];
      var last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: nếu đang ở phần tử đầu → nhảy về cuối
        if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: nếu đang ở phần tử cuối → nhảy về đầu
        if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // Lưu element đang focus trước khi mở modal để restore sau
    var previouslyFocused = document.activeElement;

    modalEl.addEventListener('keydown', handleKeyDown);

    // Auto-focus phần tử đầu tiên
    if (options.autoFocus) {
      var focusable = getFocusable();
      if (focusable.length > 0) {
        // Dùng setTimeout để tránh race condition với animation
        setTimeout(function () {
          if (focusable[0]) focusable[0].focus();
        }, 50);
      }
    }

    // Cleanup function
    function cleanup() {
      modalEl.removeEventListener('keydown', handleKeyDown);
      // Restore focus về element trước đó
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch (_) {}
      }
    }

    return cleanup;
  }

  // Export ra global scope
  global.FocusTrap = { trap: trapFocus };

})(typeof window !== 'undefined' ? window : this);

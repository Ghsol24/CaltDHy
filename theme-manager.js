/* theme-manager.js
 * Load this via <script src="theme-manager.js"></script> in <head>,
 * BEFORE any <link rel="stylesheet"> so the class is present when CSS
 * first paints — eliminates FOUC on all pages.
 */
(function () {
  'use strict';

  var KEY = 'caltdhy_theme';

  function _read() {
    try { return localStorage.getItem(KEY); } catch (_) { return null; }
  }

  function _write(theme) {
    try { localStorage.setItem(KEY, theme); } catch (_) {}
  }

  function _apply(theme) {
    var root = document.documentElement; // <html>
    if (theme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }
    /* Sync any toggle buttons that may already be in the DOM */
    _syncButtons(theme);
  }

  function _syncButtons(theme) {
    var icons = document.querySelectorAll('[data-theme-icon]');
    icons.forEach(function (el) {
      el.textContent = theme === 'light' ? '\u2600\ufe0f' : '\ud83c\udf19';
    });
    var btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach(function (btn) {
      btn.setAttribute('aria-label',
        theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    });
  }

  /* ── Public API ── */
  window.ThemeManager = {
    /** Returns current theme string: 'dark' | 'light' */
    get: function () {
      return _read() || 'dark';
    },

    /** Set and persist a specific theme */
    set: function (theme) {
      _write(theme);
      _apply(theme);
    },

    /** Toggle between dark and light */
    toggle: function () {
      var next = this.get() === 'dark' ? 'light' : 'dark';
      this.set(next);
      return next;
    },

    /** Re-sync icon/button labels with current stored theme (call after DOM ready) */
    sync: function () {
      _syncButtons(this.get());
    }
  };

  /* ── Apply immediately (runs synchronously in <head>) ── */
  _apply(_read() || 'dark');

})();

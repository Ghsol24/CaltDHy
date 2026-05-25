/* theme-manager.js
 * Load this via <script src="theme-manager.js"></script> in <head>,
 * BEFORE any <link rel="stylesheet"> so the class is present when CSS
 * first paints — eliminates FOUC on all pages.
 *
 * Supported themes: 'dark' | 'light' | 'cream' | 'sky'
 */
(function () {
  'use strict';

  var KEY = 'caltdhy_theme';
  var ALL_CLASSES = ['dark-theme', 'light-theme', 'cream-theme', 'sky-theme'];

  function _read() {
    try { return localStorage.getItem(KEY); } catch (_) { return null; }
  }

  function _write(theme) {
    try { localStorage.setItem(KEY, theme); } catch (_) {}
  }

  function _apply(theme) {
    var root = document.documentElement; // <html>
    ALL_CLASSES.forEach(function (c) { root.classList.remove(c); });
    /* dark theme uses :root CSS variables — no class needed.
       light / cream / sky each have their own html.xxx-theme override block. */
    if (theme && theme !== 'dark') {
      root.classList.add(theme + '-theme');
    }
    _syncButtons(theme || 'dark');
  }

  function _syncButtons(theme) {
    var icons = { dark: '🌙', light: '☀️', cream: '☕', sky: '🧣' };
    var iconEls = document.querySelectorAll('[data-theme-icon]');
    iconEls.forEach(function (el) {
      el.textContent = icons[theme] || '🌙';
    });
    var btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach(function (btn) {
      btn.setAttribute('aria-label', 'Theme: ' + theme);
    });
  }

  /* ── Public API ── */
  window.ThemeManager = {
    /** Returns current theme string: 'dark' | 'light' | 'cream' | 'sky' */
    get: function () {
      return _read() || 'dark';
    },

    /** Set and persist a specific theme */
    set: function (theme) {
      _write(theme);
      _apply(theme);
    },

    /** Toggle between dark and light (legacy support) */
    toggle: function () {
      var cur = this.get();
      var next = cur === 'dark' ? 'light' : 'dark';
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

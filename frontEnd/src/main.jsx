/* ============================================================
   CaltDHy — main.jsx
   React application entrypoint.
   ============================================================ */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// ── Import toàn bộ design system CSS (giữ nguyên giao diện cũ) ──
import './assets/css/tokens.css';
import './assets/css/base.css';
import './assets/css/layout.css';
import './assets/css/components.css';
import './assets/css/modals.css';
import './assets/css/themes.css';
import './assets/css/responsive.css';
import './assets/css/auth.css';
import './assets/css/react-app.css';

// ── Apply saved theme TRƯỚC khi render để tránh FOUC ──
(function applyTheme() {
  const saved = localStorage.getItem('caltdhy_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  if (saved === 'dark') document.body.classList.add('dark-panel');
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

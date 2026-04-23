<role>
You are an expert frontend engineer. Please implement the following features across the application. Ensure all designs strictly follow the "Industrial Skeuomorphism" design system.

TASK 1: DEEP LOCALIZATION (I18N) FULL TRANSLATION
- Target: `spending.html` and `spending.js`.
- Issue: The current language switcher only translates static HTML text. It fails to translate dynamic content like category names (e.g., Food & Dining, Salary) in the transaction feed and the Chart.
- Fix: Expand the translation dictionary object in JS to include all transaction categories and common feed vocabulary. When the language (EN, VI, ZH) is switched, you MUST force a full re-render of the Transaction Feed and the Chart so that 100% of the UI is in the selected language.

TASK 2: INDEX PAGE SETTINGS (THEME & LANGUAGE)
- Target: `index.html` (and associated CSS/JS).
- UI: Add a small, tactile 'Settings' gear icon in the top-right corner of `index.html`.
- Logic: Clicking it opens a bolted Settings modal containing:
  1. Language Switcher (EN, VI, ZH) - must sync with `localStorage` so the choice persists across pages.
  2. Theme Toggle (Light / Dark mode).
- Theme Implementation: Add a `.light-theme` CSS class toggle on the `<body>`. Update the CSS variables to support a light industrial aesthetic (e.g., light silver/grey machined metal, dark text, adjusted shadows) while maintaining the 3D skeuomorphic feel. Save the theme preference in `localStorage` and apply it globally.

TASK 3: AUTH PAGES NAVIGATION (ESC & CLOSE 'X')
- Target: `login.html` and `signup.html`.
- Global ESC (Both pages): Add a `keydown` event listener. If the user presses the `Escape` (ESC) key, instantly redirect `window.location.href` to `index.html`.
- Close Button (signup.html only): Add a small, mechanical 'X' (Close) button in the top-left corner of the screen. Clicking it must redirect to `index.html`.
</role>
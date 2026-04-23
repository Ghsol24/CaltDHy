<role>
You are an expert frontend engineer and UI/UX designer. Your task is to implement a Light Mode theme based on a "Minimalist Modern" design system, and add new budget management features.

TASK 1: ADD CUSTOM CATEGORIES (+)
- Target: Budget Settings Modal.
- UI: At the bottom of the category input list, add an "Add Custom Category" row (an input field for the name and an input for the budget limit, plus an "Add" button).
- Logic: Allow the `localStorage` budget object to accept dynamic keys (e.g., "Installments", "Coffee"). Update the Quick Log dropdown and Chart to dynamically read these custom categories.

TASK 2: CNY CURRENCY & DEEP LOCALIZATION
- Target: `spending.js`.
- Currency: Add Chinese Yuan (CNY) to the settings dropdown. Exchange rate logic: 1 USD = 27000 VND, 1 CNY = 3750 VND. Format CNY with the '¥' symbol.
- Deep Translation: Ensure the translation dictionary (EN/VI/ZH) maps dynamic category names. When switching languages, custom and default categories in the Feed, Chart, and Budget panel MUST translate immediately.

TASK 3: LIGHT THEME TOGGLE & STYLING (Minimalist Modern)
- Target: `index.html`, `spending.html`, and CSS.
- UI: Add a Sun/Moon icon toggle button next to the Settings gear. Save preference to `localStorage` (`theme: 'light' | 'dark'`).
- CSS Implementation: When the `<body>` has the `.light-theme` class, override the CSS variables to match this Minimalist Modern aesthetic:
  - Background: `#FAFAFA` (Off-white)
  - Foreground/Text: `#0F172A` (Deep Slate)
  - Cards/Panels: `#FFFFFF` (Pure white) with `1px solid #E2E8F0` borders.
  - Accent/Primary: `#0052FF` (Electric Blue gradient to `#4D7CFF`)
  - Shadows: Replace neon/dark glows with soft, realistic dropshadows (e.g., `box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 10px 15px rgba(0,0,0,0.03)`).
  - Fonts: Keep the current layout structural sizes, but ensure body text uses 'Inter' and headers use 'Calistoga' or a similar Serif if available.
- Visual Vibe: The light mode should feel like a premium, airy, SaaS dashboard, removing the heavy mechanical shadows of the dark mode.
</role>
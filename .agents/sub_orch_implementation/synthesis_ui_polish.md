# Implementation Plan: UI/UX Assessment & Polish

This document compiles the verified findings and recommendations from Explorers 1, 2, and 3 to polish the CaltDHy UI/UX.

## 1. Design Tokens (`frontEnd/css/tokens.css`)
- **Radii Nesting**: Scale radius variables to ensure child elements nest cleanly inside parent frames:
  ```css
  --r-xs: 4px;
  --r-sm: 6px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-xl: 16px;
  ```
- **Font Sizes**: Standardize the scale with a minimum size of 10px for legibility:
  ```css
  --font-2xs: 10px;
  --font-xs:  11px;
  --font-sm:  12px;
  --font-md:  13px;
  --font-base: 14px;
  --font-lg:  16px;
  --font-xl:  18px;
  --font-2xl: 22px;
  --font-3xl: 32px;
  ```
- **Theme-Aware Accent RGB**: Define `--accent-rgb: 255, 75, 114;` under `:root` for opacity-based shadows, and override it in each theme.
- **Scrollbar Colors**: Define `--scrollbar-thumb` and `--scrollbar-hover` tokens.

## 2. Accessibility & Themes (`frontEnd/css/themes.css`)
- **WCAG Contrast**: Darken `--muted` text color to meet the WCAG AA minimum 4.5:1 ratio against light backgrounds:
  - **Light Theme**: `--muted: #475569;`
  - **Green Theme**: `--muted: #345D4C;`
- **Warning Color**: Replace yellow `#f1c40f` with amber `#F59E0B` for better contrast.
- **Jars Modals Adaptability**: In `modals.css`, remove the hardcoded dark styles from `.modal-card--jar`, `.modal-card--jar-txn`, and `.modal-card--inst` (remove background, box-shadow, and border declarations so they inherit the base `.modal-card` properties). Ensure they adapt to Light and Cream themes.
- **Jar Form Inputs**: Update `.jar-form-input` and focus styles to use the theme tokens:
  ```css
  background: var(--recessed);
  border: 1.5px solid rgba(var(--accent-rgb), 0.15);
  color: var(--txt);
  ```

## 3. Focus & Scrollbar Polish (`frontEnd/css/base.css`)
- **Double-Ring Focus**: Set focus halo using box-shadow:
  ```css
  *:focus-visible {
    outline: 2px solid transparent;
    box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
    outline-offset: 0;
  }
  ```
- **Theme-Aware Animations**: Update `@keyframes pulseRing` to use `rgba(var(--accent-rgb), ...)` instead of hardcoded red colors.
- **Scrollbar Styling**: Clean up global scrollbars to use `--scrollbar-thumb` and `--scrollbar-hover` tokens.
- **Scroll Lock**: Implement a modern CSS scroll lock:
  ```css
  body:has(.modal-overlay.open),
  body:has(.guide-overlay.open) {
    overflow: hidden !important;
  }
  ```

## 4. Metallic Screws & Recessed Vents (`frontEnd/css/themes.css`)
- **Radial Gradients for Screws**: Replace flat circles in non-dark themes with radial steel/brass/green gradients:
  - **Light**: `radial-gradient(circle at 40% 35%, #F8FAFC, #CBD5E1, #94A3B8)`
  - **Cream**: `radial-gradient(circle at 40% 35%, #FEF3C7, #F59E0B, #B45309)`
  - **Green**: `radial-gradient(circle at 40% 35%, #E8F5E9, #81C784, #2E7D32)`
- **Rotation Transitions**: Add transition/rotate styles so that screws spin by 45 degrees when parent cards (`.metric-card:hover`, `.chassis-frame:hover`, `.modal-card:hover`) are hovered.
- **Recessed Vents**: Add inset shadows to `.modal-vent`, `.numpad-vent`, and `.guide-vent` on Light, Cream, and Green themes.

## 5. Interaction & Layout Shifts (`frontEnd/spending.js` & `frontEnd/spending.html`)
- **Early Sidebar State Load**: Move the sidebar `railCollapsed` localStorage check from the delayed DOMContentLoaded callback to an inline script immediately after the opening of `.app-body` (prevent FOUC layout shift).
- **Sidebar Transition Safety**: Add `overflow-x: hidden` to `.rail` and reset padding vertical space on `.app-body.rail-collapsed .rail` to `0 !important`.
- **Month Picker Transition**: Remove instant block/none toggles for `.month-picker-dropdown`, transition opacity and transform instead.
- **Premium Empty States**: Replace raw empty strings/div templates in `spending.js` with the `.empty-state` component template containing icons, headers, instructions, and CTA buttons.
- **Skeleton Loaders**: Add a loader shimmer CSS pattern and display skeleton list elements in `txnFeed` during network load (`syncLoadFromServer`).

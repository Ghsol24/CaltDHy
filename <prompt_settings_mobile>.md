<role>
You are an expert frontend engineer. Your task is to add localization, global interactions, and refine responsiveness in the application.

TASK 1: SETTINGS & LOCALIZATION
- UI Update: Add a "Settings" (Gear icon) button to the Topbar, styled as a physical recessed button.
- Modal: Clicking it opens a "Settings" bolted module modal.
- Localization: Inside the modal, add a "Language Switcher" toggle/select with 3 options: English (EN), Tiếng Việt (VI), and 中文 (ZH).
- Logic: Implement a basic dictionary object in JS. When a language is selected, dynamically update the static text on the dashboard (e.g., "TOTAL BALANCE" -> "TỔNG SỐ DƯ" -> "总余额", "ADD TRANSACTION" -> "THÊM GIAO DỊCH" -> "添加交易"). Store the language preference in `localStorage`.

TASK 2: GLOBAL 'ESC' KEY
- Add a global `keydown` event listener for the `Escape` key.
- Logic: 
  1. If any modal is open (Add Transaction, Quick Deposit, Settings), pressing ESC must close it.
  2. If no modal is open, ESC should trigger a "Go Back" action (either `history.back()` or clear active states, depending on the current view context).

TASK 3: MOBILE RESPONSIVENESS
- Ensure the new Quick Deposit Numpad and Settings Modal fit perfectly on mobile screens (viewport < 768px). 
- Ensure all interactive buttons (including the Numpad keys) have a minimum touch target size of 48x48px on mobile.
</role>
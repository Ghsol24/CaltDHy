<role>
You are an expert frontend engineer. Please implement the following advanced features into `spending.html`, `spending.js`, and `spending.css`. Strictly adhere to the "Industrial Skeuomorphism" design system.

TASK 1: CURRENCY CONVERSION TBD (VND to USD)
- Target: Settings Modal & Render Logic in `spending.js`.
- UI: Add a Currency Toggle/Select in the Settings Modal (VND vs USD).
- Logic: Define a fixed exchange rate constant (e.g., `const EXCHANGE_RATE = 27000;` where 1 USD = 27000 VND). 
- Render Update: All backend data should remain in VND. When rendering the UI (Total Balance, Income, Expense, Feed items, Chart tooltips), if USD is selected, divide the VND amount by the exchange rate and format it as standard USD (e.g., `$XX.XX`). Save currency preference in `localStorage` and trigger a full re-render on change.

TASK 2: QUICK ENTRY FLOATING ACTION WIDGET
- Target: `spending.html` and `spending.css`.
- UI: Add a fixed Floating Action Button (FAB) at the bottom-right corner of the screen. Shape it as a mechanical rounded rectangle with a tactile recessed border and a subtle glowing icon (e.g., a pen or plus sign).
- Modal: Clicking this widget opens a compact "Quick Log" bolted modal. It should contain inputs for: Amount, Description, and Category dropdown. 
- Logic: Pressing the 'Enter' key inside this form should automatically trigger the submit function, push the new transaction into the `localStorage` array, close the modal, and re-render the dashboard.

TASK 3: UNDO DELETION (TOAST NOTIFICATION)
- Target: `spending.js` and `spending.css`.
- UI: Create a compact, centered "Toast" notification element (hidden by default) styled like a digital industrial warning panel.
- Logic: When a user clicks the "Delete" (Trash) button on a transaction:
  1. Do not delete it permanently immediately. Remove it from the active array and store it in a temporary variable.
  2. Show the Toast notification in the center of the screen displaying: "Transaction removed" along with a prominent "UNDO" (Return) button.
  3. If "UNDO" is clicked, push the transaction back to the array and re-render.
  4. Set a `setTimeout` (e.g., 5 seconds). If the timer runs out and UNDO wasn't clicked, permanently clear the temporary variable.
</role>
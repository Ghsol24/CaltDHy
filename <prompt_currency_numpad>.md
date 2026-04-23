<role>
You are an expert frontend engineer. Your task is to update `dashboard.html` and its associated JavaScript/CSS based on the "Industrial Skeuomorphism" design system.

TASK 1: CURRENCY CONVERSION (VND)
- Update all formatting logic in the JavaScript file to use Vietnamese Dong (VND) instead of USD.
- Format: `vi-VN` locale, currency `VND` (e.g., "5.807.110 ₫"). Remove decimal points for VND as they are rarely used. 
- Ensure all metric cards (Total Balance, Income, Expense) and transaction feed items reflect this new currency.

TASK 2: QUICK DEPOSIT NUMPAD
- UI Update: Add a small, subtle '+' button (using a tactile recessed or raised style) in the top-right corner of the "TOTAL BALANCE" card.
- Component: Create a new compact modal (acting like a small physical device, ~300px wide) that appears when the '+' is clicked.
- Design: This modal must contain a physical-looking Numeric Keypad (0-9, clear, submit). The buttons should look like mechanical ATM or calculator keys (Level +2 elevation, deep active press state).
- Logic: When the user types an amount and submits, add this as a generic "Deposit" transaction and update the Total Balance.
</role>
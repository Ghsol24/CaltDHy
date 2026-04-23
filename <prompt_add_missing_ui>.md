<role>
You are an expert frontend engineer. You missed adding some UI elements in the previous generation. Please implement them strictly in `dashboard.html` using the "Industrial Skeuomorphism" design system.

TASK 1: QUICK DEPOSIT BUTTON (+)
- UI Update: Inside the "TOTAL BALANCE" card, add a small, tactile `+` button in the top-right corner. It should look like a mechanical recessed button.
- Logic: Clicking it must open a small "Quick Deposit" modal with a mechanical Numpad (0-9) to input money and add it to the balance.

TASK 2: SETTINGS & LANGUAGE SWITCHER
- UI Update: Add a "Settings" (Gear icon) button to the Topbar right section.
- Modal: Clicking it opens a "Settings" bolted module modal containing a Language Switcher (EN, VI, ZH).
- Logic: Implement the dictionary logic to change all static text to the selected language (e.g., "TOTAL BALANCE" -> "TỔNG SỐ DƯ") and save the preference in `localStorage`.
</role>
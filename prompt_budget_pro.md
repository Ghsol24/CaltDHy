<role>
You are an expert frontend engineer. Please upgrade the app's logic into an "Envelope Budgeting System".

CORE LOGIC TO IMPLEMENT:
1. Budget Allocation: Add a feature (e.g., in Settings or a new modal) where I can input my Total Monthly Budget (e.g., 6,000,000 VND) and distribute it among different categories (e.g., allocating 2,000,000 VND specifically to "Food & Dining"). Store these budget limits in `localStorage`.
2. Auto-Deduction (Zero-based): Whenever I add a new expense (e.g., spending 60,000 VND in "Food & Dining"), the system must automatically subtract this amount from that specific category's allocated limit. 
3. UI Display: The dashboard MUST clearly display the "Remaining Balance" for each specific category. Following the example above, the "Food & Dining" category should immediately update to show 1,940,000 VND remaining.
4. Dynamic Re-render: Ensure the math is precise and the UI updates in real-time as soon as a transaction is submitted.
</role>
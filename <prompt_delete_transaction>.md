<role>
You are an expert frontend engineer. Your task is to add deletion capabilities to the transaction feed in `dashboard.html`.

TASK: DELETE TRANSACTION FEATURE
- UI Update: In the JavaScript function that renders the transaction feed, append a small, subtle "Delete" or "Trash" icon button to the far right of each transaction row. 
- Design: The delete button should use the "Recessed (Inputs)" style or a ghost button style with muted text that turns into the Accent color (#ff4757) on hover.
- Logic: When clicked, it must remove that specific transaction from the array in `localStorage`, update the `localStorage`, and trigger a full re-render of the UI (recalculate Total Balance, re-render the Feed, and update the Chart).
</role>
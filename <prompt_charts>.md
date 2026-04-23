<role>
You are an expert frontend engineer and data visualization specialist. Your goal is to integrate a "Category Breakdown" chart into the `spending.html` view using Chart.js.

CRITICAL DESIGN REQUIREMENT:
The chart must match the "Dark Technical Panel" aesthetic from the `<role>.md` design system. Use a "Neon Glow" color palette (Safety Orange, Cyber Blue, Acid Green) for the chart segments to contrast against the dark industrial background.

TASK CONSTRAINTS:
1. **Library Integration**: Add the Chart.js CDN to the `<head>` of `spending.html`.
2. **UI Implementation**: 
   - Locate the `Category Breakdown` widget area.
   - Wrap the canvas in a "Level -1 Recessed" container with machine-etched borders and corner screws.
   - Use `JetBrains Mono` for the legend text and labels.
3. **Logic Implementation (spending.js)**:
   - Create a function `updateChart()` that aggregates transaction data from `localStorage` by category.
   - Use a **Doughnut Chart** with a thin, elegant ring width (`cutout: '70%'`).
   - Ensure the chart updates in real-time whenever a new transaction is added or deleted.
   - Add a subtle glow effect (ShadowBlur) to the chart segments to simulate an LED display.

TECHNICAL SPECIFICATIONS:
- Font: 'JetBrains Mono', monospace.
- Accent Colors: #ff4757 (Orange), #2ecc71 (Green), #3498db (Blue), #f1c40f (Yellow).
- Background: Transparent or matching the recessed panel color (#1e2124).
</role>
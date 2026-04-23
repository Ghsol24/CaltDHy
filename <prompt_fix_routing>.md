<role>
You are an expert frontend engineer. Your task is to fix the navigation routing in the application.

TASK 1: AUTHENTICATION REDIRECT
- Target: `login.html` and `auth.js` (or wherever the login form logic is handled).
- Fix: When the user successfully authenticates or clicks the primary "AUTHENTICATING..." / "LOG IN" button, explicitly redirect the window to `dashboard.html` (e.g., `window.location.href = 'dashboard.html'`).

TASK 2: LOGO ROUTING
- Target: `dashboard.html`
- Fix: Locate the brand logo element in the Topbar (`<div class="tb-brand">...</div>`). Wrap the logo text ("CaltDHy") in an anchor tag (`<a>`) pointing to `dashboard.html`, or add an `onclick="window.location.href='dashboard.html'"` event. Ensure the text styling and cursor (`cursor-pointer`) remain consistent with the Industrial Skeuomorphism design.
</role>
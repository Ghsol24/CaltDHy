import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Import CaltDHy v2 CSS Design System
import './assets/css/tokens.css'
import './assets/css/base.css'
import './assets/css/layout.css'
import './assets/css/app-shell.css'
import './assets/css/dialogs.css'
import './assets/css/components.css'
import './assets/css/budgets-analytics.css'
import './assets/css/modals.css'
import './assets/css/account.css'
import './assets/css/themes.css'
import './assets/css/auth.css'
import './assets/css/landing.css'
import './assets/css/responsive.css'
import './assets/css/spa-overrides.css'  // Must be LAST — fixes body conflicts in SPA

import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

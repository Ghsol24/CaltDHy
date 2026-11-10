import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// CSS của ứng dụng. Thứ tự nạp chính là thứ tự cascade: đừng đảo các dòng.
// Landing và các trang đăng nhập tự nạp CSS riêng (pages/landing.css, pages/auth.css);
// Hũ, dòng tiền, màn đăng nhập động, date picker… nạp CSS cùng chunk của chúng.
// Nền tảng: token (giá trị theo theme), base, khung ứng dụng (topbar, rail)
import './assets/css/tokens.css'
import './assets/css/base.css'
import './assets/css/app-shell.css'
// Thành phần UI dùng chung và hộp thoại
import './components/ui/toast.css'
import './components/ui/confirm-dialog.css'
import './components/ui/primitives.css'
import './features/transactions/transaction-modal.css'
import './components/ui/custom-wallet-dropdown.css'
import './features/jars/jar-dialogs.css'
import './features/plan/recurring-modal.css'
// Các màn hình (trước đây là components.css)
import './assets/css/components.css'
import './features/home/home.css'
import './features/plan/plan-overview.css'
import './components/layout/sidebar-quick-record.css'
import './features/plan/wallets.css'
import './features/plan/wallet-dialogs.css'
import './features/plan/budgets-tab.css'
import './features/plan/recurring.css'
import './features/analytics/analytics-shell.css'
import './features/jars/jars-shell.css'
import './features/guide/guide.css'
import './components/ui/custom-select.css'
// Ngân sách, khung hộp thoại, Phân tích, in ấn (trước đây là budgets-analytics.css)
import './features/plan/budgets.css'
import './components/ui/dialog-shell.css'
import './features/plan/budget-editor.css'
import './features/analytics/analytics.css'
import './assets/css/print.css'
import './assets/css/modals.css'
import './features/account/account.css'
import './assets/css/responsive.css'
import './features/plan/plan-mobile.css'
import './features/transactions/transaction-inspection.css'
import './assets/css/pwa.css'
import './assets/css/spa-overrides.css'  // Must be LAST — fixes body conflicts in SPA

// Restore the saved theme on public routes as well as authenticated pages.
import './stores/useThemeStore'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

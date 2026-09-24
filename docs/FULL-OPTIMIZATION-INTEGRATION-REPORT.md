# CaltDHy — Báo cáo tổng hợp chỉnh sửa và tích hợp tối ưu

**Ngày hoàn tất bản tổng hợp:** 23/09/2026  
**Tài liệu được đối chiếu:** `/Users/ghtude10./Desktop/full_optimization_summary.md`  
**Thư mục được chỉnh sửa trực tiếp:** `/Users/ghtude10./Documents/10.gh/proJectLinhTinh/CaltDHy`  
**Phạm vi:** UX/UI, routing, scroll/render performance, loading UX, accessibility cơ bản, tính trung thực của giao diện tài chính và regression test.

## 1. Tóm tắt kết quả

Bản tích hợp giữ lại các tối ưu hữu ích trong `full_optimization_summary.md`, đồng thời điều chỉnh những phần xung đột với kiến trúc route và performance budget đã triển khai trước đó.

Kết quả chính:

- Khôi phục điều hướng đầy đủ trên mobile/tablet bằng bottom navigation và sub-navigation có vùng chạm tối thiểu `44px`.
- Mỗi khu vực sau đăng nhập có deep-link thật, hỗ trợ reload, bookmark, Back/Forward, page title và focus theo route.
- Analytics và Hũ dùng kiến trúc responsive lai: desktop `>900px` dựng các khu vực trong một luồng cuộn liền mạch; mobile `<=900px` chỉ mount khu vực đang chọn để giữ DOM gọn.
- Danh sách Hũ phân trang `12` item/trang; SVG ngoài viewport chỉ mount khi sắp xuất hiện.
- Với fixture 20 hũ, DOM route Danh sách giảm từ baseline `1.839` node xuống khoảng `479–485` node, giảm khoảng `74%` và đạt budget `<800`.
- Analytics/Chart.js, Home, Plan và Hũ được tách thành các chunk tải theo nhu cầu; Chart.js không nằm trong initial preload.
- Chart.js có animation `850ms/900ms` nhưng tự tắt khi người dùng bật Reduced Motion.
- Loading text thô được thay bằng AppShell/Page skeleton; spinner dùng chung đã có style hiển thị thực tế.
- Tài khoản mới không còn tự nhận ngân sách mẫu; giao diện dữ liệu rỗng không còn đưa ra kết luận tài chính giả.
- USD/CNY giả được ẩn; VND là đơn vị duy nhất đang được trình bày như chức năng hoạt động.
- Contextual guide không tự bung che nội dung; mặc định là disclosure button và chỉ mở khi người dùng chủ động chọn.
- `Cài đặt` và `Quản lý tài khoản` đã được hợp nhất thành một Settings Center: desktop dùng bố cục hai cột, mobile dùng màn hình chi tiết full-screen có nút quay lại danh sách.
- Nút Cài đặt mở thẳng `Ngôn ngữ & khu vực`; avatar mở thẳng `Hồ sơ`; hồ sơ, bảo mật, xuất/xóa dữ liệu, bốn theme, hướng dẫn và đăng xuất vẫn dùng business logic thật hiện có.
- Settings Center có focus trap/restore, Escape, cảnh báo dữ liệu chưa lưu, touch target `44–48px` và hộp xác nhận luôn nằm đúng trên modal cha.

## 2. Quyết định tích hợp `full_optimization_summary.md`

### 2.1 Hạng mục được giữ và xác nhận

| Hạng mục | Trạng thái tích hợp | Kết quả |
|---|---|---|
| Memo hóa `MoneyDisplayGuard` | Giữ | `inspectMoneyDisplay()` chỉ chạy lại khi dữ liệu tài chính liên quan thay đổi. |
| Cache semantics trong `api.js` | Giữ có kiểm soát | Client không ép `no-store` cho GET/HEAD; backend vẫn trả `Cache-Control: no-store` cho toàn bộ `/api`. |
| `AppShellSkeleton` | Giữ | Reload route `/spending/*` có khung ứng dụng đầy đủ thay cho màn hình trắng có một dòng chữ. |
| `PageSkeleton` | Giữ | Feature lazy-load và lần tải dữ liệu đầu sử dụng shimmer layout ổn định. |
| Universal spinner | Giữ | `.spinner` và `.btn-spinner` dùng chung animation `spin`. |
| `fadeIn` và `viewFadeIn` | Giữ | View/popover có chuyển động ngắn; Reduced Motion toàn cục vẫn có hiệu lực. |
| Bỏ animation trên `.analytics-section-panel` | Giữ | Tránh tái kích hoạt fade/translate khi `content-visibility` đưa panel vào viewport. |
| Chart animation `850/900ms` | Giữ và bổ sung | Biểu đồ có chuyển động khi tương tác nhưng tự tắt theo `prefers-reduced-motion`. |
| Smooth scroll | Giữ và đơn giản hóa | Route sync là owner duy nhất chịu trách nhiệm focus/cuộn sau khi nội dung mount. |

### 2.2 Hạng mục được điều chỉnh khi hợp nhất

#### Analytics và Hũ dùng kiến trúc responsive lai

Sau khi Product xác nhận `implementation_plan.md`, bản tích hợp áp dụng hai hành vi theo viewport:

- `/spending/analytics/overview`
- `/spending/analytics/spending`
- `/spending/analytics/cash-flow`
- `/spending/analytics/reports`
- `/spending/jars/goals`
- `/spending/jars/list`
- `/spending/jars/history`

- Desktop `>900px`: bốn section Analytics và ba khu vực chính của Hũ cùng tồn tại trong trang để tận dụng không gian, đọc liên tục và tránh khoảng trắng không cần thiết.
- Mobile `<=900px`: chỉ section của route hiện tại được mount; route, reload, Back/Forward và title vẫn giữ nguyên.
- Deep-link tiếp tục là điểm đến điều hướng; việc cuộn desktop không tự sửa URL nên không tạo lịch sử trình duyệt giả.

#### ScrollSpy desktop nhẹ và không làm nhiễu route

Analytics và Hũ dùng listener `scroll/resize` passive, gộp cập nhật bằng `requestAnimationFrame`, chỉ đổi active subtab khi khu vực thực sự thay đổi và gọi store với `syncRoute: false`. Khi chạm cuối tài liệu, khu vực cuối được chọn rõ ràng để tránh tab trước vẫn sáng do section cuối ngắn hơn viewport. ScrollSpy bị vô hiệu hoàn toàn trên mobile.

#### Đơn giản hóa smooth scroll

Trước hợp nhất, Sidebar, Mobile navigation và `SpendingRouteSync` đều có thể gọi `scrollIntoView`, kèm timer và các biến global:

- `window.__caltdhy_programmatic_scroll`
- `window.__caltdhy_cancel_scroll`

Bản tích hợp loại bỏ cơ chế trùng lặp này. `SpendingRouteSync` chờ target route xuất hiện, gắn `tabindex="-1"`, cuộn mượt và chuyển focus. Cơ chế áp dụng cho cả tab `overview`.

#### Cache dữ liệu tài chính

Việc bỏ `cache: 'no-store'` ở client cho GET/HEAD không đồng nghĩa dữ liệu tài chính được lưu cache. Backend vẫn đặt:

```http
Cache-Control: no-store
```

cho toàn bộ route `/api`. Trình duyệt tiếp tục tuân thủ policy an toàn từ máy chủ; thay đổi phía client chỉ loại bỏ cấu hình trùng lặp.

## 3. Các thay đổi UX/UI và hiệu năng đã tích hợp

### 3.1 Mobile navigation và touch target

- Thêm bottom navigation cho `Trang chủ / Kế hoạch / Phân tích / Hũ`.
- Thêm sub-navigation theo feature.
- Active state dùng `aria-current`.
- Có safe-area cho thiết bị có thanh home indicator.
- Các mục điều hướng và action chính được kiểm tra với chiều cao tối thiểu `44px`.
- Sidebar desktop không còn là con đường duy nhất để chuyển màn hình.

Tập tin chính:

- `frontEnd-react/src/components/layout/MobileNavigation.jsx`
- `frontEnd-react/src/components/layout/SidebarNav.jsx`
- `frontEnd-react/src/assets/css/app-shell.css`

### 3.2 Deep-link và đồng bộ route/store

Đã tạo route model cho:

- `/spending/home`
- `/spending/plan/{overview|wallets|budgets|recurring}`
- `/spending/analytics/{overview|spending|cash-flow|reports}`
- `/spending/jars/{goals|list|history}`

Route chịu trách nhiệm:

- Đồng bộ URL vào Zustand.
- Đồng bộ thao tác điều hướng từ store ra URL.
- Canonicalize `/spending` về `/spending/home`.
- Cập nhật `document.title`.
- Focus heading/section của route mới.
- Redirect URL không hợp lệ về route an toàn.

Tập tin chính:

- `frontEnd-react/src/navigation/spendingRoutes.js`
- `frontEnd-react/src/components/layout/SpendingRouteSync.jsx`
- `frontEnd-react/src/stores/useSpendingStore.js`
- `frontEnd-react/src/pages/SpendingPage.jsx`
- `frontEnd-react/src/App.jsx`

### 3.3 Analytics responsive và structural performance

- Analytics được lazy-load cùng Chart.js.
- Desktop dựng đủ bốn section theo luồng đọc liền mạch và cập nhật tab sidebar bằng ScrollSpy `requestAnimationFrame`.
- Mobile chỉ mount section của route hiện tại; Overview không dựng đồng thời doughnut chart, bar chart và report table.
- Chart resize có debounce qua `resizeDelay: 150`.
- Panel giữ `content-visibility: auto` nhưng không còn animation khi đi vào viewport.
- Doughnut animation `850ms`, bar animation `900ms`, easing `easeOutQuart`.
- Animation canvas được tắt hoàn toàn khi `prefers-reduced-motion: reduce`.
- Thêm toggle loại giao dịch trả góp/định kỳ khỏi biểu đồ, lọc hoàn toàn ở client, không khóa 30 giây và dùng animation cập nhật `250ms` khi bấm liên tiếp.
- Toggle hiển thị số khoản và tổng tiền đã loại trong đúng khoảng ngày/3 tháng/6 tháng đang xem.

Tập tin chính:

- `frontEnd-react/src/features/analytics/AnalyticsView.jsx`
- `frontEnd-react/src/assets/css/budgets-analytics.css`

### 3.4 Jars responsive và structural performance

- Tách Mục tiêu, Danh sách hũ và Lịch sử thành ba deep-link độc lập.
- Desktop dựng cả ba khu vực và thông tin hữu ích trong một luồng cuộn; mobile chỉ mount màn hiện tại.
- ScrollSpy desktop đồng bộ active state nhưng không ghi đè URL/history.
- Grid và list dùng phân trang `12` hũ/trang.
- Nút trang có `aria-current`, nhãn truy cập và vùng chạm `44px`.
- `JarGlassGraphic` ngoài viewport được trì hoãn bằng `IntersectionObserver`.
- Placeholder giữ đúng `80×96px`, tránh layout shift khi SVG được mount.
- Empty Jars chỉ dựng một trạng thái có CTA, không dựng dashboard/chart/report vô nghĩa.

Kết quả đo mobile `390×844`:

| Fixture | Baseline | Sau tích hợp |
|---|---:|---:|
| Hũ rỗng | Khoảng `513` node trong audit cũ | `14` node |
| 20 hũ | `1.839` node | `479–485` node ở route Danh sách |
| Card mount ở trang đầu | 20 card | 12 card |

Tập tin chính:

- `frontEnd-react/src/features/jars/JarsView.jsx`
- `frontEnd-react/src/features/jars/JarGlassGraphic.jsx`
- `frontEnd-react/src/assets/css/jars.css`

### 3.5 Cảnh báo ngân sách vượt hạn mức

- Chỉ áp dụng trạng thái bội chi khi `spent > limit`; bằng đúng hạn mức được ghi là “Đã chạm hạn mức”, không bị diễn giải sai thành vượt.
- Card có viền nhấn `4px`, gradient và shadow được hiệu chỉnh riêng cho Light, Dark, Cream và Green.
- Nhãn hiển thị trực tiếp `Vượt hạn mức +X đ`; progress dùng sọc chéo tĩnh để phân biệt nhưng không nhấp nháy.
- `AlertTriangleOutlineIcon` giữ `fill: none`, đúng yêu cầu icon rỗng; không dùng emoji hoặc icon tô đặc.
- Không thêm pulse/glow animation để tránh gây phân tâm và giảm chi phí paint khi cuộn.

Tập tin chính:

- `frontEnd-react/src/features/plan/BudgetsTab.jsx`
- `frontEnd-react/src/assets/css/budgets-analytics.css`

### 3.6 Loading UX

- `AppShellSkeleton` mô phỏng topbar, sidebar và vùng nội dung khi chunk `/spending/*` đang tải.
- `PageSkeleton` mô phỏng KPI, chart/content panel và danh sách giao dịch.
- Lần tải dữ liệu giao dịch đầu sử dụng skeleton thay cho zero-state hoặc text loading thô.
- Skeleton dùng các token surface/border hiện có và chịu Reduced Motion toàn cục.

Tập tin chính:

- `frontEnd-react/src/components/layout/AppShellSkeleton.jsx`
- `frontEnd-react/src/components/ui/PageSkeleton.jsx`
- `frontEnd-react/src/App.jsx`
- `frontEnd-react/src/pages/SpendingPage.jsx`
- `frontEnd-react/src/assets/css/base.css`
- `frontEnd-react/src/assets/css/dialogs.css`

### 3.7 Spinner và phản hồi thao tác

Đã định nghĩa dùng chung:

```css
.spinner,
.btn-spinner
```

cho các trạng thái submit/loading đã tồn tại trong Login, Signup, Reset Password, Transaction, Jar, Wallet, Transfer, Budget và Recurring.

Spinner dùng vòng quay `0.75s linear infinite` và bị rút ngắn theo Reduced Motion toàn cục.

### 3.8 Tối ưu phép tính tiền BigInt

`MoneyDisplayGuard` trước đây có nguy cơ chạy lại phép quét O(N) trên nhiều render không liên quan. Bản hiện tại dùng `useMemo` với dependency cụ thể:

- transactions
- budgets
- wallets
- archived wallets
- jars
- installments

Kết quả kiểm tra `inspectMoneyDisplay()` chỉ được tính lại khi một nguồn dữ liệu tài chính thay đổi.

Tập tin:

- `frontEnd-react/src/components/ui/MoneyDisplayGuard.jsx`

### 3.9 Data trust và onboarding

- Backend không còn tự tạo bốn ngân sách mẫu khi đăng ký.
- Tài khoản mới chỉ có dữ liệu thực do người dùng tạo.
- Empty state không nói “an toàn”, “ổn định”, “đã sẵn sàng” khi chưa đủ dữ liệu.
- Hũ rỗng không hiển thị trend, ngày cao nhất hoặc nhận định giả.
- Settings chỉ trình bày VND là currency đang hỗ trợ; USD/CNY giả bị ẩn.

Tập tin chính:

- `backEnd/server/routes/auth.js`
- `frontEnd-react/src/components/ui/AppUtilities.jsx`
- `frontEnd-react/src/features/home/AttentionPanel.jsx`
- `frontEnd-react/src/features/plan/PlanOverviewTab.jsx`
- `frontEnd-react/src/features/analytics/AnalyticsView.jsx`
- `frontEnd-react/src/features/jars/JarsView.jsx`

### 3.10 Contextual guide

- Guide không còn tự bung card lớn khi người dùng đổi view.
- Mặc định chỉ hiển thị disclosure button `44px`.
- Nội dung chỉ xuất hiện sau thao tác chủ động.
- Nút đóng và CTA đạt vùng chạm tối thiểu.
- Guide mobile nằm phía trên bottom navigation và không che điều hướng.

Tập tin chính:

- `frontEnd-react/src/features/guide/ContextualSectionGuide.jsx`
- `frontEnd-react/src/assets/css/components.css`

### 3.11 Code splitting và bundle

Các feature được dynamic import:

- Home
- Plan
- Analytics
- Jars
- Transaction modal
- App utilities

Kết quả production budget gần nhất:

| Chỉ số | Kết quả |
|---|---:|
| Entry JavaScript | `235.986 byte` |
| Tổng initial JavaScript | `269.992 byte` |
| Initial CSS | `521.406 byte` |
| Initial preload có Analytics/Chart.js | Không |

Các chunk lazy riêng vẫn tồn tại cho Analytics, Home, Jars và Plan.

### 3.12 Unified Settings Center

Hai trải nghiệm `Cài đặt` và `Quản lý tài khoản` trước đây đã được gom về một modal và một nguồn trạng thái duy nhất.

Kiến trúc thông tin thực tế:

- Tài khoản: `Hồ sơ`, `Bảo mật`, `Dữ liệu & quyền riêng tư`.
- Ứng dụng: `Ngôn ngữ & khu vực`, `Giao diện`.
- Hỗ trợ: `Hướng dẫn sử dụng`.
- `Đăng xuất` được tách ở cuối sidebar và luôn yêu cầu xác nhận.

Hành vi chính:

- Nút bánh răng trên topbar mở `Ngôn ngữ & khu vực`; user chip/avatar mở `Hồ sơ` trong cùng Settings Center.
- Desktop dùng dialog hai cột, giữ navigation bên trái và nội dung cuộn độc lập bên phải.
- Mobile dùng dialog full-screen; mở trực tiếp section được yêu cầu, nút quay lại đưa người dùng về danh sách section.
- Chỉ hiển thị lựa chọn đang hoạt động: tiếng Việt, VND và bốn theme hiện có; không dựng control giả cho USD/CNY.
- Hồ sơ, avatar, đổi email có xác thực mật khẩu, đổi mật khẩu, xuất JSON, đặt lại dữ liệu và thông tin phiên tiếp tục tái sử dụng logic hiện hữu.
- Khi form Hồ sơ/Bảo mật có dữ liệu chưa lưu, đóng modal hoặc đổi section đều yêu cầu xác nhận; chọn tiếp tục chỉnh sửa giữ nguyên dữ liệu.
- Focus bị giữ trong dialog đang hoạt động, được trả về đúng entry point khi đóng; `Escape` ưu tiên dialog con trước dialog cha.
- Hộp xác nhận dùng lớp hiển thị cao hơn Settings Center và khôi phục đúng trạng thái khóa cuộn của modal cha khi đóng.
- Trên mobile đã bỏ animation scale của dialog full-screen để tránh khung tạm co nhỏ, giảm chuyển động không cần thiết và ổn định phép dựng đầu tiên.
- Label/password input có liên kết `for/id` và `autocomplete` phù hợp; icon navigation đều là SVG outline không tô màu.

Tập tin chính:

- `frontEnd-react/src/features/account/AccountModal.jsx`
- `frontEnd-react/src/components/ui/AppUtilities.jsx`
- `frontEnd-react/src/components/ui/ConfirmDialog.jsx`
- `frontEnd-react/src/components/layout/Topbar.jsx`
- `frontEnd-react/src/stores/useSpendingStore.js`
- `frontEnd-react/src/assets/css/account.css`
- `frontEnd-react/src/assets/css/dialogs.css`
- `tests/browser-security.cjs`

## 4. Danh sách tập tin chính được tạo hoặc chỉnh sửa

### Tập tin mới

- `frontEnd-react/src/navigation/spendingRoutes.js`
- `frontEnd-react/src/components/layout/SpendingRouteSync.jsx`
- `frontEnd-react/src/components/layout/MobileNavigation.jsx`
- `frontEnd-react/src/components/layout/AppShellSkeleton.jsx`
- `frontEnd-react/src/components/ui/PageSkeleton.jsx`
- `frontEnd-react/src/hooks/useMediaQuery.js`
- `frontEnd-react/src/utils/analyticsFilters.js`
- `frontEnd-react/tests/analytics-filters.test.mjs`
- `tests/ux-performance-budget.cjs`
- `docs/UX-UI-AUDIT.md`
- `docs/UX-UI-REMEDIATION-PLAN.md`
- `docs/FULL-OPTIMIZATION-INTEGRATION-REPORT.md`

### Tập tin chỉnh sửa tiêu biểu

- `frontEnd-react/src/App.jsx`
- `frontEnd-react/src/pages/SpendingPage.jsx`
- `frontEnd-react/src/pages/LoginPage.jsx`
- `frontEnd-react/src/pages/SignupPage.jsx`
- `frontEnd-react/src/stores/useSpendingStore.js`
- `frontEnd-react/src/services/api.js`
- `frontEnd-react/src/components/layout/SidebarNav.jsx`
- `frontEnd-react/src/components/layout/Topbar.jsx`
- `frontEnd-react/src/components/ui/MoneyDisplayGuard.jsx`
- `frontEnd-react/src/components/ui/AppUtilities.jsx`
- `frontEnd-react/src/components/ui/ConfirmDialog.jsx`
- `frontEnd-react/src/features/account/AccountModal.jsx`
- `frontEnd-react/src/features/analytics/AnalyticsView.jsx`
- `frontEnd-react/src/features/jars/JarsView.jsx`
- `frontEnd-react/src/features/guide/ContextualSectionGuide.jsx`
- `frontEnd-react/src/features/transactions/TransactionModal.jsx`
- `frontEnd-react/src/features/plan/PlanView.jsx`
- `frontEnd-react/src/features/plan/PlanOverviewTab.jsx`
- `frontEnd-react/src/features/plan/WalletsTab.jsx`
- `frontEnd-react/src/assets/css/base.css`
- `frontEnd-react/src/assets/css/layout.css`
- `frontEnd-react/src/assets/css/app-shell.css`
- `frontEnd-react/src/assets/css/components.css`
- `frontEnd-react/src/assets/css/budgets-analytics.css`
- `frontEnd-react/src/assets/css/jars.css`
- `frontEnd-react/src/assets/css/landing.css`
- `frontEnd-react/src/assets/css/account.css`
- `frontEnd-react/src/assets/css/dialogs.css`
- `backEnd/server/routes/auth.js`
- `tests/browser-security.cjs`
- `frontEnd-react/vite.config.js`
- `package.json`

## 5. Kiểm thử và bằng chứng xác nhận

### Kết quả đạt

- Frontend production build: pass.
- Frontend lint: pass, không còn warning trong lượt xác nhận gần nhất.
- UX production bundle budget: pass.
- Browser regression: `12/12` scenario pass, không có unhandled browser error.
- Backend: `48/48` test pass trong lượt kiểm chứng đầy đủ.
- Root guard/money/filter/launcher suite: `14/14` test pass.

### Browser regression đang bảo vệ

- Mobile navigation hiển thị và sidebar desktop được ẩn đúng breakpoint.
- Touch target navigation tối thiểu `44px`.
- Không có horizontal overflow tại `390×844`.
- Tài khoản mới không bị tự gán ngân sách mẫu.
- Chart.js không tải trước khi mở Analytics.
- Route Kế hoạch/Analytics/Hũ cập nhật URL đúng.
- Reload giữ nguyên sub-route.
- Back/Forward hoạt động giữa các route con.
- Page title cập nhật theo route.
- Analytics/Hũ trên mobile không mount section ngoài route hiện tại.
- Analytics desktop cùng dựng đủ bốn section; Hũ desktop cùng dựng đủ ba section chính.
- ScrollSpy chọn đúng tab khi cuộn tới section cuối.
- Toggle định kỳ lọc tức thì, có `aria-pressed` và tổng số tiền/số khoản bị loại.
- Thẻ vượt hạn mức có nhãn số tiền bội chi, thanh tiến trình vân tĩnh và icon cảnh báo outline không tô màu trên bốn theme.
- Hũ rỗng có DOM gọn.
- Fixture 20 hũ chỉ có 12 card ở trang đầu và DOM `<800`.
- Trang hũ thứ hai có 8 card và `aria-current="page"`.
- Ba route Hũ không mount chéo section trên mobile.
- Contextual guide mặc định thu gọn và có thể mở/đóng.
- Settings không hiển thị USD/CNY như currency đang hoạt động.
- Hai entry point Cài đặt/avatar mở đúng section trong cùng một Settings Center.
- Desktop Settings Center có đủ navigation, bốn theme hoạt động tức thì và có thể mở sổ tay hướng dẫn thật.
- Cảnh báo thay đổi chưa lưu cho phép tiếp tục chỉnh sửa hoặc bỏ thay đổi mà không ghi nhầm profile.
- Đóng modal trả focus về nút mở; logout vẫn đồng bộ và khóa các tab khác.
- Mobile Settings Center chiếm toàn màn hình, có luồng chi tiết → quay lại danh sách → chọn section và không bị tràn ngang.

## 6. Nguyên nhân khựng được xác định và cách giảm tải

Không tìm thấy một scroll listener JavaScript duy nhất gây nghẽn liên tục. Nguyên nhân là hiệu ứng cộng dồn:

1. Trang Hũ và Analytics từng mount lượng DOM lớn cùng lúc.
2. Nhiều SVG, shadow, sticky layer và vùng paint dài.
3. Chart.js và feature nặng từng có nguy cơ tải sớm.
4. Animation/filter vô hạn trên Landing.
5. Subscription/store update và phép quét BigInt rộng hơn cần thiết.
6. Nhiều nơi cùng cố điều khiển scroll khi route/tab thay đổi.

Các biện pháp đã thực hiện:

- Rendering lai: desktop ưu tiên luồng đọc đầy đủ; mobile giữ route-only rendering.
- Pagination 12 hũ/trang.
- Deferred SVG theo viewport.
- Lazy feature chunks.
- Không preload Chart.js.
- Memo BigInt guard.
- Route sync sở hữu focus/smooth scroll; ScrollSpy desktop chỉ cập nhật active state và được gộp bằng `requestAnimationFrame`.
- Giảm animation Landing và loại blur ở guide nổi.
- Reduced Motion cho CSS và Chart.js canvas.
- Bundle/DOM regression test.

## 7. Phần còn mở

Các hạng mục dưới đây chưa được tuyên bố hoàn tất:

- Chrome Performance trace trên chính thiết bị/browser đang thấy khựng.
- Fixture 50 hũ và dữ liệu hoạt động/history rất lớn.
- Profiling/memo hóa sâu hơn các phép tính report Analytics nếu fixture lớn cho thấy CPU là nút thắt trên desktop.
- Chia nhỏ CSS foundation/feature; initial CSS hiện khoảng `521kB` sau khi bổ sung Settings Center responsive.
- Stable category key và i18n catalog đầy đủ.
- Contrast matrix cho bốn theme.
- Browser zoom 200% thực tế.
- VoiceOver/NVDA và keyboard smoke test toàn bộ modal.
- Focus trap/restore cho các modal còn lại ngoài Settings Center/Confirm dialog.

Không dùng kết quả FPS headless đơn lẻ để tuyên bố đã giải quyết hoàn toàn vấn đề trên thiết bị vật lý.

## 8. Ghi chú bàn giao

- Mọi thay đổi được thực hiện trực tiếp trong thư mục dự án, không chỉnh sửa file ZIP nguồn.
- Theo yêu cầu, không tạo bản ZIP mới.
- `full_optimization_summary.md` được dùng làm nguồn đối chiếu; các chỉ dẫn trong tài liệu không được áp dụng máy móc khi xung đột với routing, bảo mật hoặc performance budget hiện tại.
- Hai báo cáo nền vẫn được duy trì tại `docs/UX-UI-AUDIT.md` và `docs/UX-UI-REMEDIATION-PLAN.md`.

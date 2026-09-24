# CaltDHy — UX/UI Audit

**Ngày kiểm toán:** 22/09/2026; cập nhật triển khai 23/09/2026  
**Trạng thái:** Audit hoàn tất ở mức code review + kiểm tra trình duyệt với dữ liệu tổng hợp. Hai batch ưu tiên đã được triển khai; các phát hiện gốc được giữ lại làm baseline trước sửa.  
**Mức tin cậy:** Cao đối với các lỗi điều hướng responsive, touch target, deep-link, empty state, currency và onboarding; trung bình đối với contrast/focus và nguyên nhân khựng khi cuộn vì profiler headless xác nhận các điểm nóng tương đối nhưng không tái hiện tụt FPS trên thiết bị vật lý.

## 1. Tóm tắt điều hành

CaltDHy có nền tảng thị giác desktop tốt: hierarchy rõ, card system tương đối nhất quán, bốn theme có bản sắc, icon outline đồng bộ và nhiều modal đã có semantics/focus trap. Tuy nhiên sản phẩm **chưa nên được mô tả là production-ready hoặc đạt WCAG**.

Hai vấn đề nghiêm trọng nhất là:

1. Điều hướng chính biến mất hoàn toàn dưới `900px`, khiến người dùng tablet/mobile không thể đi ổn định giữa Home, Plan, Analytics và Jars.
2. Sản phẩm tài chính suy diễn trạng thái “an toàn”, “ổn định”, “đã sẵn sàng” từ dữ liệu rỗng hoặc ngân sách mặc định do hệ thống tự tạo. Đây là lỗi niềm tin, không chỉ là lỗi nội dung.

Kiểm tra runtime trên tài khoản tổng hợp mới xác nhận:

- Ở `768×1024` và `390×844`, `.app-sidebar-nav` không hiển thị và không có điều hướng thay thế.
- Ở `390×844`, 8/10 control đang hiển thị có ít nhất một chiều dưới `44px`; một số chỉ cao `15–24px`.
- Guide lần đầu chiếm khoảng `342×296px` trên màn hình `390×844`, nằm đè trên nội dung và dùng `role="complementary"` thay vì mô hình disclosure/dialog phù hợp.
- Tài khoản mới có `0` giao dịch nhưng Home báo kế hoạch tháng “đã sẵn sàng” với `6.300.000 đ`; Plan báo “trong tầm kiểm soát tốt”; Analytics báo các nhóm “an toàn”; Jars báo “Hoạt động ổn định”, “100% An toàn”.
- Frontend build thành công; 10 kịch bản browser-security với MongoDB tạm đều pass, không có unhandled browser error. Kết quả này là điểm tích cực về tính toàn vẹn phiên và lỗi mạng, không phải chứng nhận UX/accessibility.
- Profiler so sánh xác định Analytics/Jars là vùng có rủi ro scroll cao nhất: empty Analytics/Jars đã dài khoảng `1.8–1.9k px`; với 20 hũ tổng hợp, Jars tăng lên `4.761px`, `1.839` DOM element, `101` SVG và `61` element có box-shadow. Chromium headless vẫn giữ nhịp 60fps, vì vậy đây là bằng chứng về **nguy cơ paint/DOM**, chưa phải phép đo FPS đại diện cho máy người dùng.

## 2. Phương pháp, phạm vi và bằng chứng

### Đã kiểm tra

- Đọc mã nguồn React SPA, Express API và các stylesheet liên quan.
- Build frontend production.
- Chạy ứng dụng với MongoDB replica set tạm, tài khoản và dữ liệu tổng hợp; không dùng database thật hoặc `.env` thật.
- Kiểm tra runtime tại `390×844`, `768×1024`, `1024×768`, `1440×900` và viewport `720×450` như proxy cho không gian CSS tương đương zoom 200% trên màn hình 1440×900.
- Kiểm tra Home trên cả Dark, Light, Cream và Green; kiểm tra Plan, Analytics và Jars ở desktop với tài khoản mới.
- Kiểm tra reduced-motion ở cấp browser context và xác minh stylesheet có media query tương ứng.
- Đo bounding box của control, visibility của sidebar, overflow ngang, semantics của contextual guide và text thực tế trong DOM.
- Đo frame interval, main-thread task, layout/style cost, DOM/SVG/canvas/shadow/animation count khi cuộn; so sánh empty account với fixture 360 giao dịch + 20 hũ.
- Chạy 10 kịch bản browser-security hiện có, gồm signup/login, bốn theme, session expired, offline logout, lỗi mạng và số tiền lớn.

Bằng chứng runtime nằm tại:

- [metrics.json](ux-ui-evidence/metrics.json)
- [scroll-performance.json](ux-ui-evidence/scroll-performance.json)
- [Mobile 390×844](ux-ui-evidence/390x844-home.png)
- [Tablet 768×1024](ux-ui-evidence/768x1024-home.png)
- [Desktop Home — Light](ux-ui-evidence/desktop-home-light.png)
- [Desktop Plan — empty](ux-ui-evidence/desktop-plan-empty.png)
- [Desktop Analytics — empty](ux-ui-evidence/desktop-analytics-empty.png)
- [Desktop Jars — empty](ux-ui-evidence/desktop-jars-empty.png)

### Chưa kiểm tra đầy đủ

- Chưa kiểm tra bằng screen reader thực tế (VoiceOver/NVDA), switch control hoặc thiết bị cảm ứng vật lý.
- Chưa chạy axe/Lighthouse; project hiện không có dependency axe và audit không cài thêm package.
- Chưa đo contrast của mọi pixel qua gradient/layer, mọi hover/focus/disabled/error state và mọi theme. Các tỷ lệ dưới đây là spot check cần được xác nhận lại trên background thực tế.
- Chưa kiểm thử với dữ liệu production, mạng thật, tỷ giá thật hoặc browser/device matrix ngoài Chromium headless.
- Viewport `720×450` chỉ là proxy reflow cho zoom 200%, không thay thế kiểm tra browser zoom thực tế.
- Chưa usability-test với người dùng; các đề xuất IA/nội dung được đánh dấu là giả thuyết khi cần research.

### Chuẩn tham chiếu

- WCAG 2.2 AA yêu cầu target tối thiểu `24×24 CSS px` hoặc đáp ứng ngoại lệ khoảng cách; `44×44px` trong báo cáo là baseline sản phẩm cảm ứng khuyến nghị, không phải ngưỡng WCAG AA tuyệt đối: [W3C SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Text thường cần contrast tối thiểu `4.5:1`, text lớn `3:1`: [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Focus phải nhìn thấy; focus indicator mạnh cần đủ kích thước/contrast: [W3C SC 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) và [SC 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance).

## 3. Năm vấn đề quan trọng nhất

| Ưu tiên | Vấn đề | Tác động | Công sức ước tính | Quyết định khuyến nghị |
|---|---|---:|---:|---|
| P0 | Mất điều hướng trên tablet/mobile | Rất cao | M | Bottom navigation cho 4 khu vực chính; drawer cho destination phụ |
| P1 | Empty state đưa kết luận tài chính sai | Rất cao | M | Mô hình `insufficient data`; không suy diễn “tốt/an toàn” từ số 0 |
| P1 | Onboarding tự tạo ngân sách 6,3 triệu | Rất cao | M–L | Không tạo ngân sách như dữ liệu thật trước khi biết bối cảnh người dùng |
| P1 | Khựng khi cuộn: Jars/Analytics có DOM/paint surface lớn | Cao | M–L | Giảm nội dung đồng thời, paginate/virtualize, defer chart và đặt performance budget |
| P1 | Control nhỏ và focus chưa có gate hệ thống | Cao | M | Baseline 44×44 cho tác vụ chính; audit WCAG 24px/spacing + focus |

## 4. Phát hiện chi tiết

### UX-01 — [P0] Mất toàn bộ điều hướng chính trên tablet/mobile

**Loại:** Lỗi chức năng UX, responsive, accessibility.  
**Flow:** Mọi flow sau đăng nhập ở `≤900px`.

**Bằng chứng:** Media query đặt `.app-sidebar-nav { display: none; }` tại [app-shell.css:578](../frontEnd-react/src/assets/css/app-shell.css#L578). `AppShell` chỉ render Topbar, SidebarNav và main; không có bottom nav/drawer thay thế tại [AppShell.jsx:16](../frontEnd-react/src/components/layout/AppShell.jsx#L16). Runtime xác nhận sidebar visible ở `1024px`, hidden ở `768px` và `390px`; mobile chỉ còn Home cùng Settings/Account/CTA.

**Tác động:** Người dùng không thể hoàn thành các tác vụ cốt lõi ở Plan, Analytics, Jars nếu không gặp một link tình cờ trong nội dung; trạng thái active và location bị mất.

**Đề xuất:** Bottom navigation cố định cho `Trang chủ / Kế hoạch / Phân tích / Hũ`; drawer hoặc sheet cho sub-navigation. Giữ nhãn ngắn, icon outline, semantic tokens và safe-area inset.

**Acceptance criteria:**

- Bốn destination chính truy cập được ở `320–900px` bằng touch và keyboard.
- Active state có text/icon/`aria-current`, không chỉ dựa vào màu.
- Focus không bị bottom bar che; body không có overflow ngang ở các viewport đã audit.
- Sub-navigation của Plan/Analytics/Jars vẫn truy cập được và có nút mở với accessible name.

### UX-02 — [P1] Touch target quá nhỏ; chưa đủ bằng chứng để tuyên bố WCAG pass

**Loại:** Accessibility, mobile usability.  
**Flow:** Topbar, CTA, guide, Plan, Analytics, Jars.

**Bằng chứng:** Runtime `390×844` ghi nhận 8/10 control có một chiều dưới `44px`: logo cao `32px`, Settings `38×38`, Account cao `38px`, CTA thêm giao dịch cao `41px`, link chi tiết ngân sách cao `15px`, đóng guide `24×24`, hai action guide cao `26–28px`. Ở desktop Plan, các action “Xem tất cả” cao `14px`, thêm ví/ngân sách/khoản định kỳ `35px`. Xem [metrics.json](ux-ui-evidence/metrics.json).

**Tác động:** Tăng chạm nhầm, đặc biệt với người có hạn chế vận động; target nhỏ trong overlay khó đóng.

**Đề xuất:** Dùng `min-inline-size/min-block-size: 44px` cho tác vụ chính trên touch; tối thiểu kiểm tra `24×24px` hoặc spacing exception theo WCAG 2.5.8 cho mọi target. Tăng hit area bằng padding/pseudo-element, không chỉ tăng font.

**Acceptance criteria:**

- Tất cả CTA/nav/form control chính đạt `44×44px` trên touch layout.
- Target nhỏ hơn `24×24px` không tồn tại trừ trường hợp ngoại lệ được ghi nhận và kiểm thử spacing.
- Không có overlap hit area; automation xuất danh sách vi phạm theo viewport.

### UX-03 — [P1] SPA không có URL/deep-link cho từng khu vực

**Loại:** Kiến trúc điều hướng, UX chức năng.  
**Flow:** Home → Plan/Analytics/Jars và các sub-section.

**Bằng chứng:** Router chỉ có route chung `/spending` tại [App.jsx:57](../frontEnd-react/src/App.jsx#L57). `activeView`, `planSubTab`, `analyticsSubTab`, `jarsSubTab` là state in-memory tại [useSpendingStore.js:4](../frontEnd-react/src/stores/useSpendingStore.js#L4). Runtime ở mọi khu vực vẫn giữ URL `/spending`.

**Tác động:** Back/Forward không phản ánh điều hướng, reload về Home, không bookmark/chia sẻ được vị trí, khó đo analytics theo screen.

**Đề xuất:** Route theo feature, ví dụ `/spending/home`, `/spending/plan/budgets`, `/spending/analytics/reports`, `/spending/jars`; state tạm như modal/filter vẫn ở store.

**Acceptance criteria:** URL thay đổi theo destination; reload phục hồi view; Back/Forward đúng thứ tự; route không hợp lệ có fallback có chủ đích; title/heading cập nhật theo route.

### UX-04 — [P1] Dữ liệu rỗng bị diễn giải thành tình trạng tài chính tốt

**Loại:** Lỗi nội dung và niềm tin, UX chức năng.  
**Flow:** Tài khoản mới → Home, Plan, Analytics, Jars.

**Bằng chứng:**

- Home dùng ngân sách mặc định để nói tháng “đã sẵn sàng” tại [HomeView.jsx:59](../frontEnd-react/src/features/home/HomeView.jsx#L59) và [AttentionPanel.jsx:162](../frontEnd-react/src/features/home/AttentionPanel.jsx#L162).
- Plan nói “Mọi kế hoạch… kiểm soát tốt” và “Tất cả ngân sách…” khi không có giao dịch tại [PlanOverviewTab.jsx:395](../frontEnd-react/src/features/plan/PlanOverviewTab.jsx#L395).
- Analytics thêm insight “nằm trong vùng kiểm soát an toàn” chỉ vì category có limit tại [AnalyticsView.jsx:711](../frontEnd-react/src/features/analytics/AnalyticsView.jsx#L711).
- Jars hiển thị trend `0%`, “Hoạt động ổn định”, ngày cao nhất `0đ`, “100% An toàn” tại [JarsView.jsx:928](../frontEnd-react/src/features/jars/JarsView.jsx#L928), [JarsView.jsx:951](../frontEnd-react/src/features/jars/JarsView.jsx#L951), [JarsView.jsx:1211](../frontEnd-react/src/features/jars/JarsView.jsx#L1211), [JarsView.jsx:1518](../frontEnd-react/src/features/jars/JarsView.jsx#L1518).

**Tác động:** Người dùng có thể tin sản phẩm đã đánh giá sức khỏe tài chính dù chưa có dữ liệu; rủi ro đặc biệt cao với sản phẩm tài chính.

**Đề xuất:** Chuẩn hóa ba trạng thái: `loading`, `insufficient data`, `measured`. Chỉ đưa verdict khi có ngưỡng dữ liệu được định nghĩa; dùng CTA “Thêm giao dịch đầu tiên / khai báo thu nhập / tạo mục tiêu”.

**Acceptance criteria:** Với 0 giao dịch/0 hũ, không có “an toàn”, “ổn định”, trend, ngày cao nhất hoặc khuyến nghị cá nhân hóa; `0` thực đo khác `chưa có dữ liệu`; test fixture bao phủ 0, partial và sufficient data.

### UX-05 — [P1] Currency selector là UI giả

**Loại:** Lỗi chức năng UX, nội dung gây hiểu nhầm.  
**Flow:** Settings → Currency → mọi số tiền.

**Bằng chứng:** Selector chỉ cập nhật state/localStorage `caltdhy_curr` tại [AppUtilities.jsx:87](../frontEnd-react/src/components/ui/AppUtilities.jsx#L87); không nối vào formatter/domain model. UI vẫn hiển thị VND. Tỷ giá hardcode `1 USD = 27,000 VND | 1 CNY = 3,750 VND` tại [translations.js:19](../frontEnd-react/src/i18n/translations.js#L19), không nguồn/timestamp.

**Tác động:** Người dùng có thể tưởng số tiền đã được quy đổi hoặc tỷ giá là live.

**Đề xuất:** Ngắn hạn chỉ hiển thị VND và ẩn USD/CNY. Dài hạn tách base currency/display currency, lưu tỷ giá + nguồn + `as-of`, quy tắc làm tròn và nhãn rõ số đã quy đổi.

**Acceptance criteria:** Không có lựa chọn “hoạt động” mà không đổi dữ liệu; nếu triển khai, mọi màn hình/CSV/input dùng cùng currency service; số gốc không bị mất; tỷ giá có nguồn và timestamp; offline/stale state rõ.

### UX-06 — [P1] Onboarding tài khoản mới tạo dữ liệu giả và guide lấn nội dung

**Loại:** Onboarding, accessibility, niềm tin.  
**Flow:** Signup → lần đầu vào Home/Plan/Analytics.

**Bằng chứng:** Backend tự tạo ví và bốn ngân sách tổng `6.300.000 đ` khi register tại [auth.js:94](../backEnd/server/routes/auth.js#L94). Contextual guide tự mở theo `activeView`, lưu “seen” trong localStorage tại [ContextualSectionGuide.jsx:106](../frontEnd-react/src/features/guide/ContextualSectionGuide.jsx#L106), nhưng container dùng `role="complementary"` tại [ContextualSectionGuide.jsx:141](../frontEnd-react/src/features/guide/ContextualSectionGuide.jsx#L141). Runtime guide mobile chiếm `342×296px`, che phần giao dịch gần đây; nút đóng chỉ `24×24px`.

**Tác động:** Tài khoản mới trông như đã có quyết định tài chính; guide tạo tải nhận thức và có thể che focus/nội dung mà không có focus management tương xứng.

**Đề xuất:** Checklist onboarding theo tiến trình: currency → thu nhập tùy chọn → ví đầu tiên → giao dịch/import → mục tiêu/ngân sách. Nếu cần template, yêu cầu người dùng xác nhận trước khi tạo. Guide chuyển thành coachmark/disclosure chủ động hoặc dialog đúng semantics.

**Acceptance criteria:** Register không tự tạo ngân sách như dữ liệu thật; dữ liệu mẫu có nhãn và cơ chế bỏ; guide không tự mở lặp theo view, không che CTA/focus, có Escape/focus restore nếu modal-like.

### UX-07 — [P1/P2] Ngôn ngữ và locale không nhất quán

**Loại:** Content design, i18n.  
**Flow:** Landing, auth, Settings, category, browser title.

**Bằng chứng:** Login trộn Việt/Anh (`Welcome Back`, `Email Address`, `FORGOT PASSWORD?`, `LOG IN`, `BACK TO HOME`, `SIGN UP`) tại [LoginPage.jsx:63](../frontEnd-react/src/pages/LoginPage.jsx#L63); Signup tương tự tại [SignupPage.jsx:78](../frontEnd-react/src/pages/SignupPage.jsx#L78). Category mặc định dùng tiếng Anh tại [auth.js:100](../backEnd/server/routes/auth.js#L100). EN/ZH bị disable nhưng tooltip là literal `updating` tại [AppUtilities.jsx:123](../frontEnd-react/src/components/ui/AppUtilities.jsx#L123). Page title cố định tiếng Anh tại [index.html:8](../frontEnd-react/index.html#L8).

**Tác động:** Giảm độ tin cậy, tăng tải nhận thức và làm dữ liệu category khó đổi locale.

**Đề xuất:** Locale mặc định `vi`; category lưu stable key, label dịch ở presentation; ẩn locale chưa hỗ trợ hoặc dùng “Sắp có”; route-driven document title.

**Acceptance criteria:** Không còn chuỗi user-facing ngoài catalog i18n; auth thuần Việt ở locale vi; category cũ migrate an toàn; title/description đúng route/locale.

### UX-08 — [P1/P2] Claims tài chính thiếu nguồn và cá nhân hóa quá mức

**Loại:** Content risk, trust.  
**Flow:** Plan, Jars, contextual help, Analytics.

**Bằng chứng:** “tăng 70% khả năng hoàn thành” tại [JarsView.jsx:545](../frontEnd-react/src/features/jars/JarsView.jsx#L545); “tối ưu hóa 15%–25% thu nhập” tại [PlanOverviewTab.jsx:824](../frontEnd-react/src/features/plan/PlanOverviewTab.jsx#L824); mục tiêu tiết kiệm `≥20%` tại [AnalyticsView.jsx:1033](../frontEnd-react/src/features/analytics/AnalyticsView.jsx#L1033) và [AnalyticsView.jsx:1417](../frontEnd-react/src/features/analytics/AnalyticsView.jsx#L1417).

**Tác động:** Guidance chung bị hiểu như tư vấn cá nhân hoặc kết luận có cơ sở dữ liệu.

**Đề xuất:** Bỏ phần trăm không có nguồn; gắn nhãn “gợi ý chung”; cho người dùng cấu hình target; review pháp lý/content trước khi dùng claim định lượng.

**Acceptance criteria:** Mỗi claim định lượng có nguồn/version/date hoặc bị loại; target mặc định không được gọi là “chuẩn”; recommendation nêu dữ liệu đã dùng và mức bất định.

### UX-09 — [P2] Landing page trình bày demo metrics như live/system metrics

**Loại:** Nội dung gây hiểu nhầm, responsive.  
**Flow:** Landing → Signup/Login.

**Bằng chứng:** `$24,811`, `312`, `↓7.2%` trong vùng `aria-label="System metrics"` tại [LandingPage.jsx:207](../frontEnd-react/src/pages/LandingPage.jsx#L207); preview dùng `$24,811.50`, `+$6,200`, `-$1,843` cùng nhãn live tại [LandingPage.jsx:285](../frontEnd-react/src/pages/LandingPage.jsx#L285).

**Tác động:** Dễ bị hiểu là dữ liệu người dùng, dữ liệu live hoặc proof point sản phẩm.

**Đề xuất:** Gắn badge “Dữ liệu minh họa”; đổi accessible label; hoặc thay metric giả bằng lợi ích/chức năng có thể kiểm chứng. Tối ưu hero tablet khi device preview bị ẩn.

**Acceptance criteria:** Mock data luôn có nhãn thị giác và accessible; không dùng “live/system” nếu không thật; hero ở `768–1024px` không có khoảng trống bất thường.

### UX-10 — [P1/P2] Contrast, focus và cỡ chữ nhỏ chưa có bằng chứng đạt chuẩn

**Loại:** Accessibility, design-system debt.  
**Flow:** Toàn bộ sản phẩm và bốn theme.

**Bằng chứng:** Spot check Light theme: `rgb(16,185,129)` trên `rgb(244,244,245)` ≈ `2.31:1`; `#94a3b8` trên trắng ≈ `2.56:1`; `#059669` trên xanh nhạt ≈ `3.45:1`, đều đáng lo với text `11–13px`. Static scan có 235 khai báo CSS `font-size: 8–11px`, 45 `outline: none/0`, chỉ 13 occurrence `:focus-visible`; 118 token màu hardcode duy nhất trong JSX (363 lần xuất hiện). Có reduced-motion global tại [base.css:289](../frontEnd-react/src/assets/css/base.css#L289), đây là điểm tốt.

**Tác động:** Text/status/focus có thể khó đọc hoặc không nhìn thấy ở một số theme/state; hardcoded colors làm lỗi lặp lại.

**Đề xuất:** Ma trận token theo semantic role/state/theme; test contrast render thực tế; focus ring 2 lớp hoặc token đảm bảo tương phản; scale typography tối thiểu cho body/caption.

**Acceptance criteria:** Text thường đạt `4.5:1`, large text `3:1`; component/focus state đạt tiêu chí non-text phù hợp; keyboard focus luôn thấy; không dùng `outline:none` nếu không có thay thế; CI scan token + visual regression cho bốn theme.

### UX-11 — [P2] Quá tải thông tin và IA dùng scroll thay cho cấu trúc

**Loại:** Information architecture, cognitive load.  
**Flow:** Sidebar, Analytics, Jars, trạng thái rỗng.

**Bằng chứng:** Sidebar định nghĩa 12 destination và hai nhãn “Tổng quan” tại [SidebarNav.jsx:102](../frontEnd-react/src/components/layout/SidebarNav.jsx#L102). Analytics subitem chủ yếu gọi `scrollIntoView` trong cùng trang tại [SidebarNav.jsx:74](../frontEnd-react/src/components/layout/SidebarNav.jsx#L74). Runtime empty Analytics vẫn render KPI, chart, report summary, insight và table; empty Jars vẫn render KPI, chart, progress, activity, education.

**Tác động:** Người mới phải quét nhiều cấu trúc không có dữ liệu; navigation không dự đoán được vì subitem đôi khi là tab, đôi khi là scroll anchor.

**Đề xuất:** Progressive disclosure; route/tab thật cho khu vực lớn; một empty state chính với 2–3 bước tiếp theo; chỉ mở report nâng cao khi có dữ liệu hoặc theo chủ động.

**Acceptance criteria:** Mỗi destination có mô hình nhất quán; empty state giữ tối đa một primary CTA + hai secondary steps; không render chart/table vô nghĩa; usability test xác nhận người dùng tìm được 4 tác vụ cốt lõi.

### UX-12 — [P2] Typography kỹ thuật bị lạm dụng

**Loại:** Readability, design-system debt.  
**Flow:** Auth, KPI, captions, guide, status.

**Bằng chứng:** 235 khai báo CSS ở `8–11px`; auth security note inline `11px` tại [LoginPage.jsx:113](../frontEnd-react/src/pages/LoginPage.jsx#L113) và [SignupPage.jsx:138](../frontEnd-react/src/pages/SignupPage.jsx#L138). Monospace/uppercase/tracking được dùng ngoài mã và micro-label.

**Tác động:** Khó đọc ở mobile/zoom, giảm hierarchy và tạo cảm giác “dashboard kỹ thuật” cho nội dung tài chính giải thích.

**Đề xuất:** Scale `display / h1–h3 / body / label / caption`; body ưu tiên Inter, monospace chỉ cho số liệu hoặc mã; caption không mặc định dưới `12px`, nội dung hướng dẫn ưu tiên `14–16px`.

**Acceptance criteria:** Token typography thay cho giá trị rời rạc; audit không còn body/help text dưới ngưỡng đã chốt; reflow 200% không cắt chữ/control.

### UX-13 — [P2] Component/CSS quá lớn và hardcode làm tăng hồi quy

**Loại:** Design-system debt, maintainability.  
**Flow:** Cross-feature.

**Bằng chứng:** JSX/CSS tổng `50.179` dòng; `components.css` `11.580`, `modals.css` `4.228`, `themes.css` `2.734`, `JarsView.jsx` `2.116`, `WalletsTab.jsx` `1.775`, `AnalyticsView.jsx` `1.601`. Có 358 inline style prop và 118 token màu JSX duy nhất.

**Tác động:** Khó sửa một state/theme mà không gây hồi quy; logic data, content và presentation bị trộn trong feature lớn.

**Đề xuất:** Tách primitives (`Button`, `IconButton`, `EmptyState`, `MetricCard`, `Tabs`, `DialogShell`), patterns và feature sections; semantic tokens; Storybook/visual regression sau khi behavior được khóa.

**Acceptance criteria:** Không refactor theo line count đơn thuần; mỗi extraction có contract, state matrix, accessibility test và screenshot baseline; giảm inline hardcode qua token có owner.

### UX-14 — [P2] Error UI không theo theme và có thể lộ chi tiết kỹ thuật

**Loại:** Error UX, privacy, design system.  
**Flow:** React render failure và lỗi API/feature.

**Bằng chứng:** ErrorBoundary dùng màu Light hardcode tại [ErrorBoundary.jsx:23](../frontEnd-react/src/components/ui/ErrorBoundary.jsx#L23), render trực tiếp `error.message` tại dòng 56 và log full error/info tại dòng 15. Nhiều store truyền `error.message` lên UI; RecurringModal toast trực tiếp.

**Tác động:** Không nhất quán với Dark/Cream/Green; thông điệp kỹ thuật khó hiểu và có nguy cơ lộ chi tiết implementation.

**Đề xuất:** Error taxonomy + mã tham chiếu; copy thân thiện; CTA retry/login/support; telemetry đã lọc riêng, không đưa stack/detail vào UI.

**Acceptance criteria:** ErrorBoundary dùng semantic token của cả bốn theme; UI không render raw exception; lỗi auth/network/validation có copy và recovery riêng; test error state có focus chuyển tới alert hợp lý.

### UX-15 — [P2/P3] Loading và contextual help chưa tối ưu

**Loại:** Perceived performance, accessibility.  
**Flow:** Plan, Jars, guide.

**Bằng chứng:** Nhiều vùng dùng text “Đang tải…” như [PlanOverviewTab.jsx:578](../frontEnd-react/src/features/plan/PlanOverviewTab.jsx#L578) và [JarsView.jsx:1602](../frontEnd-react/src/features/jars/JarsView.jsx#L1602). Guide tự mở, che nội dung và dùng semantics complementary như UX-06. Điểm tốt: `prefers-reduced-motion` đã được xử lý global.

**Tác động:** Layout nhảy; người dùng có thể nhầm loading thành zero-data; help cạnh tranh với tác vụ chính.

**Đề xuất:** Skeleton cho card/table quan trọng, giữ chiều cao; loading/empty/error là state loại trừ; help mở theo chủ động và nhớ trạng thái theo account/version.

**Acceptance criteria:** Không hiện số 0 trong lúc loading; skeleton có accessible status nhưng không spam screen reader; guide không che focus/CTA; animation tắt ở reduced motion.

### UX-16 — [P1/P2] Scroll performance thiếu budget; Jars/Analytics tạo DOM và paint surface quá lớn

**Loại:** Runtime performance, perceived quality, information architecture.  
**Flow:** Landing, Analytics, Jars và các danh sách tăng dần theo dữ liệu.

**Bằng chứng runtime:** [scroll-performance.json](ux-ui-evidence/scroll-performance.json) ghi nhận trên Chromium headless `1440×900`:

- Home rỗng: `237` DOM element, `201` visible element, main-thread task khoảng `34ms` trong lượt đo.
- Analytics rỗng: `487` DOM element, trang cao `1.881px`, khoảng `206ms` main-thread, gồm khoảng `30ms` layout và `17ms` style recalculation.
- Jars rỗng: `513` DOM element, trang cao `1.827px`.
- Jars với 20 hũ: `1.839` DOM element, `1.387` visible element, trang cao `4.761px`, `101` SVG và `61` element có box-shadow. Danh sách render toàn bộ bằng `.map()` tại [JarsView.jsx:1623](../frontEnd-react/src/features/jars/JarsView.jsx#L1623), chưa paginate/virtualize/content-visibility.
- Landing có `13` animation chạy đồng thời trong lần đo. Hai orb cố định kích thước `600px` và `450px` animation vô hạn tại [landing.css:97](../frontEnd-react/src/assets/css/landing.css#L97); device preview cũng float vô hạn tại [landing.css:415](../frontEnd-react/src/assets/css/landing.css#L415).

**Bằng chứng kiến trúc:**

- Toàn bộ 14 stylesheet được import toàn cục tại [main.jsx:4](../frontEnd-react/src/main.jsx#L4); bundle build hiện khoảng `545.56kB CSS`, `492.26kB app JS`, `196.50kB chart JS` trước gzip.
- App/feature đều import tĩnh, chưa có route/feature-level `React.lazy`; Analytics đăng ký Chart.js ngay khi module được load tại [AnalyticsView.jsx:1](../frontEnd-react/src/features/analytics/AnalyticsView.jsx#L1).
- Static scan CSS có 151 `transition: all`, 749 khai báo `box-shadow`, 38 `backdrop-filter`, 60 `filter` và 70 `animation`. Đây là chỉ báo nợ paint/compositing, không đồng nghĩa tất cả cùng hoạt động.
- Analytics/Jars dùng IntersectionObserver để cập nhật subtab khi cuộn tại [AnalyticsView.jsx:806](../frontEnd-react/src/features/analytics/AnalyticsView.jsx#L806) và [JarsView.jsx:122](../frontEnd-react/src/features/jars/JarsView.jsx#L122). Đây không phải thủ phạm chính trong profiler, nhưng store update ở ranh giới section cần được giữ nhẹ.
- `content-visibility:auto` hiện chỉ áp dụng cho transaction slot tại [components.css:1651](../frontEnd-react/src/assets/css/components.css#L1651), chưa áp dụng cho section dài/card list.
- Nhiều component Plan dùng subscription toàn store thay vì selector, ví dụ [WalletsTab.jsx:279](../frontEnd-react/src/features/plan/WalletsTab.jsx#L279), làm tăng khả năng render lại không cần thiết khi store thay đổi.

**Kết luận nguyên nhân:** Không có bằng chứng về một scroll listener JavaScript chạy liên tục gây nghẽn. Khựng nhiều khả năng là hiệu ứng cộng dồn của (1) DOM/trang quá dài, đặc biệt Jars; (2) nhiều SVG, shadow, sticky layer và hiệu ứng paint; (3) animation cố định/vô hạn trên Landing; (4) chart và mọi feature tải sớm; (5) render lại rộng khi state thay đổi. Máy audit mạnh/headless vẫn giữ 60fps, nên cần xác nhận lại trên thiết bị người dùng bằng Chrome Performance trace.

**Đề xuất:**

1. Rút gọn empty state và tách Analytics/Jars thành route/tab để giảm content render đồng thời.
2. Paginate hoặc virtualize Jars/transaction/history; áp dụng `content-visibility:auto` + `contain-intrinsic-size` cho section/card off-screen trước khi cần virtualization.
3. Lazy-load route/feature và Chart.js; chỉ mount chart khi section gần viewport; tắt chart animation khi reduced motion hoặc update dữ liệu.
4. Giảm infinite animation/filter/shadow; thay `transition: all` bằng thuộc tính cụ thể; tạo motion/performance tokens.
5. Chuyển broad Zustand subscription sang selector nhỏ; đo bằng React Profiler trước/sau.
6. Thiết lập performance budget và regression test trên ít nhất một máy tầm trung/thấp.

**Acceptance criteria:**

- Scroll test trên fixture `360 giao dịch / 20 hũ / 4 theme`: p95 frame time `≤20ms`, không có long task `>50ms` phát sinh bởi scroll; báo riêng thiết bị/browser.
- Jars 20 item không mount toàn bộ nội dung nặng cùng lúc; DOM mục tiêu dưới `800` node ở viewport đầu hoặc có giải trình/baseline được duyệt.
- Landing không có quá 3 animation vô hạn đồng thời; reduced motion không còn animation chuyển động/blur.
- Analytics/Jars section dưới fold được defer; chart bundle không tải trên Landing/Auth/Home nếu chưa cần.
- Không dùng `transition: all` trong component được sửa; shadow/filter có token “standard” và “reduced-effects”.
- Có trace trước/sau và test tự động ghi lại DOM count, long task, bundle size; không dùng FPS headless đơn lẻ để tuyên bố hoàn tất.

## 5. Những điểm đang làm tốt

- Desktop có hierarchy rõ, CTA chính dễ nhận biết và card system tương đối nhất quán.
- Dark, Light, Cream, Green có bản sắc riêng; browser test xác nhận account control vẫn dùng được ở cả bốn theme.
- Outline icon vocabulary thống nhất, ít phụ thuộc emoji trong UI chính.
- Transaction modal đã có semantics dialog/focus behavior; test browser xác nhận thao tác ghi giao dịch và lỗi mạng không giả thành công.
- Nhiều modal hỗ trợ Escape, focus trap và ARIA.
- Auth có autocomplete, validation và session handling tốt; cookie HttpOnly và logout nhiều tab đã có test.
- Analytics đã có một số copy đúng “Chưa có dữ liệu”; đây là pattern nên mở rộng.
- Định dạng ngày/VND phần lớn đã bản địa hóa.
- `prefers-reduced-motion` có rule global.
- Không có overflow ngang trong các viewport runtime đã đo.

## 5.1 Addendum sau batch triển khai đầu tiên — 22/09/2026

Các nguyên nhân và ưu tiên của audit không thay đổi, nhưng batch đầu đã giảm các rủi ro dễ xử lý:

- Tổng JavaScript khởi đầu production hiện là `265.08 kB` nhờ tách route/feature; Analytics kèm Chart.js nằm trong chunk `226.63 kB` tải theo nhu cầu và không còn tải ở Landing/Auth/Home.
- CSS khởi đầu giảm từ khoảng `545.56 kB` xuống `509.90 kB`; đây vẫn là khoản nợ lớn vì stylesheet foundation/feature còn import toàn cục.
- Hũ rỗng không còn dựng toàn bộ dashboard/biểu đồ; trạng thái rỗng chuyển thành một CTA có chủ đích.
- Analytics/Jars dưới fold dùng `content-visibility`; chart animation bị tắt; Landing giảm hai animation vô hạn; guide nổi bỏ backdrop blur và không còn che bottom navigation.
- Kết luận “an toàn/ổn định” khi rỗng đã được thay bằng `insufficient data` trong các vùng ưu tiên; tài khoản mới không còn ngân sách mẫu.
- Safety net mới kiểm tra entry/CSS budget, chart preload, mobile navigation, touch target, overflow, currency và onboarding. Kết quả này chưa chứng minh scroll p95 trên thiết bị thật; trace trên máy người dùng vẫn là gate còn mở.

## 5.2 Addendum sau batch triển khai thứ hai — 23/09/2026

- Deep-link đã hoạt động cho Home, bốn tab Kế hoạch, bốn tab Phân tích và ba tab Hũ. Reload, bookmark, Back/Forward, page title và focus theo route đã có browser regression.
- Trên mobile, Analytics chỉ mount section của route hiện tại. Khi ở Tổng quan, DOM không đồng thời chứa Chi tiêu, Dòng tiền và Báo cáo.
- Trên mobile, Hũ chỉ mount màn Mục tiêu, Danh sách hoặc Lịch sử. Danh sách được phân trang `12` item/trang ở cả grid và list; SVG ngoài vùng nhìn thấy chỉ mount khi tiến gần viewport. Với fixture 20 hũ trên viewport `390×844`, route Danh sách mount `12` card và đo `479–485` node thay cho baseline `1.839` node, giảm khoảng `74%` và đạt budget `<800`. Empty Jars đo `14` node.
- Phần còn mở là fixture 50 hũ, giảm paint/shadow và phân trang activity/history; không tuyên bố đã xử lý dứt điểm FPS trước khi có trace thiết bị thật.
- Contextual guide không còn tự bung card che nội dung khi đổi view; mặc định chỉ hiển thị disclosure button 44px và chỉ mở nội dung theo chủ động.
- Production budget hiện đo được: entry `235.986 byte`, tổng JavaScript khởi đầu `269.996 byte`, CSS khởi đầu `513.985 byte`; Chart.js vẫn không nằm trong initial preload.
- Toàn bộ `11/11` browser scenario pass sau thay đổi, bao gồm route con Analytics, lịch sử điều hướng và phân trang Hũ; frontend build/lint và budget test đều pass.

## 5.3 Addendum tích hợp bản tối ưu bổ sung — 23/09/2026

Đã đối chiếu toàn bộ 11 hạng mục trong `full_optimization_summary.md` với mã hiện hành:

- Các tối ưu memo BigInt, request cache semantics, AppShell/Page skeleton, spinner, keyframe và animation Chart.js đã có trong workspace và được giữ lại.
- Chart animation được bổ sung Reduced Motion ở cấp JavaScript; CSS Reduced Motion trước đó không tự vô hiệu hóa animation nội bộ của Chart.js canvas.
- Smooth scroll được đơn giản hóa: `SpendingRouteSync` là nơi duy nhất focus/cuộn sau khi route content mount. Cách này tránh Sidebar, Mobile navigation và route effect cùng điều khiển scroll.
- Kiến trúc sau quyết định Product mới nhất là responsive hybrid: desktop hợp nhất các section và dùng RAF ScrollSpy; mobile giữ mỗi section theo route để giảm DOM. Deep-link vẫn giữ reload/Back/Forward/title, còn ScrollSpy desktop không ghi URL.
- API GET vẫn không được lưu ở browser vì server chủ động trả `Cache-Control: no-store` cho `/api`. Đây là lựa chọn bảo mật đúng với dữ liệu tài chính; thay đổi client chỉ bỏ một policy trùng lặp, không làm suy yếu header máy chủ.
- Sau hợp nhất: build/lint sạch, production bundle budget pass, `11/11` browser scenario pass; DOM route Danh sách với fixture 20 hũ đo `479` node ở lượt xác nhận gần nhất.

## 5.4 Addendum thực thi `implementation_plan.md` — 23/09/2026

- Analytics desktop `>900px` hiển thị đủ Tổng quan, Chi tiêu, Dòng tiền và Báo cáo; Hũ hiển thị đủ Mục tiêu, Danh sách và Lịch sử. Trên mobile `<=900px`, chỉ tab đang chọn được mount.
- ScrollSpy dùng listener passive và `requestAnimationFrame`; chỉ cập nhật active subtab với `syncRoute:false`. Nhánh cuối trang bảo đảm Báo cáo/Lịch sử vẫn active khi section cuối không thể chạm offset đầu viewport.
- Bộ lọc trả góp/thanh toán định kỳ nhận diện `installmentId` hoặc tiền tố `Thanh toán định kỳ:`, lọc trong RAM, không gọi API/không khóa thao tác, có badge số khoản và tổng tiền bị loại theo đúng range.
- Cảnh báo ngân sách chỉ dùng kiểu `is-overdue-danger` khi `spent > limit`; trường hợp bằng đúng hạn mức không bị gọi là bội chi. Icon là outline rỗng, không có animation pulse; progress dùng vân tĩnh.
- Browser regression đã kiểm chứng breakpoint desktop/mobile, ScrollSpy, bộ lọc, overflow và bốn theme. Unit test mới bao phủ nhận diện/lọc/tổng hợp giao dịch định kỳ.

## 5.5 Addendum Unified Settings Center — 23/09/2026

- Hai modal `Cài đặt` và `Quản lý tài khoản` đã được hợp nhất thành một Settings Center và một nguồn state; nút bánh răng mở `Ngôn ngữ & khu vực`, avatar mở `Hồ sơ`.
- Desktop dùng navigation hai cột; mobile dùng full-screen detail có back navigation. Logic hồ sơ, bảo mật, dữ liệu, theme, hướng dẫn và logout hiện hữu được tái sử dụng, không thay đổi các module Dashboard ngoài entry point.
- Đã bổ sung cảnh báo thay đổi chưa lưu, focus trap/restore, Escape, touch target `44–48px`, password autocomplete và outline icon. Confirm Dialog được sửa stacking/scroll lock để hoạt động đúng khi lồng trong Settings Center.
- Kịch bản browser mới bao phủ hai entry point, navigation, theme, hướng dẫn, dữ liệu chưa lưu, focus restore và mobile full-screen. Tổng hiện tại là `12/12` scenario pass, không có unhandled browser error.
- Production budget mới nhất: entry `235.986 byte`, tổng JavaScript khởi đầu `269.992 byte`, CSS khởi đầu `521.406 byte`; Chart.js vẫn không nằm trong initial preload.

## 6. Backlog triển khai theo sprint

### Sprint 1 — Khả dụng và niềm tin

| ID | Hạng mục | Dependency | Rủi ro chính | Done khi |
|---|---|---|---|---|
| UX-01 | Mobile/tablet navigation | Chốt IA 4 destination | Bottom bar che content/safe area | Pass keyboard/touch ở 390, 768, 1024; active state rõ |
| UX-02 | Target size/focus ưu tiên control chính | Token spacing/focus | Tăng kích thước làm vỡ layout | Target audit pass; không overlap; focus visible |
| UX-04 | State machine loading/insufficient/measured | Quy tắc đủ dữ liệu | Copy không đồng nhất giữa feature | Fixtures 0/partial/full pass; không verdict sai |
| UX-05 | Ẩn currency chưa hoạt động | Product decision | Người dùng hiện tại đã lưu USD/CNY | Chỉ VND hiển thị; migration local state an toàn |
| UX-06 | Bỏ ngân sách giả + onboarding checklist | Backend migration/product | Tài khoản cũ và mới khác hành vi | Register mới không auto-budget; template cần consent |
| UX-16 | Performance baseline + quick wins | Fixture lớn, thiết bị chuẩn | Tối ưu cảm tính, không tái hiện | Trace trước/sau; giảm animation/paint; budget được chốt |

### Sprint 2 — Điều hướng và nội dung

| ID | Hạng mục | Dependency | Rủi ro chính | Done khi |
|---|---|---|---|---|
| UX-03 | Route/deep-link | IA Sprint 1 | Mất state modal/filter | Reload/back/forward/bookmark pass |
| UX-07 | Chuẩn hóa vi/i18n/category key | Data migration | Đổi category phá báo cáo | Stable keys + migration + catalog coverage |
| UX-11 | Rút gọn Analytics/Jars empty state | UX-04 | Ẩn nhầm thông tin hữu ích | Progressive disclosure test với user tasks |
| UX-08 | Review claims tài chính | Content/legal/product | Claim cũ rải rác | Claim inventory có owner/source/removal |
| UX-09 | Gắn nhãn demo landing | Marketing/content | Giảm “wow factor” | Mock/live không thể nhầm bằng mắt và screen reader |
| UX-15 | Loading/help patterns | UX-04, modal primitive | Skeleton gây motion/spam SR | State exclusive + reduced-motion pass |
| UX-16 | Tách Analytics/Jars + paginate/defer | UX-03, UX-11 | Virtualization ảnh hưởng keyboard/SR | DOM/long-task/frame budget pass trên fixture lớn |

### Sprint 3 — Accessibility và design system

| ID | Hạng mục | Dependency | Rủi ro chính | Done khi |
|---|---|---|---|---|
| UX-10 | Contrast/focus matrix 4 theme | Semantic color tokens | Sửa một theme làm hỏng theme khác | Automated + manual matrix pass, không tuyên bố quá phạm vi |
| UX-12 | Typography scale | Content hierarchy | Reflow làm tăng chiều dài trang | Token adoption + 200% browser zoom QA |
| UX-13 | Primitive/pattern extraction | Behavior baselines | Refactor lớn gây hồi quy | Visual/accessibility tests trước và sau |
| UX-14 | Error taxonomy/UI | API error contract | Che mất thông tin hỗ trợ debug | User-safe copy + reference id + scrubbed telemetry |

### Sprint 4 — Kiểm chứng và khả năng duy trì

- Hoàn thiện visual regression cho bốn theme, các viewport và state `loading/empty/error/full`.
- Chạy axe/Lighthouse như gate hỗ trợ, nhưng vẫn giữ manual keyboard/screen-reader checks.
- Usability test các nhiệm vụ: tạo ví, ghi giao dịch, đặt ngân sách, đọc cash flow, tạo hũ.
- Đo task completion, error rate, time-on-task và khả năng diễn giải đúng các chỉ số tài chính.
- Refactor tiếp component lớn chỉ khi có baseline hành vi và metric hồi quy.

## 7. Thứ tự quyết định cần chốt trước khi code UI

1. Chốt mobile IA: bottom navigation + drawer phụ là phương án mặc định đề xuất.
2. Chốt chính sách dữ liệu khởi tạo: không auto-budget; template chỉ sau consent.
3. Chốt định nghĩa `insufficient data` cho từng insight/KPI.
4. Chốt currency: ẩn USD/CNY trong ngắn hạn hay đầu tư domain model đầy đủ.
5. Chốt locale mặc định và chiến lược stable category key.

Sau năm quyết định này, backlog có thể chuyển thành ticket triển khai mà không cần diễn giải lại mục tiêu UX.

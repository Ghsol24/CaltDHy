# CaltDHy — Kế hoạch chỉnh sửa UX/UI

**Nguồn:** `docs/UX-UI-AUDIT.md`  
**Trạng thái:** Đang triển khai — batch 1, 2, responsive analytics và Unified Settings Center hoàn tất ngày 23/09/2026  
**Mục tiêu:** Khôi phục khả dụng mobile, sửa lỗi niềm tin tài chính, cải thiện độ mượt và tạo nền tảng accessibility/design system có thể kiểm chứng.

## 0. Tiến độ triển khai

### Đã hoàn tất trong batch 1

- Thêm bottom navigation bốn destination ở mobile/tablet và sub-navigation 44px cho Plan/Analytics/Hũ; có `aria-current`, safe-area và không còn phụ thuộc sidebar bị ẩn.
- Sửa guide nổi che bottom navigation ở màn hình 390px; nút đóng/CTA guide đạt vùng chạm 44px.
- Ẩn USD/CNY giả; Settings chỉ hiển thị VND là đơn vị đang hỗ trợ.
- Bỏ tự động tạo bốn ngân sách mẫu khi đăng ký. Tài khoản mới chỉ có ví Tiền mặt mặc định; ngân sách do người dùng chủ động tạo.
- Sửa copy thiếu dữ liệu ở Home/Plan/Analytics; Hũ rỗng chỉ hiển thị một CTA thay vì dashboard, biểu đồ và nhận định “an toàn/ổn định”.
- Tách route và bốn feature chính bằng dynamic import. Tổng JavaScript khởi đầu production hiện là `265.08 kB`; Analytics kèm Chart.js nằm trong chunk tải theo nhu cầu và không còn tải trên Landing/Auth/Home.
- Tắt Chart.js animation, debounce resize; thêm `content-visibility` cho section Analytics/Jars dưới fold; giảm animation vô hạn trên Landing; bỏ blur khỏi guide nổi.
- Thu hẹp Zustand subscription ở shell, settings, guide và các component Plan đã chạm tới.
- Thêm budget test production bundle và browser regression cho mobile navigation, 44px touch target, horizontal overflow, currency, onboarding và empty Jars DOM.

### Đã hoàn tất trong batch 2

- Chuyển khu vực sau đăng nhập sang deep-link thật: `/spending/home`, các route con của Kế hoạch, Phân tích và Hũ; URL có thể reload/bookmark và hỗ trợ Back/Forward.
- Đồng bộ route với Zustand theo một nguồn điều hướng nguyên tử; route cập nhật `document.title`, focus đúng nội dung và có fallback cho URL không hợp lệ.
- Trên mobile, Phân tích chỉ mount section của tab đang mở; Overview, Chi tiêu, Dòng tiền và Báo cáo không dựng chéo trong DOM.
- Trên mobile, Hũ cũng chỉ mount màn Mục tiêu, Danh sách hoặc Lịch sử theo route hiện tại.
- Hũ phân trang `12` item/trang ở cả grid và list; nút thêm hũ dùng semantic button; điều khiển phân trang có `aria-current`, nhãn truy cập và vùng chạm `44px`.
- SVG minh họa Hũ ngoài vùng nhìn thấy được trì hoãn bằng IntersectionObserver và giữ placeholder đúng kích thước để tránh layout shift.
- Browser regression kiểm tra deep-link, reload, Back/Forward, title, mobile không mount chéo, phân trang 20 hũ và DOM budget.
- Guide theo ngữ cảnh chuyển sang disclosure chủ động: mặc định chỉ là nút gợi ý 44px, không tự bung card che nội dung; browser test kiểm tra mở/đóng trên mobile.

### Tích hợp `full_optimization_summary.md` — 23/09/2026

- Đã xác nhận và giữ các tối ưu có sẵn: `MoneyDisplayGuard` dùng memo cho phép tính BigInt; GET/HEAD không bị client ép `no-store`; AppShell/Page skeleton; spinner dùng chung; `fadeIn`/`viewFadeIn`; panel Analytics không chạy animation khi đi vào viewport.
- Giữ animation Chart.js `850ms` cho biểu đồ tròn và `900ms` cho biểu đồ cột, nhưng bổ sung theo dõi `prefers-reduced-motion` để tắt animation ngay khi hệ điều hành yêu cầu giảm chuyển động.
- Hợp nhất điều hướng cuộn về một owner là `SpendingRouteSync`: mọi route con cuộn mượt tới heading, gồm cả `overview`; loại bỏ timer, cờ global và lệnh scroll trùng ở Sidebar/Mobile navigation.
- Theo quyết định Product mới nhất, desktop `>900px` dùng trang cuộn liền mạch và RAF ScrollSpy cho cả Analytics/Hũ; mobile `<=900px` tiếp tục route-only rendering. ScrollSpy chỉ đổi active state với `syncRoute:false`, không làm nhiễu URL/title/history.
- Thay đổi cache phía client không làm cache dữ liệu tài chính nhạy cảm: backend vẫn đặt `Cache-Control: no-store` cho toàn bộ `/api`; trình duyệt chỉ có thể cache nếu policy máy chủ được thay đổi có chủ đích sau này.

### Responsive Analytics, lọc định kỳ và cảnh báo ngân sách — 23/09/2026

- Desktop dựng đủ bốn section Analytics và ba section chính của Hũ trong một luồng cuộn; ScrollSpy passive, gộp bằng `requestAnimationFrame` và xử lý chính xác section cuối trang.
- Mobile giữ đúng mô hình chỉ mount tab đang chọn để bảo vệ DOM budget và tránh trang cuộn quá dài.
- Biểu đồ dòng tiền có toggle loại trả góp/thanh toán định kỳ chạy hoàn toàn ở client, không khóa 30 giây; phản hồi animation `250ms` khi đổi dữ liệu và hiển thị số khoản/tổng tiền đã loại.
- Thẻ thực sự vượt hạn mức có viền nhấn, nền riêng theo Light/Dark/Cream/Green, nhãn `Vượt hạn mức +X`, progress vân tĩnh và `AlertTriangleOutlineIcon` không tô fill; không có pulse/glow động.

### Unified Settings Center — 23/09/2026

- Hợp nhất `Cài đặt` và `Quản lý tài khoản` thành một Settings Center, một modal state và một navigation model; loại bỏ hai luồng mở/đóng bị trùng.
- Nút Cài đặt mở `Ngôn ngữ & khu vực`; avatar/user chip mở `Hồ sơ`; không thay đổi thiết kế Dashboard ngoài hai entry point liên quan.
- Desktop dùng bố cục hai cột; mobile dùng full-screen detail có nút quay lại danh sách, vùng chạm `44–48px` và không dùng animation scale không cần thiết.
- Tái sử dụng toàn bộ logic Hồ sơ, Bảo mật, xuất/đặt lại dữ liệu, theme và hướng dẫn; chỉ hiển thị tiếng Việt/VND là khả năng đang hoạt động.
- Đăng xuất được tách ở cuối navigation, có confirm; form chưa lưu có confirm trước khi đóng hoặc chuyển section.
- Bổ sung focus trap/restore, Escape, `aria-current`, accessible name, liên kết label/input, password autocomplete và icon SVG outline không tô màu.
- Sửa stacking và khóa cuộn của Confirm Dialog để dialog con luôn tương tác được khi mở từ Settings Center.
- Browser regression kiểm tra hai entry point, theme, hướng dẫn, dữ liệu chưa lưu, focus restore và mobile full-screen/back navigation.

### Đã kiểm chứng

- Frontend build thành công; lint không có lỗi mới.
- `48/48` backend test và các test guard/số học hiện có đều pass.
- `12/12` browser scenario pass, gồm mobile navigation, deep-link/reload/Back/Forward, touch target, không tràn ngang, desktop hybrid sections/ScrollSpy, mobile route-only DOM, lọc định kỳ, cảnh báo ngân sách bốn theme, Unified Settings Center và Chart.js không tải trước khi mở Phân tích.
- Fixture 20 hũ chỉ mount `12` card ở trang đầu; khi mở route Danh sách, DOM Hũ đo trong khoảng `479–485` node, giảm từ baseline `1.839` node và đạt budget `<800`. Empty Jars còn `14` node.
- Bundle budget: tổng JavaScript khởi đầu `269.992 byte`, entry `235.986 byte`, CSS khởi đầu `521.406 byte`; Analytics/Home/Jars/Plan là các chunk riêng; initial preload không chứa Chart.js.

### Còn lại cho batch tiếp theo

- Bổ sung fixture 50 hũ và paginate activity/history; tiếp tục giảm shadow/card paint trên thiết bị yếu nếu trace cho thấy còn nghẽn.
- Tiếp tục profile và memo hóa sâu phép tính Analytics trên fixture lớn; cân nhắc tách report/chart thành chunk nhỏ hơn nếu trace desktop cho thấy cần thiết.
- Hoàn thiện focus trap/restore cho các modal còn lại ngoài Settings Center/Confirm Dialog và smoke test bàn phím/screen reader thực tế.
- Stable category key + i18n, contrast matrix bốn theme, zoom 200%, screen-reader smoke test.
- Trace trên chính thiết bị đang thấy khựng; test headless không thay thế kết quả thiết bị thật.

## 1. Quyết định mặc định để bắt đầu

Kế hoạch dùng các quyết định sau, trừ khi Product thay đổi:

1. Mobile dùng bottom navigation cho `Trang chủ / Kế hoạch / Phân tích / Hũ`; sub-navigation nằm trong drawer/sheet hoặc tab của từng feature.
2. Tài khoản mới không tự tạo ngân sách thật. Template chỉ được áp dụng sau khi người dùng xác nhận.
3. VND là currency duy nhất trong giai đoạn đầu; ẩn USD/CNY thay vì giả lập chuyển đổi.
4. Locale mặc định là `vi`; category lưu stable key và dịch ở UI.
5. Mọi insight có ba trạng thái loại trừ: `loading`, `insufficient data`, `measured`.
6. Performance được xem là acceptance criterion của UX, không phải cleanup kỹ thuật sau cùng.

## 2. Performance budget

Budget phải được đo trên production build, fixture `360 giao dịch + 20 hũ`, ở cả Light và Dark:

| Chỉ số | Mục tiêu |
|---|---:|
| Scroll p95 frame time | `≤20ms` |
| Long task trong scroll | Không có task `>50ms` do app |
| DOM ở viewport đầu Jars | `<800` node hoặc baseline có giải trình |
| Infinite animation trên Landing | `≤3` |
| Route không dùng chart | Không tải chart chunk |
| Horizontal overflow | `0` tại 390/768/1024/1440 |
| CLS khi loading → content | `<0.1` cho flow chính |

Không dùng một con số FPS headless duy nhất làm tiêu chí pass. Mỗi PR hiệu năng cần lưu Chrome Performance trace trước/sau và ghi thiết bị/browser.

## 3. Kế hoạch theo phase

### Phase 0 — Baseline và safety net (2–3 ngày)

**Mục tiêu:** Có phép đo lặp lại trước khi thay UI.

- Tạo fixture cục bộ: empty, partial, full, 360 transactions, 20/50 jars, text dài, số tiền lớn.
- Thêm script đo bundle size, DOM count, long task và frame interval theo route.
- Chụp baseline bốn theme tại 390, 768, 1024, 1440 và browser zoom 200% thật.
- Ghi trace trên máy người dùng đang thấy khựng; xác định browser, refresh rate, theme và màn hình gây lỗi.
- Khóa screenshot/interaction tests cho flow hiện tại để tránh hồi quy chức năng.

**Gate:** Có baseline lưu trong CI artifact; tái hiện được ít nhất một trace khựng trên thiết bị thật hoặc ghi rõ chưa tái hiện.

### Phase 1 — P0 navigation + quick performance wins (Sprint 1)

#### 1.1 Mobile navigation

- Tạo `PrimaryNavigation` data model dùng chung desktop sidebar và mobile bottom bar.
- Bottom bar 4 destination, active state có `aria-current`; drawer/sheet cho destination con.
- Thêm padding safe-area và scroll padding để focus không bị che.

#### 1.2 Touch/focus

- Chuẩn hóa `Button`, `IconButton`, `NavItem` với hit area 44px; audit WCAG 24px/spacing.
- Focus ring semantic token dùng được ở bốn theme.
- Sửa trước các target đo được 14–41px và nút đóng guide.

#### 1.3 Quick performance wins

- Landing: giữ tối đa 2 orb/device animation; dừng animation khi tab hidden, reduced motion hoặc màn hình nhỏ; không animate `filter`.
- Thay `transition: all` trong các component chạm tới bằng danh sách thuộc tính cụ thể.
- Áp dụng `content-visibility:auto` + `contain-intrinsic-size` cho Analytics/Jars section dưới fold.
- Tắt/defer Chart.js animation khi load ngoài viewport và khi `prefers-reduced-motion`.
- Chuyển broad Zustand subscription trong các component Plan đang sửa sang selector nhỏ.

**Gate:** Navigation pass ở 390/768; focus/touch pass; trace không tệ hơn baseline; Landing infinite animation `≤3`.

### Phase 2 — Trust, onboarding và routing (Sprint 2)

#### 2.1 Empty/data state model

- Tạo `DataState`/`InsightState` dùng chung.
- Xóa verdict “an toàn/ổn định/tăng trưởng” nếu chưa đủ dữ liệu.
- Một primary CTA cho mỗi empty state; không render chart/table/report lớn khi rỗng.

#### 2.2 Onboarding

- Register chỉ tạo account; ví/ngân sách theo checklist hoặc consent.
- Guide chuyển thành checklist/disclosure chủ động; modal-like behavior phải có focus trap/Escape/restore.

#### 2.3 Route architecture

- `/spending/home`
- `/spending/plan/{overview|wallets|budgets|recurring}`
- `/spending/analytics/{overview|spending|cash-flow|reports}`
- `/spending/jars/{goals|list|history}`
- Back/Forward, bookmark, title và focus heading đúng route.

#### 2.4 Code splitting

- `React.lazy`/dynamic import theo route/feature.
- Chart.js chỉ tải ở Analytics; modal nặng chỉ tải khi mở.
- Tách CSS theo foundation/shell/feature, giữ semantic token toàn cục.

**Gate:** Empty/partial/full fixture pass; reload/back/forward pass; Landing/Auth/Home không tải chart chunk.

### Phase 3 — Jars/Analytics structural performance + IA (Sprint 3)

#### 3.1 Jars

- Paginate trước (`12` card/trang) để đảm bảo keyboard/screen-reader ổn định; chỉ dùng virtualization nếu 50+ item vẫn không đạt budget.
- Card off-screen không mount SVG nặng; lazy-mount `JarGlassGraphic` khi gần viewport.
- Activity/history paginate; tránh render toàn bộ history lồng trong mỗi hũ.
- List view dùng row gọn, grid dùng progressive disclosure.

#### 3.2 Analytics

- Dùng responsive hybrid: desktop render đủ section; mobile không render report table/chart ngoài route hiện tại.
- Chart resize được debounce, update theo Reduced Motion; thao tác lọc định kỳ dùng animation ngắn `250ms`.
- ScrollSpy chỉ chạy desktop, listener passive + RAF và store update tối đa một lần khi active section thực sự đổi.

#### 3.3 Paint system

- Tạo shadow level `none/sm/card/dialog`; mobile/reduced-effects dùng shadow đơn giản.
- Loại backdrop blur khỏi bề mặt cuộn; chỉ giữ trong modal nhỏ nếu trace cho phép.
- Thiết lập motion token và rule không animate layout properties (`width/height/top/left`) khi có thể dùng transform/opacity.

**Gate:** Fixture 20/50 jars và Analytics full đạt performance budget; keyboard order và screen-reader semantics không hồi quy.

### Phase 4 — I18n, accessibility và design system (Sprint 4)

- Chuẩn hóa toàn bộ copy tiếng Việt, title theo route và stable category keys.
- Ẩn currency chưa hỗ trợ; thiết kế domain model riêng nếu mở lại multi-currency.
- Contrast/focus/disabled/error matrix cho bốn theme.
- Typography scale; bỏ body/help text quá nhỏ và monospace không cần thiết.
- Error taxonomy, mã tham chiếu và recovery CTA; không render raw exception.
- Storybook hoặc harness nội bộ cho primitives/patterns; visual regression bốn theme.

**Gate:** Manual keyboard + screen reader smoke test, contrast matrix, zoom 200%, reduced motion và error/offline flows đều có bằng chứng.

## 4. Backlog ticket đề xuất

| Ticket | Ưu tiên | Phạm vi | Dependency |
|---|---|---|---|
| NAV-01 | P0 | Shared nav model + bottom navigation | Không |
| NAV-02 | P0 | Mobile sub-navigation drawer/sheet | NAV-01 |
| A11Y-01 | P1 | Button/IconButton target + focus token | Không |
| TRUST-01 | P1 | `loading/insufficient/measured` state model | Không |
| TRUST-02 | P1 | Sửa Home/Plan/Analytics/Jars verdict | TRUST-01 |
| ONB-01 | P1 | Bỏ auto-budget; consent template | Product + backend migration |
| PERF-01 | P1 | Performance harness + fixture + trace | Không |
| PERF-02 | P1 | Section content-visibility + reduce effects | PERF-01 |
| PERF-03 | P1 | Jars pagination/lazy SVG | PERF-01, route plan |
| PERF-04 | P1 | Analytics route/deferred chart | ROUTE-01, PERF-01 |
| ROUTE-01 | P1 | Feature/subfeature routes | NAV-01 |
| BUNDLE-01 | P2 | Route/modal/CSS code splitting | ROUTE-01 |
| I18N-01 | P2 | vi catalog + stable category keys | Data migration |
| CURR-01 | P1 | Ẩn currency selector giả | Không |
| DS-01 | P2 | Semantic color/shadow/motion/type tokens | A11Y-01 |
| ERROR-01 | P2 | Error taxonomy + themed recovery UI | DS-01 |

## 5. Thứ tự PR khuyến nghị

1. `PERF-01` — chỉ thêm harness/fixture/baseline.
2. `NAV-01 + NAV-02` — khôi phục mobile navigation.
3. `A11Y-01 + CURR-01` — quick wins ít phụ thuộc.
4. `TRUST-01 + TRUST-02` — sửa logic/copy dữ liệu rỗng.
5. `ONB-01` — backend + onboarding migration riêng.
6. `ROUTE-01` — route architecture, không trộn refactor visual.
7. `PERF-02 + BUNDLE-01` — defer/render/code split.
8. `PERF-03` — Jars pagination/lazy SVG.
9. `PERF-04` — Analytics tabs/deferred charts.
10. `I18N-01 + DS-01 + ERROR-01` — chuẩn hóa hệ thống.

Mỗi PR chỉ nên giải quyết một nhóm hành vi, kèm screenshot/trace/test trước–sau. Không gộp refactor hàng nghìn dòng với thay đổi UX vì sẽ khó xác định hồi quy.

## 6. Definition of Done toàn chương trình

- Bốn destination chính dùng được bằng touch/keyboard ở mọi viewport mục tiêu.
- Không còn insight tài chính tích cực/tiêu cực khi dữ liệu không đủ.
- Không còn control giả currency/locale.
- Route, reload, Back/Forward và page title đúng.
- Performance budget đạt trên fixture lớn và ít nhất một thiết bị tầm trung/thấp.
- Bốn theme pass contrast/focus/reduced-motion trong phạm vi đã ghi.
- Báo cáo cuối nêu rõ phần đã kiểm tra; không tuyên bố WCAG/production-ready nếu chưa có audit độc lập đầy đủ.

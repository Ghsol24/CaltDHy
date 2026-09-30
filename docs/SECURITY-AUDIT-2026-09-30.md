# Security Audit Report — CaltDHy

Ngày đánh giá: **30/09/2026**. Baseline: commit `0e0c59864e0fb15c2fa48fe1653dcda4492c2434`. Phạm vi: source hiện tại, cấu hình mẫu, dependency lockfiles, kiểm thử và công cụ phát hành trong repository này. Chưa xác minh triển khai production.

## 1. Executive summary

Phát hiện và sửa **7 vấn đề: 1 High, 5 Medium, 1 Low; không xác nhận Critical**. Ưu tiên cao nhất là cookie bị sao chép vẫn truy cập được tài khoản sau khi người dùng đổi mật khẩu/email. Các lỗi còn lại liên quan đến cấp token trong race condition, nạp/rút hũ thiếu ví đối ứng, xuất CSV, rate-limit IPv6, cookie trong cấu hình Render mặc định và tên danh mục trùng thuộc tính prototype.

Không tìm thấy bằng chứng bypass đăng nhập từ xa không cần credential, IDOR giữa hai tài khoản hoặc quyền admin có thể leo thang trong các đường dẫn đã đọc và kiểm thử. Điều này không phải chứng nhận toàn bộ ứng dụng không còn lỗ hổng. Các kiểm thử dùng tài khoản tổng hợp và MongoDB replica set tạm; email được giả lập, không dùng database/credential production.

| ID | Severity | Vấn đề | Trạng thái |
| --- | --- | --- | --- |
| SEC-01 | High | Bản sao cookie phiên hiện tại sống sót sau đổi email/mật khẩu | Đã sửa |
| SEC-02 | Medium | Ghi recovery/verification token từ trạng thái tài khoản cũ | Đã sửa |
| SEC-03 | Medium | Bypass ví đối ứng khi nạp/rút hũ bằng biến thể URL | Đã sửa |
| SEC-04 | Medium | Formula/cell injection trong CSV xuất báo cáo | Đã sửa |
| SEC-05 | Medium | Đổi địa chỉ IPv6 trong cùng dải để vượt rate-limit | Đã sửa |
| SEC-06 | Medium | Cookie thiếu Secure khi dùng HOST mặc định của Render | Đã sửa |
| SEC-07 | Low | Tên danh mục gây prototype pollution/mất mục ngân sách | Đã sửa |

Severity phản ánh tác động và điều kiện khai thác thực tế. SEC-03/07 chỉ chứng minh sai dữ liệu trong tài khoản sở hữu; ứng dụng ghi sổ chi tiêu, không có bằng chứng chuyển tiền ngân hàng hay mất tiền tài khoản khác. SEC-04 cần người nhận mở CSV trong phần mềm bảng tính; SEC-06 phụ thuộc cấu hình triển khai.

## 2. Kiến trúc và luồng tin cậy

- **Frontend:** React 19, Vite 8, Zustand, React Router, Chart.js; SPA/PWA được Express phục vụ cùng origin. Service worker cache tài nguyên tĩnh, không cấu hình cache API. Dữ liệu phiên và tài chính chủ yếu ở bộ nhớ; cơ chế đổi phiên hủy request cũ và xóa state.
- **Backend/database:** Express 4, Mongoose 8, MongoDB replica set/sharded cluster. Không dùng SQL. Mọi financial router có `protect`; bộ lọc gắn `userId` từ phiên server, không tin `userId` trong body. Thay đổi tiền có transaction, khóa tuần tự theo tài khoản, kiểm tra số dư và biên nhận idempotency.
- **Authentication:** bcrypt cost 12; mật khẩu mới tối thiểu 12 ký tự, tối đa 72 byte UTF-8. Đăng nhập cấp token ngẫu nhiên 32 byte trong cookie HttpOnly/SameSite Strict. Database giữ HMAC của token; middleware kiểm tra expiry và `authVersion` của user. Dù biến cấu hình còn tên `JWT_SECRET`, luồng hiện tại dùng opaque session, không chấp nhận bearer JWT cũ.
- **CSRF:** nonce cookie cùng HMAC gắn session; phương thức thay đổi dữ liệu cần `X-CSRF-Token`. CORS dùng danh sách origin, không wildcard có credential. Middleware có Helmet/CSP, giới hạn body, `no-store` cho API và lỗi trả ra đã rút gọn.
- **Email và file:** token email lưu hash; consume reset token nguyên tử. Brevo dùng URL cố định, Gmail tắt đọc file/URL qua Nodemailer. Avatar nhận data URI giới hạn định dạng/kích thước; không có endpoint ghi file upload tùy ý lên filesystem trong source đã xem.

## 3. Findings, evidence và bản sửa

Vị trí “trước sửa” dưới đây thuộc baseline nêu ở đầu báo cáo. Vị trí bản sửa/test theo file hiện tại; có thể dịch chuyển khi tiếp tục chỉnh sửa.

### SEC-01 — Phiên bị đánh cắp tồn tại sau đổi thông tin nhạy cảm

**Severity: High.** Trước sửa: `backEnd/server/routes/auth.js:262–267` nâng `currentSession.authVersion` theo user nhưng giữ nguyên token cookie.

**Điều kiện/tác động:** kẻ tấn công đã có bản sao cookie của chính phiên nạn nhân dùng để đổi mật khẩu/email. Sau thao tác đó, cả người dùng và bản sao cookie vẫn được chấp nhận; kẻ tấn công tiếp tục đọc/sửa dữ liệu tài chính. Không khẳng định source này đã làm lộ cookie hoặc có sự cố đánh cắp thực tế.

**Evidence động:** regression lưu cookie trước đổi mật khẩu; gọi `/api/auth/session` bằng cookie cũ sau đổi nhận **200 trước sửa**, thay vì 401. Kiểm tra cả đổi email riêng và đổi mật khẩu riêng.

**Fix:** trong transaction đổi profile, xóa session hiện tại và tạo token mới; trả cookie/CSRF mới sau commit. `authVersion` vô hiệu hóa các phiên khác. Đổi tên/avatar thông thường giữ hành vi cũ. Nếu tạo session mới lỗi, transaction rollback cả password lẫn revocation.

**Files/tests:** `backEnd/server/routes/auth.js`; `backEnd/server/tests/auth-security.test.js` — `rotates the active cookie...`, `rolls back the password change...`. Test kiểm tra cookie cũ 401, cookie mới 200, ghi preferences bằng CSRF mới thành công và mật khẩu cũ vẫn dùng được nếu transaction thất bại.

### SEC-02 — Race condition ghi token sau khi tài khoản đã thay đổi

**Severity: Medium.** Trước sửa: `backEnd/server/routes/auth.js:160–169` đọc user theo email rồi cập nhật token bằng `_id` mà không kiểm tra lại email/phiên bản xác thực.

**Điều kiện/tác động:** request cấp link đọc tài khoản trước, nhưng ghi token sau khi đổi email/mật khẩu đã commit. Nó có thể ghi lại token vừa cần vô hiệu hóa, gửi link về email cũ. Khai thác chiếm tài khoản sau đổi email còn đòi hỏi quyền đọc mailbox cũ, biết email mới và thắng khoảng race; chưa chứng minh có điều kiện này trên production.

**Evidence động:** test xen một request đổi profile thật giữa bước đọc và ghi token trên MongoDB tạm. Trước sửa vẫn gửi **1 email** từ trạng thái cũ; sau sửa không gửi và không để lại token. Bao phủ reset/verification × đổi email/password.

**Fix:** compare-and-set theo `_id`, email và `authVersion` đã đọc; verification kiểm tra thêm chưa được xác minh. Chỉ gửi khi update khớp. User legacy thiếu `authVersion` vẫn được hỗ trợ.

**Files/tests:** `backEnd/server/routes/auth.js`; `backEnd/server/tests/auth-security.test.js` — `does not issue recovery/verification tokens from a stale account snapshot...`, `still issues a usable recovery link for a legacy account...`. Phản hồi công khai vẫn chung, không bổ sung thông tin tồn tại tài khoản.

### SEC-03 — Bỏ qua yêu cầu ví đối ứng khi nạp/rút hũ

**Severity: Medium.** Trước sửa: `backEnd/server/utils/financialRequest.js:48` dùng regex phân biệt hoa/thường và không chấp nhận dấu `/` cuối, trong khi router Express nhận các biến thể đó. `backEnd/server/routes/jars.js:118–193,218–302` coi `walletId` là tùy chọn rồi bỏ qua ledger khi thiếu.

**Điều kiện/tác động:** user có phiên, CSRF, Idempotency-Key và hũ của mình. Gửi `PATCH /api/jars/<id>/DEPOSIT` với `{ "amount": 10 }` làm tăng hũ mà không trừ ví; withdrawal tương tự phá đối ứng. Sai tổng tài sản và lịch sử trong tài khoản này.

**Evidence động:** trước sửa endpoint trên trả **200**, `Jar.current` từ **100 thành 110**. Không tạo giao dịch ví đối ứng.

**Fix:** bắt buộc `walletId` trực tiếp tại hai handler deposit/withdraw sau khi route đã khớp; xóa guard phụ thuộc raw URL. Giữ hỗ trợ URL hoa/thường và slash cuối cho request hợp lệ, ownership, transaction và replay.

**Files/tests:** `backEnd/server/routes/jars.js`, `utils/financialRequest.js`, `tests/money-integrity.test.js`. Test bao phủ 8 biến thể URL thiếu ví trả 400, hũ/ví/ledger/receipt không đổi; ví tài khoản khác bị từ chối; URL hợp lệ vẫn bảo toàn tiền và retry cùng key chỉ ghi một lần.

### SEC-04 — CSV formula injection và chèn ô/dòng

**Severity: Medium.** Trước sửa: `frontEnd-react/src/features/analytics/AnalyticsView.jsx:994,1002` nội suy tên danh mục vào CSV nhưng không escape dấu nháy kép; quote CSV cũng không vô hiệu hóa công thức.

**Điều kiện/tác động:** tên danh mục chứa chuỗi như `=1+1` hoặc ký tự nháy/separator/newline, được đưa vào báo cáo rồi mở bằng Excel/phần mềm bảng tính. Có thể thực thi công thức hoặc giả mạo bố cục báo cáo; hành vi truy cập mạng/cảnh báo còn phụ thuộc trình đọc. Attacker cần người dùng sao chép nội dung hoặc chia sẻ/mở CSV; chưa có đường ghi danh mục vào tài khoản người khác.

**Evidence động:** API chấp nhận tên danh mục công thức, browser tải CSV thật; trước sửa assertion “Formula category must be exported as literal text” thất bại. Các vị trí category trong cả bảng phân tích và danh sách giao dịch đều bị ảnh hưởng. Field ghi chú cũ dùng `tx.note` trong khi dữ liệu chuẩn hóa dùng `desc`; không dùng ghi chú làm bằng chứng về đầu vào reachable.

**Fix:** helper `frontEnd-react/src/utils/csv.js` encode từng ô, nhân đôi dấu nháy và quote cả ô; thêm dấu apostrophe trước text có đầu công thức/ký tự điều khiển. Số tiền kiểu number/bigint vẫn là số, không bị thêm apostrophe. Áp dụng tại hai vùng xuất dữ liệu động, giữ format báo cáo và tên file.

**Tests:** `frontEnd-react/tests/csv-security.test.mjs` đọc lại CSV bằng parser độc lập, kiểm tra công thức, control/full-width prefixes, dấu nháy/comma/semicolon/newline, tiếng Việt, số âm và ô trống; `tests/browser-security.cjs` kiểm tra nội dung file tải từ UI thật. Cách phòng vệ tham chiếu [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection); không bảo đảm mọi chương trình xử lý file giữ nguyên bảo vệ sau khi người dùng lưu/chuyển đổi lại.

### SEC-05 — Rate-limit đếm từng địa chỉ IPv6 riêng lẻ

**Severity: Medium.** Trước sửa: hai limiter tại `backEnd/server/server.js:150–167` dùng default key generator của `express-rate-limit` **7.5.1** trong lockfile, trả raw `request.ip`.

**Điều kiện/tác động:** ứng dụng nhận client IPv6 trực tiếp hoặc qua proxy đã cấu hình tin cậy; client điều khiển nhiều địa chỉ trong allocation của mình. Đổi địa chỉ đặt lại bộ đếm API/auth, tăng khả năng brute-force/abuse. Không cần giả header qua proxy không tin cậy; test mô phỏng proxy tin cậy cục bộ.

**Evidence động:** sau khi đạt giới hạn 1 request, đổi `2001:db8:1234:5600::1` sang `2001:db8:1234:56ff::2` vẫn đi qua limiter, nhận **503 từ DB-readiness thay vì 429**. Hai địa chỉ cùng `/56`; database không cần chạy cho bằng chứng này.

**Fix:** cập nhật dependency/lockfile lên `express-rate-limit` **8.7.0**, đặt `ipv6Subnet: 56` cho cả hai limiter. Cố định header `draft-6` để giữ format trước nâng cấp. IPv4 vẫn tách theo địa chỉ, proxy hops giữ nguyên. Chính sách subnet dựa trên [tài liệu chính thức express-rate-limit](https://express-rate-limit.mintlify.app/reference/configuration#ipv6subnet).

**Tests:** `backEnd/server/tests/proxy-rate-limit.test.js` xác minh hai IP cùng `/56` trả 429, dải khác có bộ đếm riêng, spoof hop đầu không qua được giới hạn; `auth-preference-rate-limit.test.js` kiểm tra limiter đăng nhập với IPv6/URL aliases, header, no-store và preferences không chiếm quota login. `/56` có thể gom nhiều người dùng ở một số mạng; cần theo dõi 429 sau triển khai.

### SEC-06 — Secure-cookie fallback không khớp HOST mặc định Render

**Severity: Medium.** Trước sửa: `backEnd/server/utils/sessionSecurity.js:5–8` luôn fallback HOST loopback; `server.js:54–55` lại chọn host công khai `0.0.0.0` khi `RENDER=true`.

**Điều kiện/tác động:** triển khai Render thủ công, không cấp `HOST`, không có `CLIENT_URL` HTTPS và không đặt `COOKIE_SECURE=true`. Session/CSRF cookie không có Secure/`__Host-` dù server public. Khả năng lộ credential qua HTTP phụ thuộc HTTPS/HSTS thực tế; chưa thử interception. `render.yaml` hiện có các biến an toàn nên không mắc nhánh cấu hình này.

**Evidence/fix:** regression trước sửa nhận `secure: false`. Đồng bộ fallback host trong `sessionSecurity.js`; Render mặc định public buộc Secure, kể cả `COOKIE_SECURE=false`. HTTP loopback của launcher vẫn được hỗ trợ.

**Tests:** `backEnd/server/tests/session-cookie-policy.test.js` kiểm tra cả session/CSRF có Secure, HttpOnly, SameSite Strict, path `/`, không domain và prefix `__Host-`; case loopback xác nhận tương thích.

### SEC-07 — Danh mục trùng thuộc tính prototype làm hỏng báo cáo/ngân sách

**Severity: Low.** Trước sửa: `frontEnd-react/src/features/analytics/AnalyticsView.jsx:711–728` dùng object thường làm dictionary và ghi `catMap[cat].amount/count`. Với `__proto__`, `constructor`, `toString`, phép đọc lấy thuộc tính kế thừa, có thể ghi lên `Object.prototype` hoặc built-in function. Bảng ngân sách tại `backEnd/server/routes/spending.js:290,465` cũng dùng `{}`, làm mất entry `__proto__`.

**Điều kiện/tác động:** danh mục hợp lệ về schema có tên đặc biệt; tài khoản tạo giao dịch/ngân sách rồi xem báo cáo. Có thể làm sai/thiếu thống kê, ô ngân sách và làm bẩn prototype trong browser đó. Chưa xác định gadget dẫn tới XSS/RCE hoặc tác động server/tài khoản khác.

**Evidence động:** trước sửa browser ghi nhận own property `amount/count` trên `Object.prototype`/`Object`/`Object.prototype.toString`. API trả ngân sách thiếu `__proto__: 100`. Khi sửa dictionary, test retry còn phát hiện Mongoose loại key đặc biệt khi clone response dạng Mixed trong receipt.

**Fix:** dùng dictionary không prototype cho các bảng tra cứu category bị ảnh hưởng trong AnalyticsView, TransactionModal, BudgetEditModal và API ngân sách. Giữ tên danh mục, không đổi quy tắc nghiệp vụ. Receipt giữ field `body` tương thích phiên bản cũ; chỉ response chứa key đặc biệt mới có thêm `bodyJson` để replay giữ nguyên key, tránh nhân đôi lưu trữ với response thông thường. Reader mới ưu tiên JSON khi có, vẫn đọc receipt legacy; không cần migration. Receipt cũ đã mất key không được tự dựng lại lịch sử; GET ngân sách đọc đầy đủ từ Budget. Trong rollout hỗn hợp, node cũ vẫn có lỗi key của chính phiên bản đó, nên cần hoàn tất cập nhật mọi node.

**Tests:** browser xác nhận không làm thay đổi built-in prototype và CSV vẫn chứa các category; `tests/money-integrity.test.js` kiểm tra PUT, GET global/tháng kế thừa, retry cùng key và tương thích receipt cũ.

## 4. Security tests và xác minh tương thích

Mỗi lỗi trên có regression tái hiện hành vi trước sửa hoặc assertion cụ thể trên cookie/response; các test quan trọng chạy với HTTP thật và MongoDB tạm. Không thay thế kiểm thử bằng test mock router cũ.

**Kết quả kiểm thử cuối:**

| Lệnh / phạm vi | Kết quả |
| --- | --- |
| `npm test` — unit frontend, release/launcher guards | **33/33 pass** |
| `npm test` — backend integration/security | **81/81 pass**, 0 fail, 0 skipped |
| `npm run test:browser` | **24/24 browser scenarios pass**, không có unhandled browser error |
| `npm run build --prefix frontEnd-react` | Production build thành công |
| `npm run test:ux-budget` | Pass |
| `npm run check:release` | Pass, 259 file thuộc allowlist |
| `npm run lint --prefix frontEnd-react` | Không có error; 3 warning có sẵn ở `categoryIcons.jsx`, `SpendingRouteSync.jsx`, `WalletsTab.jsx` |
| `git diff --check` | Pass |

Lượt tổng hợp cuối xác nhận **114/114 unit/integration tests** đạt trên bản sửa hoàn chỉnh. Trong quá trình sửa, suite đã phát hiện response replay mất key và thiếu bản dịch cho lỗi ví bắt buộc; cả hai đã được khắc phục trước kết quả cuối. Browser tests xác minh CSV bytes và cấu trúc, chưa chạy Excel/LibreOffice. Backend/email tests chạy trên dữ liệu tổng hợp, transport email giả lập; browser chạy Chrome headless cục bộ với MongoDB tạm.

Sau audit, tùy chọn ngày kết thúc khoản định kỳ được bổ sung theo yêu cầu sản phẩm. Regression mới xác nhận kỳ cuối vẫn trả được, kỳ sau bị chặn mà không ghi ledger/trừ ví, khoản không kỳ hạn giữ hành vi cũ, và gia hạn khoản từng gắn với ví đã lưu trữ cần chọn ví đang hoạt động. Browser kiểm tra tạo/sửa/xóa kỳ hạn, trạng thái đã kết thúc và bốn theme. Đây là thay đổi chức năng kèm invariant tài chính, không được tính là finding bảo mật thứ tám.

Các invariant tiếp tục được kiểm tra: quyền truy cập hai tài khoản, export chỉ dữ liệu của chủ sở hữu, cookie hết hạn/logout/password reset, CSRF giả/thiếu/token browser khác, operator-shaped IDs, mật khẩu quá 72 byte, số tiền thập phân/không an toàn, chi tiêu đồng thời không thấu chi, thanh toán kỳ định kỳ một lần, đóng ví/chuyển tiền bảo toàn số dư và rollback nếu lưu receipt thất bại.

Giữ đường dẫn API, shape phản hồi và yêu cầu Idempotency-Key. Thay đổi thấy được có chủ đích: cookie được thay sau đổi email/password, biến thể nạp/rút thiếu ví bị từ chối, IP cùng allocation IPv6 dùng chung quota, CSV chứa text an toàn, danh mục đặc biệt xuất hiện đầy đủ.

## 5. Dependency và dữ liệu nhạy cảm

Đã gọi npm advisory endpoint cho **cả ba lockfile**, gồm dependency runtime và development, trước và sau cập nhật. Kết quả cuối ngày 30/09/2026:

| Lockfile | Package records theo npm audit | Critical/High/Moderate/Low |
| --- | ---: | --- |
| `package-lock.json` | 43 | 0 / 0 / 0 / 0 |
| `backEnd/server/package-lock.json` | 206 | 0 / 0 / 0 / 0 |
| `frontEnd-react/package-lock.json` | 419 | 0 / 0 / 0 / 0 |

Đây là snapshot cảnh báo đã biết, không chứng minh dependency không có bug; SEC-05 được phát hiện bằng kiểm thử dù npm audit không báo. Không dùng `npm audit fix --force` hoặc nâng hàng loạt package.

Quét file text được Git theo dõi và guard phát hành không tìm thấy credential production theo các pattern đã kiểm tra; các mật khẩu literal tìm thấy là fixture test. `.env.example` để trống secret; không có `.env` thật/private key/database dump theo dõi trong danh sách file hiện tại. Literal khóa cũ trong startup chỉ dùng để từ chối cấu hình, không phải fallback được chấp nhận. Không in secret thật vào báo cáo/log. Pattern scan không thay thế kiểm tra lịch sử Git, file ignored, artifact cũ hoặc thu hồi credential tại nhà cung cấp.

## 6. Vấn đề còn tồn tại / cần xác minh

| Chủ đề | Kết luận và giới hạn |
| --- | --- |
| IDOR/auth bypass/privilege escalation | Không tìm thấy đường khai thác đã xác nhận trong source và tests hiện tại. Không có hệ thống role admin trong API đang review. |
| SQL/NoSQL injection, command injection, path traversal, SSRF, XSS, CSRF | Không có exploit được xác nhận ngoài các finding cụ thể trên. Query ownership/kiểu ID, React escaping, fixed email endpoint, CSRF và static-file guards đã được đọc/kiểm thử theo phạm vi. Không khẳng định đã fuzz mọi tổ hợp đầu vào. |
| Rate-limit nhiều instance | Bộ đếm còn trong memory từng tiến trình; restart reset quota, nhiều replica có quota riêng. Cần shared store/gateway nếu triển khai scale-out, kèm giới hạn theo tài khoản để chống nguồn IP phân tán. Chưa xác minh số instance thực tế. |
| Proxy/TLS/cookie production | Cần xác minh số trusted hops, chặn truy cập trực tiếp origin, HTTPS/HSTS tại ingress và header thực tế. Local tests không chứng minh cấu hình nhà cung cấp. |
| Registration policy | Source mặc định `open`; `.env.example` chọn `invite`, `render.yaml` chọn `open`. Tài liệu cũ mô tả mặc định sai đã được sửa. Giữ business policy hiện tại; muốn invite-only phải cấp biến rõ ràng. |
| Email verification | Tài khoản chưa xác minh vẫn dùng ứng dụng theo hành vi hiện tại. Cần xác nhận yêu cầu sản phẩm trước khi bắt buộc verify; không tự thêm chặn nghiệp vụ. |
| Input và quy mô dữ liệu | Một số field text/boolean chưa có schema validation thống nhất, malformed input có thể trả lỗi chung 500 thay vì 400. Financial reconciliation còn đọc toàn bộ ledger trong transaction, export có thể lớn; chưa load-test/quota toàn bộ tài khoản. Chưa đủ bằng chứng để gán remote DoS cụ thể. |
| Dữ liệu cũ | Chưa kiểm tra database thật, collection indexes, bản ghi sai/trùng từ trước, backup/restore hoặc MongoDB quyền tối thiểu/encryption-at-rest. Bản sửa không tự sửa dữ liệu lịch sử đã bị ảnh hưởng. |
| Secret lịch sử và artifact | Chưa quét đầy đủ lịch sử Git, deployment secret store, ZIP cũ hoặc log production. Nếu có bằng chứng rò rỉ trước đây, phải rotate/revoke thực tế; sửa source không thu hồi bí mật. |
| Gửi email | Chỉ kiểm thử transport giả lập, không gửi thư thật; cần kiểm tra delivery bằng tài khoản được phép trên deployment. |

## 7. Hardening tiếp theo

1. Triển khai bản sửa sau khi review diff; theo dõi lỗi auth/429 và kiểm tra đăng nhập, đổi mật khẩu, nạp/rút hũ trên tài khoản thử được phép. Kiểm tra dữ liệu hũ/ledger cũ bằng quy trình đối soát riêng trước khi tự điều chỉnh.
2. Khi nhiều instance hoặc mở rộng người dùng, dùng shared rate-limit store, ingress limit, quota hợp lý và đo tải ledger/export. Không tăng quota toàn cục chỉ để che lỗi cấu hình proxy.
3. Chuẩn hóa validation theo endpoint, bounds cho mảng/chuỗi, loại bỏ phản hồi 500 cho input sai; giữ enum và hợp đồng hiện tại bằng regression tests.
4. Chạy dependency audit và các test security trong CI; bật branch protection/ruleset trên repository nếu chưa có. Tự động hóa secret scanning cho commit history và artifact phát hành mà không ghi giá trị secret vào log.
5. Xác minh HTTPS, backup/restore, quyền database, retention dữ liệu/receipt và chính sách đăng ký bằng cấu hình thực tế. Bổ sung audit event đã loại dữ liệu nhạy cảm cho thay đổi tài khoản và reset dữ liệu nếu sản phẩm cần truy vết.

Chưa thực hiện deployment, chạy migration dữ liệu thật hoặc xoay credential trong lần đánh giá này.

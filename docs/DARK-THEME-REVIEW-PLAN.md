# Đối chiếu đánh giá theme tối và kế hoạch chỉnh sửa

Ngày: 24/09/2026. Mã nguồn đối chiếu: `ad11312`.
Trạng thái: **đã triển khai các chỉnh sửa xác nhận được và kiểm thử hồi quy ngày 25/09/2026**. Mục 1–7 giữ lại kết quả khảo sát và kế hoạch ban đầu để đối chiếu; kết quả thực hiện ở mục 8.

## 1. Phạm vi và cách kiểm tra

- Hai ảnh người dùng gửi được dùng làm các nhận định cần kiểm chứng, không phải chỉ dẫn triển khai tự động.
- Đọc thứ tự import CSS, token, theme store, trang xác thực, modal, lịch sử và cấu hình biểu đồ/PWA trong mã nguồn hiện tại.
- Chạy frontend hiện tại bằng Vite và Chrome headless `154.0.8037.57`; dùng API giả lập cho tài khoản rỗng, không sử dụng hoặc thay đổi dữ liệu thật.
- Kiểm tra tại 1440×1000 và 390×844: đăng nhập, Home, Settings, xác nhận đăng xuất lồng trong Settings, thêm giao dịch và Analytics rỗng. Thu màu đã được trình duyệt áp dụng và ảnh sau khi hiệu ứng mở kết thúc.
- Tám mẫu đã thu không có lỗi JavaScript hoặc tràn ngang ở cấp trang. Điều này chưa chứng minh mọi vùng cuộn bên trong hoặc mọi thao tác trên mobile đều đúng.
- Bằng chứng: [runtime.json](dark-theme-evidence/runtime.json), [đăng nhập](dark-theme-evidence/login-desktop.png), [Home](dark-theme-evidence/home-desktop.png), [Settings](dark-theme-evidence/settings-desktop.png), [xác nhận lồng](dark-theme-evidence/confirm-nested.png), [thêm giao dịch desktop](dark-theme-evidence/transaction-desktop.png), [thêm giao dịch mobile](dark-theme-evidence/transaction-mobile.png).
- Chưa kiểm tra thiết bị iOS/Android thật, màn hình khởi động PWA đã cài, biểu đồ có dữ liệu thật, toàn bộ bàn phím/screen reader và toàn bộ bốn theme trong lượt khảo sát này. Đây là đầu việc nghiệm thu khi triển khai.

## 2. Kết luận từng nhận định trong ảnh

| Nhận định | Kết luận | Bằng chứng và giới hạn |
| --- | --- | --- |
| Chữ phụ và chữ xanh thiếu tương phản | **Đúng** | `tokens.css:181` trở đi vẫn dùng `#64748B`, `#2563EB` và nền `#12131C`. Màu thực tế của menu đang chọn là `rgb(37,99,235)`, nhãn v2.0 cũng vậy. Settings có chữ phụ dùng token muted. |
| Đăng nhập và một số modal khác phong cách dashboard | **Đúng một phần** | Login thực sự dựng vít, khe, đèn, orb qua `IndustrialPanel`, `StatusBar`, `auth.css`. Modal giao dịch hiện tại đã dùng `.txn-modal-card` với tiêu đề sans và không có vít/khe. Không tìm thấy JSX hiện tại sử dụng `.modal-card__screw`, `.modal-vent`, `.numpad-vent`, `.guide-vent`; sự tồn tại của CSS đó chưa chứng minh UI đang dùng. Dashboard vẫn có gradient/glow và chữ mono ở vài nhãn, nên cũng chưa hoàn toàn tối giản. |
| Lớp phủ hộp thoại chưa cùng quy tắc | **Đúng** | Settings dùng đen 78%, không blur; modal giao dịch dùng xanh `rgba(23,49,38,.45)` + blur 6px; Confirm dùng xanh 40% + blur 4px. Modal lưu trữ ví còn dùng đen 80%. Khác biệt có cả trên code lẫn ảnh render. |
| Màu được quản lý ở nhiều nơi | **Đúng; cần ưu tiên từ đầu** | `tokens.css`, `themes.css`, `auth.css`, các component CSS và bảng màu Chart.js đều có khai báo riêng. Nhiều override `!important`. `auth.css` nạp toàn cục sau tokens/themes và khai báo lại font tại `:root`; runtime xác nhận toàn app nhận danh sách font IBM Plex thay vì Inter của tokens. Điều này là xung đột đã xảy ra, không chỉ rủi ro tương lai. |
| Màu khởi động PWA không khớp dark mặc định | **Đúng về cấu hình; tác động cần kiểm tra thiết bị** | Manifest là `#F7F8FF`/`#4F46E5`; meta theme-color vẫn `#4F46E5` khi runtime là dark. `useThemeStore.js` mặc định dark và chỉ đổi class, không đổi meta. Vite dùng `manifest:false`, nên manifest đang dùng là file public, không phải manifest sinh tự động. |

Các điểm tích cực có cơ sở: màu chữ chính/phụ thông thường tốt trên nền tối, các trường giao dịch có override dark; input ngày có `color-scheme` dark; có focus-visible, reduced-motion CSS và logic reduced-motion cho Chart.js. Tuy nhiên “có hỗ trợ” chưa đồng nghĩa tất cả luồng đạt accessibility. Drawer theo ngày có breakpoint desktop/mobile trong `transaction-inspection.css`, chưa được kiểm tra thao tác đầy đủ trong lần này.

## 3. Tương phản: kết quả tính lại và cách áp dụng

Tính theo độ chói tương đối sRGB, không lấy màu anti-alias từ ảnh. Bảng dưới áp dụng cho màu đặc; nền bán trong suốt, gradient và opacity phải được ghép với nền thực tế rồi đo riêng.

| Màu chữ | Trên `#12131C` | Trên `#1A1C29` | Nhận xét |
| --- | ---: | ---: | --- |
| Muted hiện tại `#64748B` | 3,886:1 | 3,553:1 | Không đạt cho chữ thường |
| Cobalt hiện tại `#2563EB` | 3,578:1 | 3,271:1 | Không đạt cho chữ thường |
| Secondary hiện tại `#8F9CAE` | 6,635:1 | 6,066:1 | Đạt trên hai nền này |
| Chữ chính `#F3F4F6` | 16,803:1 | 15,363:1 | Đạt trên hai nền này |
| Xanh cho chữ đề xuất `#60A5FA` | 7,273:1 | 6,650:1 | Phù hợp để thử cho link/active text |
| Màu phụ dự phòng `#94A3B8` | 7,212:1 | 6,594:1 | Chỉ là ứng viên; phải giữ thứ bậc với secondary |

Ngưỡng nghiệm thu: chữ thường ≥4,5:1, chữ lớn ≥3:1; thành phần đồ họa/điều khiển cần thiết để nhận biết ≥3:1 so với màu kề. Không áp ngưỡng 4,5:1 đồng loạt cho icon, logo, đồ trang trí hay điều khiển vô hiệu hóa. Nguồn: [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Không đổi `--primary` toàn cục sang xanh sáng: trắng trên cobalt `#2563EB` đạt 5,169:1, nhưng trắng trên `#60A5FA` chỉ đạt 2,542:1. Cần tách màu nền nút và màu chữ nhấn. Token `--color-brand-on-dark` đã tồn tại nhưng chưa được dùng nhất quán; nên chuyển dần về tên ngữ nghĩa dùng được ở cả bốn theme.

Không kết luận nhãn biểu đồ tối đang lỗi chỉ dựa vào muted: Chart.js hiện có bảng riêng; tick dark `#8B949E` đạt khoảng 6,012:1 trên `#12131C`, legend dùng `#C9D1D9`. Cần đo canvas, tooltip và trạng thái đổi theme thực tế trước khi thay.

## 4. Phát hiện bổ sung cần đưa vào kế hoạch

1. **Icon danh mục màu đen trong modal giao dịch.** Runtime ghi nhận `.txn-card-icon svg` có cả `color` và `stroke` là `rgb(0,0,0)`. `.txn-category-card` là button nhưng chưa khai báo màu chữ ở cấp gốc, `.txn-card-icon` cũng chưa có màu; `currentColor` của SVG vì thế nhận màu đen. Sửa bằng token màu kế thừa phù hợp ở normal/selected/hover, giữ icon outline. Các icon này có nhãn chữ đi kèm nên không mặc định coi tất cả là vi phạm WCAG non-text, nhưng đây là lỗi hiển thị rõ ràng.
2. **Font toàn cục bị auth ghi đè.** Trình duyệt nhận danh sách IBM Plex cho body và các component dùng `--font-sans`; HTML lại tải Inter/JetBrains Mono. Cần thống nhất font tại tokens và kiểm tra font thực tế được tải, tránh nhảy bố cục. Không khẳng định IBM Plex đã được tải chỉ từ `font-family` computed.
3. **Cần kiểm tra clipping bên trong modal mobile.** Ảnh 390×844 cho thấy phần chân nút và cột danh mục cần được kiểm tra thêm bằng cuộn/chạm. Không có tràn ngang cấp trang không chứng minh vùng con không bị cắt. Chưa kết luận mất khả năng thao tác từ một ảnh tĩnh.
4. **Theme chỉ được áp sau khi module JS chạy.** Đây là rủi ro khung hình đầu lệch màu, chưa đo được thời lượng chớp sáng. Khi xử lý cần kiểm tra cold load và lựa chọn đã lưu, đồng thời giữ CSP hiện tại (`script-src 'self'`).

## 5. Định hướng thiết kế

Giữ nền obsidian, xanh cobalt cho hành động chính, màu tài chính đỏ/xanh và cảm giác bề mặt tối hiện tại. Chữ và icon dùng màu đủ sáng theo chức năng. Bố cục auth đi theo panel, tiêu đề, input và nút của app; giảm vít/khe, uppercase/letter-spacing quá nhỏ và glow chuyển động không cần thiết. Không viết lại toàn bộ CSS hoặc đồng nhất bốn theme thành một bảng màu.

Tuân thủ `.agents/AGENTS.md`: màu ngữ nghĩa tập trung trong tokens, icon outline `stroke=currentColor`, kiểm tra Dark/Light/Cream/Green. Mỗi đợt đổi token phải cập nhật nơi sử dụng và gỡ override cạnh tranh trong chính phạm vi đó.

## 6. Kế hoạch triển khai theo đợt

### Đợt 1 — Khả năng đọc và token tối thiểu (ưu tiên cao)

**Phạm vi:** `tokens.css`, `app-shell.css`, `account.css`, `dialogs.css`, `transaction-inspection.css`, các override liên quan trong `themes.css` và component sử dụng màu chữ nhấn.

- Chốt nhóm `text-primary / secondary / muted`, `action-bg / on-action`, `link / active-text / icon`, `focus-ring`. Giữ secondary sáng hơn muted; chọn màu cuối bằng ma trận đo và ảnh so sánh.
- Tách màu chữ xanh khỏi nền nút; cập nhật menu chọn, Settings, nhãn nhỏ, liên kết Home, lịch sử, placeholder, icon danh mục và toast có dùng primary làm chữ.
- Đo trên canvas, surface, surface-muted, selected/hover và nền alpha sau khi compositing. Đo riêng nút có gradient/overlay trắng và trạng thái hover.
- Giữ nhãn/biểu tượng/dấu tiền để trạng thái tài chính không chỉ phụ thuộc màu.

**Hoàn tất khi:** chữ nhỏ trong phạm vi sửa đạt ≥4,5:1; icon có màu nhận biết rõ; focus nhìn thấy; nút trắng trên cobalt vẫn đạt; bốn theme không đổi sai màu ngữ nghĩa. Lưu ảnh trước/sau và số đo thực tế, không chỉ kiểm tra giá trị token.

### Đợt 2 — Quy tắc lớp phủ hộp thoại (ưu tiên cao)

**Phạm vi:** `dialogs.css`, `account.css`, `modals.css`, `budgets-analytics.css`, `transaction-inspection.css`; kiểm kê thêm overlay của Hũ và Landing đang thực sự dùng.

- Dùng một nhóm token overlay nền/blur và quy tắc stacking; chọn cùng tông trung tính theo theme. Settings, giao dịch, ngân sách, lưu trữ ví và drawer đọc cùng nguồn.
- Có biến thể có chủ đích cho dialog lồng; đo hiệu ứng cộng alpha, không chồng hai overlay đen đậm đầy đủ lên nhau. Chốt mức alpha/blur bằng ảnh render, không cố định tất cả thành 78% chỉ vì token hiện tại đang như vậy.
- Kiểm tra Tab/Shift+Tab, Escape đóng dialog trên cùng, focus trả đúng nút, khóa cuộn, dropdown không bị backdrop che, lỗi máy chủ và nội dung dài.
- Kiểm chứng phần chân modal mobile và bàn phím ảo; nếu clipping tái hiện, sửa chuỗi chiều cao/overflow để thân cuộn và hành động còn truy cập được.

**Hoàn tất khi:** mở/đóng dialog thường và dialog con không đổi tông nền bất ngờ; focus và scroll đúng; mọi hành động truy cập được ở 390px và 200% zoom.

### Đợt 3 — Màu khởi động và đổi theme (phạm vi nhỏ, có thể tách riêng)

**Phạm vi:** `public/manifest.json`, `index.html`, `useThemeStore.js`, tài nguyên bootstrap cục bộ nếu cần, kiểm tra lại cấu hình CSP/PWA.

- Chọn manifest mặc định theo dark mặc định của sản phẩm; đồng bộ `background_color` với nền khởi động đã chọn và theme-color với màu chrome mong muốn.
- Đồng bộ meta theme-color khi khởi động/đổi cả bốn theme; theme đã lưu có ưu tiên cao hơn mặc định. Xử lý localStorage thiếu, lỗi truy cập và giá trị không hợp lệ.
- Đánh giá bootstrap nhỏ chạy trước React để tránh màu sai ở khung hình đầu. Dùng file cùng origin hoặc cơ chế CSP phù hợp; không nới CSP bằng `unsafe-inline` chỉ để đổi theme.
- Manifest là cấu hình tĩnh: không hứa màn splash của PWA tự đổi theo localStorage. Kiểm tra riêng cold launch PWA đã cài, Chrome desktop/Android và Safari/iOS trong phạm vi nền tảng hỗ trợ.

**Hoàn tất khi:** meta đổi đúng theo theme, reload giữ lựa chọn, cold load không có khung hình sai màu có thể tái hiện, bản build dùng đúng manifest. `background_color` là màu gợi ý lúc khởi động, không thay thế màu CSS lúc app chạy; xem [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/background_color).

### Đợt 4 — Đồng bộ auth và thu gọn CSS (sau các lỗi dễ đọc)

**Phạm vi:** `auth.css`, `IndustrialPanel.jsx`, `StatusBar.jsx`, các trang Login/Signup/ResetPassword/VerifyEmail; `tokens.css`, `themes.css`, thứ tự CSS trong `main.jsx`.

- Bỏ khai báo font/global theme trùng trong auth; dùng token chung, chỉ giữ biến riêng dưới `.auth-page` khi thật sự cần.
- Đưa login, đăng ký qua lời mời, quên/đặt lại mật khẩu, xác minh email về cùng hệ tiêu đề, bề mặt, input, khoảng cách và nút. Giữ thông tin trạng thái hữu ích, giản lược phần trang trí theo hướng đã nêu.
- Kiểm kê selector có trong DOM trước khi sửa/xóa CSS cũ của vít/khe/numpad; không coi `modals.css` là owner của mọi modal hiện tại.
- Di chuyển từng nhóm override và bảng màu biểu đồ về token chung. Sau mỗi nhóm, kiểm tra màu runtime rồi mới xóa alias/`!important` không còn cần thiết.

**Hoàn tất khi:** auth cùng hệ font/nút/panel với app; auth không ghi đè font toàn cục; các flow xác thực giữ chức năng; đổi theme ngay trên biểu đồ cập nhật đúng; CSS giảm trùng mà không phát sinh file override mới để vá chồng.

## 7. Ma trận nghiệm thu chung

| Trục kiểm tra | Các trường hợp bắt buộc |
| --- | --- |
| Theme | Dark ưu tiên; hồi quy Light, Cream, Green ở mọi component chạm tới |
| Kích thước | 390, 768, 1024, 1440px; zoom thật 200%; bàn phím ảo trên thiết bị thật |
| Nội dung | Rỗng, có dữ liệu, số tiền lớn, tên dài, lỗi validation/server, đang tải, disabled |
| Tương tác | Normal, hover, selected, focus-visible, Tab/Shift+Tab, Escape, dropdown, input date, dialog lồng |
| Biểu đồ/lịch sử | Tick, legend, tooltip, chọn ngày, drawer chi tiết, tìm kiếm và bộ lọc |
| Chuyển động | Reduced motion bật/tắt; không thêm animation filter/blur vô hạn |
| PWA | Theme đã lưu, mặc định, storage lỗi, hard reload, cold launch, manifest/meta trên production build |

Tận dụng `tests/browser-security.cjs` và các kiểm tra hiện có; thêm scenario đo tương phản màu đã render, lỗi icon kế thừa, theme/meta và dialog lồng. Không chỉ thêm test so sánh chuỗi hex trong CSS. Chạy build/lint, browser regression và các kiểm tra bắt buộc của repo phù hợp với phần sửa; test chức năng auth/session/PWA nếu chạm logic bootstrap hoặc store. Lần lập kế hoạch này không thay code ứng dụng và không coi browser khảo sát là thay thế toàn bộ regression suite.

Mỗi đợt là một thay đổi có thể review/hoàn tác riêng. Kế hoạch này bổ sung phần contrast matrix, modal và design system còn mở trong `UX-UI-REMEDIATION-PLAN.md`; không lấy các số liệu kiểm thử cũ ở tài liệu đó làm bằng chứng rằng phiên bản hiện tại đã đạt.

## 8. Kết quả thực hiện ngày 25/09/2026

- **Đợt 1:** tách token màu nền hành động, màu chữ liên kết/menu đang chọn và icon. Theme tối dùng `#94A3B8` cho chữ phụ nhỏ, `#60A5FA` cho chữ nhấn, giữ `#2563EB` cho nền nút trắng. Các vùng đã chạm tới dùng màu ngữ nghĩa thay cho màu thương hiệu đậm làm chữ; nhãn thu nhập/chi tiêu và trạng thái thành công dùng token tài chính. Icon danh mục giao dịch kế thừa màu từ thẻ và trạng thái chọn.
- **Đợt 2:** Settings, giao dịch, ngân sách, ví và drawer cùng lấy màu lớp phủ/blur từ token; xác nhận lồng có lớp phủ nhẹ hơn và tầng hiển thị riêng. Modal giao dịch trên mobile cho phần thân cuộn, giữ vùng hành động trong khung nhìn. Phần thân, ô nhập, thẻ tóm tắt và nút của modal tạo Hũ không còn cố định nền trắng/xanh tím, nên theo đúng bề mặt của bốn theme.
- **Đợt 3:** manifest mặc định khớp nền tối. Tệp bootstrap cùng origin đặt theme đã lưu và màu nền trước React; theme store cập nhật `theme-color` khi đổi theme. Bốn theme dùng cùng màu canvas từ token và được kiểm tra bằng trình duyệt.
- **Đợt 4:** bỏ font và reset toàn cục từ CSS xác thực, giản lược các chi tiết vít/khe/quầng sáng của đăng nhập và đồng bộ panel, tiêu đề, biểu mẫu, nút với hệ màu/typography chung. Chỉ các override trong phạm vi sửa được hợp nhất; bảng màu biểu đồ chưa đổi vì khảo sát chưa phát hiện lỗi tương phản của tick/legend.

Ảnh và màu trình duyệt sau sửa: [runtime](dark-theme-evidence/after/runtime.json), [đăng nhập](dark-theme-evidence/after/login-desktop.png), [Home](dark-theme-evidence/after/home-desktop.png), [Settings](dark-theme-evidence/after/settings-desktop.png), [xác nhận lồng](dark-theme-evidence/after/confirm-nested.png), [giao dịch mobile](dark-theme-evidence/after/transaction-mobile.png), modal Hũ [Dark](dark-theme-evidence/after/jar-modal-dark.png), [Light](dark-theme-evidence/after/jar-modal-light.png), [Cream](dark-theme-evidence/after/jar-modal-cream.png), [Green](dark-theme-evidence/after/jar-modal-green.png). Mười hai mẫu không có lỗi JavaScript hoặc tràn ngang cấp trang. Dữ liệu trong ảnh là API giả lập với tài khoản rỗng.

Kiểm tra đã đạt: build frontend, lint (còn ba cảnh báo có sẵn ngoài phạm vi), 29 bài kiểm tra nguồn/frontend, 59 bài kiểm tra backend, 18 tình huống trình duyệt trên bản production, ngân sách dung lượng UX, và kiểm tra nguồn phát hành. Trình duyệt kiểm tra ma trận token chữ/nền/nút của Dark, Light, Cream, Green; màu ngay khung hình đầu trước React, meta theme-color, font xác thực, icon danh mục, modal tạo Hũ, nút modal mobile và độ đậm của lớp phủ lồng. Chưa xác nhận splash của PWA đã cài trên thiết bị iOS/Android, bàn phím ảo thật, screen reader hoặc biểu đồ có dữ liệu tài chính thật; cần kiểm tra các phần này trên môi trường thiết bị/dữ liệu tương ứng trước khi coi toàn bộ ma trận ở mục 7 là nghiệm thu đầy đủ.

Đợt rà soát toàn diện sau triển khai, bao gồm các lỗi mới phát hiện và phạm vi kiểm tra bổ sung, được ghi trong [báo cáo trước phát hành](PREDEPLOY-VALIDATION-2026-09-25.md).
